import { useState, useEffect } from 'react'
import MemberCard from './MemberCard'
import { api, fmtDateTime } from '../lib/api'

/* ── Card shell ─────────────────────────────────────────────────────────────── */
function Card({ title, badge, badgeYellow, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.04]">
        <span className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.09em]">{title}</span>
        {badge !== undefined && (
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
            badgeYellow
              ? 'bg-brand-yellow text-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-black/[0.07] dark:border-white/[0.07]'
          }`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ── Register form ──────────────────────────────────────────────────────────── */
function RegisterForm({ onAdded, region }) {
  const [form, setForm] = useState({ first_name: '', last_name: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('First and last name are required.')
    setBusy(true); setError('')
    try {
      const member = await api('POST', '/api/members', { ...form, region })
      onAdded(member)
      setForm({ first_name: '', last_name: '' })
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const inputCls = `w-full px-3 py-2 text-[13.5px] border border-black/[0.08] dark:border-white/[0.08] rounded-lg
    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100
    outline-none focus:border-brand-yellow focus:shadow-[0_0_0_3px_rgba(251,206,7,0.14)] focus:bg-white dark:focus:bg-slate-900
    placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all`

  return (
    <form onSubmit={submit} className="px-5 py-4">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[100px]">
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.07em] mb-1.5">First Name</label>
          <input type="text" placeholder="Jane" value={form.first_name} onChange={set('first_name')} className={inputCls} />
        </div>
        <div className="flex-1 min-w-[100px]">
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.07em] mb-1.5">Last Name</label>
          <input type="text" placeholder="Smith" value={form.last_name} onChange={set('last_name')} className={inputCls} />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={busy}
            className="px-4 py-2 bg-brand-yellow hover:bg-brand-yellow-dk active:scale-[0.97] disabled:opacity-40 text-black text-[13px] font-bold rounded-lg transition-all">
            {busy ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>
      {error && <p className="text-[11.5px] text-red-500 mt-2">{error}</p>}
    </form>
  )
}

/* ── Upcoming widget ────────────────────────────────────────────────────────── */
function UpcomingWidget() {
  const [data, setData] = useState(null)

  useEffect(() => {
    function load() {
      api('GET', '/api/schedule/upcoming')
        .then(d => setData(d))
        .catch(() => setData({ types: {}, entries: [] }))
    }
    load()
    const poll = setInterval(load, 30000)
    return () => clearInterval(poll)
  }, [])

  if (!data) return <p className="text-[12px] text-slate-400 italic">Loading…</p>

  const now = new Date()
  const dow = now.getUTCDay()
  const daysToMon = dow === 0 ? 6 : dow - 1
  const mon = new Date(now); mon.setUTCDate(now.getUTCDate() - daysToMon)
  const nextMon = new Date(mon); nextMon.setUTCDate(mon.getUTCDate() + 7)
  const p = n => String(n).padStart(2, '0')
  const nextMonStr = `${nextMon.getUTCFullYear()}-${p(nextMon.getUTCMonth()+1)}-${p(nextMon.getUTCDate())}`

  const REGIONS = ['US', 'NL', 'BNG']
  const REGION_COLORS = { US: '#3B82F6', NL: '#10B981', BNG: '#F59E0B' }
  const roleOrder = Object.keys(data.types)
  const DAY_ABBR  = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']

  function emptyBucket() {
    const b = {}; REGIONS.forEach(r => { b[r] = {} }); return b
  }
  const thisWeek = emptyBucket(), nextWeek = emptyBucket()

  for (const e of data.entries) {
    const bucket = e.date < nextMonStr ? thisWeek : nextWeek
    const reg = e.region || 'US'
    if (!bucket[reg]) bucket[reg] = {}
    if (!bucket[reg][e.assignment]) bucket[reg][e.assignment] = {}
    const fullName = `${e.first_name} ${e.last_name}`
    if (!bucket[reg][e.assignment][fullName]) bucket[reg][e.assignment][fullName] = { name: fullName, dates: [] }
    bucket[reg][e.assignment][fullName].dates.push(e.date)
  }

  function dateDow(ds) { const [y,m,d] = ds.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay() }

  function RegionBlock({ region, roleBucket }) {
    const allRoles = [...new Set([...roleOrder, ...Object.keys(roleBucket)])]
    const rows = []
    for (const role of allRoles) {
      if (!roleBucket[role]) continue
      const t = data.types[role] || {}
      const people = Object.values(roleBucket[role])
      const showDays = people.length > 1
      for (const person of people) {
        const dayStr = showDays ? [...person.dates].sort().map(d => DAY_ABBR[dateDow(d)]).join(', ') : ''
        rows.push({ role, name: person.name, dayStr, t })
      }
    }
    if (rows.length === 0) return null
    const color = REGION_COLORS[region] || '#94A3B8'
    return (
      <div className="mb-2">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] mb-1 pb-0.5 border-b border-current/20" style={{ color }}>{region}</div>
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline gap-1 flex-wrap text-[12.5px] py-0.5">
            <span className="font-bold text-[11.5px]" style={{ color: r.t.color || '#94A3B8' }}>{r.role}</span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{r.name}</span>
            {r.dayStr && <span className="text-slate-400 text-[11px]">({r.dayStr})</span>}
          </div>
        ))}
      </div>
    )
  }

  function WeekSection({ label, bucket }) {
    const hasAny = REGIONS.some(r => Object.keys(bucket[r] || {}).length > 0)
    return (
      <div className="mb-3">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500 mb-1.5">{label}</div>
        {!hasAny
          ? <p className="text-[12px] text-slate-400 dark:text-slate-500 italic">No featured coverage scheduled.</p>
          : REGIONS.map(r => <RegionBlock key={r} region={r} roleBucket={bucket[r] || {}} />)
        }
      </div>
    )
  }

  return (
    <div>
      <WeekSection label="This Week" bucket={thisWeek} />
      <WeekSection label="Next Week" bucket={nextWeek} />
    </div>
  )
}

/* ── Reset card ─────────────────────────────────────────────────────────────── */
function ResetCard({ onReset }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Card title="Master Reset">
      <div className="px-5 py-4">
        {confirming ? (
          <>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Resets all assignment counts, clears cycle progress, checks everyone out, and erases history. The roster is not affected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { onReset(); setConfirming(false) }}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold rounded-full transition-colors"
              >
                Reset Everything
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-[12px] text-slate-400 border border-black/[0.08] dark:border-white/[0.08] rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-1.5 text-[12px] text-slate-400 font-medium border border-black/[0.08] dark:border-white/[0.08] rounded-full hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            Reset All Assignments &amp; History
          </button>
        )}
      </div>
    </Card>
  )
}

/* ── Assign panel ───────────────────────────────────────────────────────────── */
function AssignPanel({ available, total, assignedThisCycle, balanceMode, setBalanceMode, picking, dropOver, draggingId, handlePick, handleDropZoneEnter, handleDropZoneLeave, handleDropZoneOver, handleDrop }) {
  return (
    <Card title="Assign Work Item">
      <div className="px-5 py-4">
        {total > 0 && (
          <div className="flex gap-2 mb-4">
            {[
              { val: available, lbl: 'Available', green: true },
              { val: total - available, lbl: 'Out' },
              ...(!balanceMode ? [{ val: `${assignedThisCycle}/${available || total}`, lbl: 'This Cycle' }] : []),
            ].map(s => (
              <div key={s.lbl} className="flex-1 text-center py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.05] rounded-xl">
                <div className={`text-[22px] font-extrabold leading-none tracking-tight ${s.green && available > 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}>{s.val}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500 mt-1">{s.lbl}</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handlePick}
          disabled={picking || available === 0}
          onDragEnter={handleDropZoneEnter}
          onDragLeave={handleDropZoneLeave}
          onDragOver={handleDropZoneOver}
          onDrop={handleDrop}
          className={`
            w-full py-4 rounded-xl text-[15px] font-extrabold tracking-tight transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            ${dropOver
              ? 'bg-emerald-500 text-white shadow-btn-green'
              : 'bg-brand-yellow hover:bg-brand-yellow-dk hover:-translate-y-px hover:shadow-btn-yellow text-black active:translate-y-0 active:shadow-none'
            }
          `}
        >
          {dropOver ? '⚡ Drop to Assign' : picking ? 'Selecting…' : '⚡ Assign Someone'}
        </button>

        {draggingId
          ? <p className="text-[11.5px] text-emerald-500 font-semibold text-center mt-2">Drop here to manually assign</p>
          : <p className="text-[11.5px] text-slate-400 dark:text-slate-500 text-center mt-2 leading-relaxed">
              {available === 0
                ? total === 0 ? 'Add team members to get started.' : 'No one is checked in right now.'
                : balanceMode
                  ? `Balancing across ${available} available — fewer assignments go first.`
                  : `Picks from ${available} available — each person once per cycle.`}
            </p>
        }

        {/* Balance toggle */}
        <div
          onClick={() => setBalanceMode(b => !b)}
          className="flex items-center gap-2.5 mt-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-black/[0.06] dark:border-white/[0.05] cursor-pointer select-none hover:border-brand-yellow/40 transition-colors"
        >
          <div className={`w-8 h-[18px] rounded-full relative transition-colors ${balanceMode ? 'bg-brand-yellow' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${balanceMode ? 'left-[18px]' : 'left-0.5'}`} />
          </div>
          <span className={`text-[12.5px] font-semibold ${balanceMode ? 'text-amber-600 dark:text-brand-yellow' : 'text-slate-500 dark:text-slate-400'}`}>
            Balance Us
          </span>
        </div>
        {balanceMode && (
          <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
            Cycles paused. Members with fewer total assignments are picked first.
          </p>
        )}
      </div>
    </Card>
  )
}

/* ── History panel ──────────────────────────────────────────────────────────── */
function HistoryPanel({ history }) {
  const pickCount = history.filter(h => h.type === 'pick').length
  return (
    <Card title="Assignment History" badge={pickCount}>
      <div className="px-5 py-3">
        {history.length === 0 ? (
          <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-4">No assignments yet.</p>
        ) : (
          <div>
            {(() => {
              let pastCycle = false
              return history.map(item => {
                if (item.type === 'cycle') {
                  pastCycle = true
                  return (
                    <div key={`cycle-${item.id}`} className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-black/[0.05] dark:bg-white/[0.04]" />
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        ⚡ New Cycle — {fmtDateTime(item.ts)}
                      </span>
                      <div className="flex-1 h-px bg-black/[0.05] dark:bg-white/[0.04]" />
                    </div>
                  )
                }
                return (
                  <div key={`pick-${item.id}`} className={`flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.03] last:border-0 transition-opacity ${pastCycle ? 'opacity-45' : ''}`}>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {item.first_name} {item.last_name}
                      </div>
                      <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5">{fmtDateTime(item.ts)}</div>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ✓ Assigned
                    </span>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
    </Card>
  )
}

/* ── AssignerView ───────────────────────────────────────────────────────────── */
export default function AssignerView({
  members, history, region,
  onAdded, onCheckin, onCheckout, onRemove,
  onPick, onReset,
  picking, dropOver, draggingId,
  handleDragStart, handleDragEnd,
  handleDropZoneEnter, handleDropZoneLeave, handleDropZoneOver, handleDrop,
  balanceMode, setBalanceMode,
  assignedThisCycle, balanceAllEqual, balanceMaxCount,
}) {
  const available         = members.filter(m => m.is_checked_in).length
  const total             = members.length
  const showCycleLegend   = total > 0 && assignedThisCycle > 0

  return (
    <div className="grid grid-cols-[310px_1fr] gap-4 items-start">
      {/* Left */}
      <div className="flex flex-col gap-3.5">
        <Card title={`Add Team Member — ${region}`}>
          <RegisterForm onAdded={onAdded} region={region} />
        </Card>

        <Card title="Team Roster" badge={total}>
          <div className="px-5 py-3">
            {showCycleLegend && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-yellow/[0.07] border border-brand-yellow/20 rounded-lg text-[12px] text-slate-600 dark:text-slate-400 font-medium mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow shrink-0" />
                {assignedThisCycle} of {available || total} assigned this cycle
              </div>
            )}
            {total === 0 ? (
              <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-6 leading-relaxed">
                No one on the roster yet.<br />Add yourself above.
              </p>
            ) : (
              <div>
                {members.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    onCheckin={onCheckin}
                    onCheckout={onCheckout}
                    onRemove={onRemove}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingId === m.id}
                    balanceExcluded={balanceMode && !balanceAllEqual && m.is_checked_in && m.pick_count >= balanceMaxCount}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Right */}
      <div className="flex flex-col gap-3.5">
        <AssignPanel
          available={available} total={total} assignedThisCycle={assignedThisCycle}
          balanceMode={balanceMode} setBalanceMode={setBalanceMode}
          picking={picking} dropOver={dropOver} draggingId={draggingId}
          handlePick={onPick}
          handleDropZoneEnter={handleDropZoneEnter}
          handleDropZoneLeave={handleDropZoneLeave}
          handleDropZoneOver={handleDropZoneOver}
          handleDrop={handleDrop}
        />

        <Card title="Upcoming Coverage" badge="★" badgeYellow>
          <div className="px-5 py-4">
            <UpcomingWidget />
          </div>
        </Card>

        <HistoryPanel history={history} />
        <ResetCard onReset={onReset} />
      </div>
    </div>
  )
}
