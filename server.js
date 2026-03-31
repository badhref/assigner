const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── Schedule helpers ──────────────────────────────────────────────────────────

function getScheduleTypes() {
  const typesPath = path.join(dataDir, 'schedule-types.json');
  if (!fs.existsSync(typesPath)) return {};
  try { return JSON.parse(fs.readFileSync(typesPath, 'utf8')); }
  catch { return {}; }
}

function parseSchedule(region) {
  const csvPath = path.join(dataDir, 'schedule.csv');
  if (!fs.existsSync(csvPath)) return [];
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  const rows = [];
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!headerSeen) { headerSeen = true; continue; } // skip header row
    const parts = line.split(',');
    if (parts.length < 5) continue;
    const [date, rgn, first_name, last_name, ...rest] = parts;
    const assignment = rest.join(',').trim();
    if (region && rgn.trim() !== region) continue;
    rows.push({ date: date.trim(), region: rgn.trim(), first_name: first_name.trim(), last_name: last_name.trim(), assignment });
  }
  return rows;
}

// ── Auto check-out logic ──────────────────────────────────────────────────────

function runScheduledTasks() {
  db.prepare(`
    UPDATE team_members
    SET is_checked_in = 0, checked_in_at = NULL, checkout_until = NULL
    WHERE is_checked_in = 1
      AND checked_in_at IS NOT NULL
      AND datetime(checked_in_at, '+9 hours') <= datetime('now')
  `).run();

  db.prepare(`
    UPDATE team_members
    SET is_checked_in = 1, checkout_until = NULL
    WHERE is_checked_in = 0
      AND checkout_until IS NOT NULL
      AND checkout_until <= datetime('now')
  `).run();
}

setInterval(runScheduledTasks, 30 * 1000);

// ── Members ───────────────────────────────────────────────────────────────────

app.get('/api/members', (req, res) => {
  try {
    const region = req.query.region;
    let query = `SELECT * FROM team_members`;
    const params = [];
    if (region) {
      query += ` WHERE region = ?`;
      params.push(region);
    }
    query += ` ORDER BY is_checked_in DESC, last_name, first_name`;
    const members = db.prepare(query).all(...params);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/members', (req, res) => {
  try {
    const { first_name, last_name, timezone, region } = req.body;
    if (!first_name?.trim() || !last_name?.trim()) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    const tz  = timezone?.trim() || 'America/Chicago';
    const rgn = region?.trim()   || 'US';
    const result = db.prepare(
      'INSERT INTO team_members (first_name, last_name, timezone, region) VALUES (?, ?, ?, ?)'
    ).run(first_name.trim(), last_name.trim(), tz, rgn);

    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/members/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Check-in / Check-out ──────────────────────────────────────────────────────

app.post('/api/members/:id/checkin', (req, res) => {
  try {
    db.prepare(`
      UPDATE team_members
      SET is_checked_in = 1, checked_in_at = CURRENT_TIMESTAMP,
          checkout_until = NULL, last_auto_checkout_at = NULL
      WHERE id = ?
    `).run(req.params.id);

    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/members/:id/checkout', (req, res) => {
  try {
    const { duration_minutes } = req.body;

    if (duration_minutes && duration_minutes > 0) {
      db.prepare(`
        UPDATE team_members
        SET is_checked_in = 0,
            checkout_until = datetime('now', '+' || ? || ' minutes')
        WHERE id = ?
      `).run(duration_minutes, req.params.id);
    } else {
      db.prepare(`
        UPDATE team_members
        SET is_checked_in = 0, checked_in_at = NULL, checkout_until = NULL
        WHERE id = ?
      `).run(req.params.id);
    }

    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Picker ────────────────────────────────────────────────────────────────────

app.post('/api/members/:id/pick', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    if (!member.is_checked_in) return res.status(400).json({ error: 'Member is not checked in.' });

    const memberRegion = member.region || 'US';

    const checkedIn = db.prepare(
      'SELECT current_cycle_assigned FROM team_members WHERE is_checked_in = 1 AND region = ?'
    ).all(memberRegion);
    const cycleExhausted = checkedIn.length > 0 && checkedIn.every(m => m.current_cycle_assigned);
    if (cycleExhausted) {
      db.prepare("INSERT INTO cycle_events (occurred_at, region) VALUES (datetime('now'), ?)").run(memberRegion);
      db.prepare('UPDATE team_members SET current_cycle_assigned = 0 WHERE is_checked_in = 1 AND region = ?').run(memberRegion);
    }

    const result = db.prepare('INSERT INTO pick_history (member_id) VALUES (?)').run(member.id);
    res.json({ pick_id: result.lastInsertRowid, member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pick', (req, res) => {
  try {
    const region = (req.body && req.body.region) || 'US';
    const checkedIn = db.prepare('SELECT * FROM team_members WHERE is_checked_in = 1 AND region = ?').all(region);
    if (checkedIn.length === 0) {
      return res.status(400).json({ error: 'No available team members are checked in.' });
    }

    const balanced = req.body && req.body.balanced;

    if (balanced) {
      const maxCount = Math.max(...checkedIn.map(m => m.pick_count));
      const minCount = Math.min(...checkedIn.map(m => m.pick_count));
      let pool = maxCount === minCount ? checkedIn : checkedIn.filter(m => m.pick_count < maxCount);

      const lastTwo = db.prepare(`
        SELECT ph.member_id FROM pick_history ph
        JOIN team_members tm ON ph.member_id = tm.id
        WHERE ph.confirmed = 1 AND tm.region = ?
        ORDER BY ph.confirmed_at DESC LIMIT 2
      `).all(region);
      if (lastTwo.length === 2 && lastTwo[0].member_id === lastTwo[1].member_id) {
        const withoutRepeat = pool.filter(m => m.id !== lastTwo[0].member_id);
        if (withoutRepeat.length > 0) pool = withoutRepeat;
      }

      const weights = pool.map(m => maxCount - m.pick_count + 1);
      const total   = weights.reduce((a, b) => a + b, 0);
      let rand   = Math.random() * total;
      let picked = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) {
        rand -= weights[i];
        if (rand <= 0) { picked = pool[i]; break; }
      }

      const result = db.prepare('INSERT INTO pick_history (member_id) VALUES (?)').run(picked.id);
      return res.json({ pick_id: result.lastInsertRowid, member: picked });
    }

    // Cycle mode
    let pool = checkedIn.filter(m => !m.current_cycle_assigned);

    if (pool.length === 0) {
      db.prepare("INSERT INTO cycle_events (occurred_at, region) VALUES (datetime('now'), ?)").run(region);
      db.prepare('UPDATE team_members SET current_cycle_assigned = 0 WHERE is_checked_in = 1 AND region = ?').run(region);
      pool = db.prepare('SELECT * FROM team_members WHERE is_checked_in = 1 AND region = ?').all(region);
    }

    const maxPicks = Math.max(...pool.map(m => m.pick_count));
    const weights  = pool.map(m => maxPicks - m.pick_count + 1);
    const total    = weights.reduce((a, b) => a + b, 0);
    let rand   = Math.random() * total;
    let picked = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      rand -= weights[i];
      if (rand <= 0) { picked = pool[i]; break; }
    }

    const result = db.prepare('INSERT INTO pick_history (member_id) VALUES (?)').run(picked.id);
    res.json({ pick_id: result.lastInsertRowid, member: picked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pick/:id/confirm', (req, res) => {
  try {
    const pick = db.prepare('SELECT * FROM pick_history WHERE id = ?').get(req.params.id);
    if (!pick) return res.status(404).json({ error: 'Pick not found.' });
    if (pick.confirmed) return res.status(400).json({ error: 'Already confirmed.' });

    db.prepare('UPDATE pick_history SET confirmed = 1, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE team_members SET pick_count = pick_count + 1, current_cycle_assigned = 1 WHERE id = ?').run(pick.member_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pick/:id/cancel', (req, res) => {
  try {
    db.prepare('DELETE FROM pick_history WHERE id = ? AND confirmed = 0').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── History ───────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  try {
    const region = req.query.region || 'US';
    const history = db.prepare(`
      SELECT 'pick' as type, ph.id, ph.confirmed_at as ts, tm.first_name, tm.last_name
      FROM pick_history ph
      JOIN team_members tm ON ph.member_id = tm.id
      WHERE ph.confirmed = 1 AND tm.region = ?

      UNION ALL

      SELECT 'cycle' as type, ce.id, ce.occurred_at as ts, NULL as first_name, NULL as last_name
      FROM cycle_events ce
      WHERE ce.region = ?

      ORDER BY ts DESC
      LIMIT 50
    `).all(region, region);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Master reset ──────────────────────────────────────────────────────────────

app.post('/api/reset', (req, res) => {
  try {
    const region = (req.body && req.body.region) || 'US';
    db.prepare(`
      UPDATE team_members
      SET pick_count = 0, current_cycle_assigned = 0,
          is_checked_in = 0, checked_in_at = NULL, checkout_until = NULL
      WHERE region = ?
    `).run(region);
    db.prepare(`
      DELETE FROM pick_history WHERE member_id IN (
        SELECT id FROM team_members WHERE region = ?
      )
    `).run(region);
    db.prepare('DELETE FROM cycle_events WHERE region = ?').run(region);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedule ──────────────────────────────────────────────────────────────────

app.get('/api/schedule', (req, res) => {
  try {
    const { region = 'US', year } = req.query;
    const types = getScheduleTypes();
    const members = db.prepare(
      'SELECT id, first_name, last_name FROM team_members WHERE region = ? ORDER BY last_name, first_name'
    ).all(region);
    let entries;
    if (year) {
      entries = db.prepare(`
        SELECT se.id, se.date, se.region, se.member_id, se.assignment,
               tm.first_name, tm.last_name
        FROM schedule_entries se
        JOIN team_members tm ON se.member_id = tm.id
        WHERE se.region = ? AND se.date LIKE ?
        ORDER BY se.date, tm.last_name, tm.first_name
      `).all(region, `${year}-%`);
    } else {
      const curYear = new Date().getFullYear();
      entries = db.prepare(`
        SELECT se.id, se.date, se.region, se.member_id, se.assignment,
               tm.first_name, tm.last_name
        FROM schedule_entries se
        JOIN team_members tm ON se.member_id = tm.id
        WHERE se.region = ? AND se.date LIKE ?
        ORDER BY se.date, tm.last_name, tm.first_name
      `).all(region, `${curYear}-%`);
    }
    res.json({ types, entries, members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule: upcoming (current + next week, featured roles only) ─────────────

app.get('/api/schedule/upcoming', (req, res) => {
  try {
    const types = getScheduleTypes();
    const featuredRoles = Object.entries(types).filter(([, v]) => v.featured).map(([k]) => k);
    if (featuredRoles.length === 0) return res.json({ types, entries: [] });

    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const mon = new Date(now);
    mon.setUTCDate(now.getUTCDate() - daysToMon);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 13);

    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;

    // Fetch all entries for the two-week window, then filter to featured roles in JS
    // (avoids dynamic IN (?,?,?) spread which is unreliable with node:sqlite)
    const allEntries = db.prepare(`
      SELECT se.id, se.date, se.region, se.member_id, se.assignment,
             tm.first_name, tm.last_name
      FROM schedule_entries se
      JOIN team_members tm ON se.member_id = tm.id
      WHERE se.date >= ?
        AND se.date <= ?
      ORDER BY se.assignment, se.date, tm.last_name, tm.first_name
    `).all(fmt(mon), fmt(sun));
    const featuredSet = new Set(featuredRoles);
    const entries = allEntries.filter(e => featuredSet.has(e.assignment));

    res.json({ types, entries });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule: create entry ────────────────────────────────────────────────────

app.post('/api/schedule/entry', (req, res) => {
  try {
    const { date, member_id, assignment, region = 'US' } = req.body;
    if (!date || !member_id || !assignment) {
      return res.status(400).json({ error: 'date, member_id, and assignment are required.' });
    }
    const result = db.prepare(
      'INSERT INTO schedule_entries (date, region, member_id, assignment) VALUES (?, ?, ?, ?)'
    ).run(date, region, member_id, assignment);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule: delete entry ────────────────────────────────────────────────────

app.delete('/api/schedule/entry/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM schedule_entries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule: export / import ─────────────────────────────────────────────────

app.get('/api/schedule/export', (req, res) => {
  try {
    const { region, year } = req.query;
    let query = `
      SELECT se.date, se.region, tm.first_name, tm.last_name, se.assignment
      FROM schedule_entries se
      JOIN team_members tm ON se.member_id = tm.id
      WHERE 1=1
    `;
    const params = [];
    if (region) { query += ' AND se.region = ?';     params.push(region); }
    if (year)   { query += ' AND se.date LIKE ?';    params.push(`${year}-%`); }
    query += ' ORDER BY se.date, se.region, tm.last_name, tm.first_name';
    const entries = db.prepare(query).all(...params);
    const label   = [year, region].filter(Boolean).join('-') || 'all';
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${label}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(entries, null, 2));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/schedule/import', (req, res) => {
  try {
    const { entries, clearFirst = false, year, region } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be a JSON array.' });

    if (clearFirst) {
      let q = 'DELETE FROM schedule_entries WHERE 1=1';
      const p = [];
      if (region) { q += ' AND region = ?'; p.push(region); }
      if (year)   { q += ' AND date LIKE ?'; p.push(`${year}-%`); }
      db.prepare(q).run(...p);
    }

    let imported = 0, skipped = 0;
    for (const e of entries) {
      const { date, region: eRegion, first_name, last_name, assignment } = e;
      if (!date || !first_name || !last_name || !assignment) { skipped++; continue; }
      const reg    = eRegion || region || 'US';
      const member = db.prepare(
        'SELECT id FROM team_members WHERE first_name = ? AND last_name = ? AND region = ?'
      ).get(first_name, last_name, reg);
      if (!member) { skipped++; continue; }
      db.prepare('INSERT INTO schedule_entries (date, region, member_id, assignment) VALUES (?, ?, ?, ?)')
        .run(date, reg, member.id, assignment);
      imported++;
    }
    res.json({ imported, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule: get / update role types ─────────────────────────────────────────

app.get('/api/schedule/types', (req, res) => {
  res.json(getScheduleTypes());
});

app.put('/api/schedule/types', (req, res) => {
  try {
    const types = req.body;
    if (typeof types !== 'object' || Array.isArray(types)) {
      return res.status(400).json({ error: 'Invalid types object.' });
    }
    const typesPath = path.join(dataDir, 'schedule-types.json');
    fs.writeFileSync(typesPath, JSON.stringify(types, null, 2));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Rename a role — updates the types JSON key AND all schedule_entries rows atomically
app.put('/api/schedule/rename-role', (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName are required.' });
    if (oldName === newName)   return res.json({ updated: 0 });

    const types = getScheduleTypes();
    if (!types[oldName])       return res.status(404).json({ error: `Role "${oldName}" not found.` });
    if (types[newName])        return res.status(409).json({ error: `Role "${newName}" already exists.` });

    // Rebuild types object preserving insertion order, swapping the key
    const updated = {};
    for (const [k, v] of Object.entries(types)) {
      updated[k === oldName ? newName : k] = v;
    }
    const typesPath = path.join(dataDir, 'schedule-types.json');
    fs.writeFileSync(typesPath, JSON.stringify(updated, null, 2));

    // Rename all schedule entries that used the old role name
    const result = db.prepare('UPDATE schedule_entries SET assignment = ? WHERE assignment = ?').run(newName, oldName);
    res.json({ updated: result.changes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Assigner running → http://localhost:${PORT}`));
