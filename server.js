const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auto check-out logic ──────────────────────────────────────────────────────
// Fires once at 5 PM and once at midnight. Timed check-back-ins run every 30s.

let lastAutoCheckoutHour = -1;

function runScheduledTasks() {
  const hour = new Date().getHours();

  // Auto-checkout at 5 PM (17) and midnight (0) — fires once per hour
  if (hour === 17 || hour === 0) {
    if (hour !== lastAutoCheckoutHour) {
      lastAutoCheckoutHour = hour;
      db.prepare(`
        UPDATE team_members
        SET is_checked_in = 0, checked_in_at = NULL, checkout_until = NULL
        WHERE is_checked_in = 1 OR checkout_until IS NOT NULL
      `).run();
      console.log(`Auto-checkout ran at ${hour === 17 ? '5:00 PM' : 'midnight'}`);
    }
  } else {
    lastAutoCheckoutHour = -1; // reset so it fires again next time

    // Auto check back in anyone whose timed checkout has expired
    db.prepare(`
      UPDATE team_members
      SET is_checked_in = 1, checkout_until = NULL
      WHERE is_checked_in = 0
        AND checkout_until IS NOT NULL
        AND checkout_until <= datetime('now')
    `).run();
  }
}

setInterval(runScheduledTasks, 30 * 1000); // check every 30 seconds

// ── Members ───────────────────────────────────────────────────────────────────

app.get('/api/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT * FROM team_members
      ORDER BY is_checked_in DESC, last_name, first_name
    `).all();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/members', (req, res) => {
  try {
    const { first_name, last_name } = req.body;
    if (!first_name?.trim() || !last_name?.trim()) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    const result = db.prepare(
      'INSERT INTO team_members (first_name, last_name) VALUES (?, ?)'
    ).run(first_name.trim(), last_name.trim());

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
      SET is_checked_in = 1, checked_in_at = CURRENT_TIMESTAMP, checkout_until = NULL
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
    const { duration_minutes } = req.body; // optional — omit or 0 for manual (no timer)

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

// Manual pick — directly nominate a specific checked-in member
app.post('/api/members/:id/pick', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    if (!member.is_checked_in) return res.status(400).json({ error: 'Member is not checked in.' });

    // If all checked-in members are already assigned, the cycle is exhausted.
    // Close it now so this manual pick starts a fresh cycle — same rule as random pick.
    const checkedIn = db.prepare('SELECT current_cycle_assigned FROM team_members WHERE is_checked_in = 1').all();
    const cycleExhausted = checkedIn.length > 0 && checkedIn.every(m => m.current_cycle_assigned);
    if (cycleExhausted) {
      db.prepare("INSERT INTO cycle_events (occurred_at) VALUES (datetime('now'))").run();
      db.prepare('UPDATE team_members SET current_cycle_assigned = 0 WHERE is_checked_in = 1').run();
    }

    const result = db.prepare('INSERT INTO pick_history (member_id) VALUES (?)').run(member.id);
    res.json({ pick_id: result.lastInsertRowid, member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pick', (req, res) => {
  try {
    const checkedIn = db.prepare('SELECT * FROM team_members WHERE is_checked_in = 1').all();
    if (checkedIn.length === 0) {
      return res.status(400).json({ error: 'No available team members are checked in.' });
    }

    const balanced = req.body && req.body.balanced;

    if (balanced) {
      // ── Balance mode ────────────────────────────────────────────────────────
      // Exclude anyone at the highest pick_count until everyone else catches up.
      // Weight remaining pool so those furthest behind are most likely to be picked.
      const maxCount = Math.max(...checkedIn.map(m => m.pick_count));
      const minCount = Math.min(...checkedIn.map(m => m.pick_count));
      let pool = maxCount === minCount ? checkedIn : checkedIn.filter(m => m.pick_count < maxCount);

      // Prevent more than 2 consecutive picks of the same person.
      // If the last 2 confirmed picks were the same member, exclude them unless
      // they are the only one available.
      const lastTwo = db.prepare(`
        SELECT member_id FROM pick_history
        WHERE confirmed = 1
        ORDER BY confirmed_at DESC LIMIT 2
      `).all();
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

    // ── Cycle mode (default) ─────────────────────────────────────────────────
    let pool = checkedIn.filter(m => !m.current_cycle_assigned);

    if (pool.length === 0) {
      db.prepare('INSERT INTO cycle_events (occurred_at) VALUES (datetime(\'now\'))').run();
      db.prepare('UPDATE team_members SET current_cycle_assigned = 0 WHERE is_checked_in = 1').run();
      pool = db.prepare('SELECT * FROM team_members WHERE is_checked_in = 1').all();
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
    const history = db.prepare(`
      SELECT 'pick' as type, ph.id, ph.confirmed_at as ts, tm.first_name, tm.last_name
      FROM pick_history ph
      JOIN team_members tm ON ph.member_id = tm.id
      WHERE ph.confirmed = 1

      UNION ALL

      SELECT 'cycle' as type, ce.id, ce.occurred_at as ts, NULL as first_name, NULL as last_name
      FROM cycle_events ce

      ORDER BY ts DESC
      LIMIT 50
    `).all();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Master reset ──────────────────────────────────────────────────────────────

app.post('/api/reset', (req, res) => {
  try {
    db.prepare(`
      UPDATE team_members
      SET pick_count = 0, current_cycle_assigned = 0,
          is_checked_in = 0, checked_in_at = NULL, checkout_until = NULL
    `).run();
    db.prepare('DELETE FROM pick_history').run();
    db.prepare('DELETE FROM cycle_events').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Assigner running → http://localhost:${PORT}`));
