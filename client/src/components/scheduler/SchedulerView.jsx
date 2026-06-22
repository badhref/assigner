import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import InlineCell from './InlineCell'
import RolesEditor from './RolesEditor'
import ImportExport from './ImportExport'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = d.getUTCFullYear()
  return Math.ceil((((d - Date.UTC(y, 0, 1)) / 86400000) + 1) / 7)
}

function p2(n) { return String(n).padStart(2, '0') }
function fmtDate(y, m, d) { return `${y}-${p2(m + 1)}-${p2(d)}` }

const tabCls = active =>
  `px-4 py-2 text-[12.5px] font-semibold rounded-lg transition-all ${
    active
      ? 'bg-brand-yellow text-black'
      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`

export default function SchedulerView({ region }) {
  const now = new Date()
  const [schedView, setSchedView]   = useState('calendar')
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [monthIdx, setMonthIdx]     = useState(now.getMonth())
  const [activeCell, setActiveCell] = useState(null)

  function loadData(background) {
    if (background) { setRefreshing(true) }
    else { setLoading(true); setFetchError(null) }
    api('GET', `/api/schedule?region=${region}&year=${selectedYear}`)
      .then(d => { setData(d); setLoading(false); setRefreshing(false) })
      .catch(err => {
        setFetchError(err.message || 'Failed to load schedule.')
        setData(null); setLoading(false); setRefreshing(false)
      })
  }

  useEffect(() => { loadData(false) }, [region, selectedYear])

  /* ── Sub-nav ─────────────────────────────────────────────────────────────── */
  const SubNav = () => (
    <div className="flex items-center gap-1.5 px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.05] flex-wrap">
      <button className={tabCls(schedView === 'calendar')} onClick={() => setSchedView('calendar')}>📅 Calendar</button>
      <button className={tabCls(schedView === 'roles')}    onClick={() => setSchedView('roles')}>⚙ Manage Roles</button>
      <button className={tabCls(schedView === 'backup')}   onClick={() => setSchedView('backup')}>📦 Backup</button>

      <div className="ml-auto flex items-center gap-1.5">
        {refreshing && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 animate-pulse">Refreshing…</span>
        )}
        <button
          onClick={() => setSelectedYear(y => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-base transition-all"
        >‹</button>
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 min-w-[44px] text-center">{selectedYear}</span>
        <button
          onClick={() => setSelectedYear(y => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-base transition-all"
        >›</button>
      </div>
    </div>
  )

  /* ── Sub-views ───────────────────────────────────────────────────────────── */
  if (schedView === 'roles') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />
        <RolesEditor onChanged={() => loadData(true)} />
      </div>
    )
  }

  if (schedView === 'backup') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />
        <ImportExport selectedYear={selectedYear} />
      </div>
    )
  }

  /* ── Calendar loading / error states ────────────────────────────────────── */
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />
        <div className="px-6 py-12 text-center text-[13px] text-slate-400">Loading schedule…</div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />
        <div className="px-6 py-12 text-center text-[13px] text-red-500">
          ⚠ Could not load schedule: <strong>{fetchError}</strong>
        </div>
      </div>
    )
  }

  const types   = data?.types   || {}
  const entries = data?.entries || []
  const members = data?.members || []

  /* ── Build lookup & summary ──────────────────────────────────────────────── */
  const lookup = {}
  for (const e of entries) {
    const k = `${e.date}|${e.member_id}`
    if (!lookup[k]) lookup[k] = []
    lookup[k].push({ id: e.id, assignment: e.assignment })
  }

  const summary = {}
  for (const e of entries) {
    if (!summary[e.assignment]) summary[e.assignment] = {}
    summary[e.assignment][e.member_id] = (summary[e.assignment][e.member_id] || 0) + 1
  }

  const daysInMonth = new Date(Date.UTC(selectedYear, monthIdx + 1, 0)).getUTCDate()
  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate())

  if (members.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />
        <div className="px-6 py-12 text-center text-[13px] text-slate-400">
          No team members in <strong>{region}</strong> yet.
        </div>
      </div>
    )
  }

  const thCls = `px-3 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.06em] border-b border-black/[0.06] dark:border-white/[0.05] whitespace-nowrap bg-slate-50 dark:bg-slate-800/50`

  return (
    <div className="flex flex-col gap-4">
      {/* ── Card shell ── */}
      <div className="bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.07] rounded-2xl shadow-card overflow-hidden">
        <SubNav />

        {/* Month navigation */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.04]">
          <button
            onClick={() => setMonthIdx(m => (m + 11) % 12)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-base transition-all"
          >‹</button>
          <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100 min-w-[110px]">{MONTHS[monthIdx]}</span>
          <button
            onClick={() => setMonthIdx(m => (m + 1) % 12)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-base transition-all"
          >›</button>
          {(monthIdx !== now.getMonth() || selectedYear !== now.getFullYear()) && (
            <button
              onClick={() => { setMonthIdx(now.getMonth()); setSelectedYear(now.getFullYear()) }}
              className="ml-1 px-2.5 py-1 text-[11.5px] font-semibold text-brand-yellow border border-brand-yellow/30 rounded-lg hover:bg-brand-yellow/10 transition-colors"
            >Today</button>
          )}
        </div>

        {/* Year-to-date summary table */}
        {Object.keys(types).length > 0 && (
          <div className="border-b border-black/[0.06] dark:border-white/[0.05]">
            <div className="px-5 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.09em]">
              Year-to-Date Summary
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${thCls} text-left`} style={{ minWidth: 160 }}>Role</th>
                    {members.map(m => (
                      <th key={m.id} className={thCls} style={{ textAlign: 'center' }}>
                        {m.first_name}<br />
                        <span className="font-normal opacity-60">{m.last_name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(types).map(([name, t]) => (
                    <tr key={name} className="border-b border-black/[0.04] dark:border-white/[0.03] last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-bold mr-1.5"
                          style={{ background: t.bg, color: t.color }}>
                          {t.short}
                        </span>
                        <span className="text-[12.5px] text-slate-700 dark:text-slate-300">{name}</span>
                        {t.featured && <span className="ml-1 text-[11px] text-brand-yellow-dk font-bold">★</span>}
                      </td>
                      {members.map(m => {
                        const cnt = (summary[name]?.[m.id]) || 0
                        return (
                          <td key={m.id} className="px-3 py-2 text-center text-[12px]"
                            style={{ opacity: cnt === 0 ? 0.25 : 1 }}>
                            {cnt === 0 ? '—' : cnt}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly calendar grid */}
        <div>
          <div className="px-5 py-2.5 flex items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.03]">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.09em]">
              {MONTHS[monthIdx]} {selectedYear}
            </span>
            <span className="text-[10px] text-slate-300 dark:text-slate-600">· Click any cell to edit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr>
                  <th className={`${thCls} w-8 text-center`}>Wk</th>
                  <th className={`${thCls} w-8 text-center`}>Day</th>
                  <th className={`${thCls} w-8 text-center`}></th>
                  {members.map(m => (
                    <th key={m.id} className={thCls} style={{ textAlign: 'center' }}>
                      {m.first_name}<br />
                      <span className="font-normal opacity-60">{m.last_name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dt  = new Date(Date.UTC(selectedYear, monthIdx, day))
                  const dow = dt.getUTCDay()
                  const dateStr   = fmtDate(selectedYear, monthIdx, day)
                  const isWeekend = dow === 0 || dow === 6
                  const isToday   = dateStr === todayStr
                  const showWk    = dow === 1
                  const wk        = showWk ? isoWeek(dt) : ''

                  const rowBg = isToday
                    ? 'bg-brand-yellow/[0.07] dark:bg-brand-yellow/[0.05]'
                    : isWeekend
                    ? 'bg-slate-50/60 dark:bg-slate-800/20'
                    : ''

                  return (
                    <tr key={day} className={`border-b border-black/[0.04] dark:border-white/[0.03] last:border-0 ${rowBg}`}>
                      <td className="px-2 py-0.5 text-center text-[10px] text-slate-300 dark:text-slate-700 align-middle">
                        {wk}
                      </td>
                      <td className={`px-2 py-0.5 text-center text-[12px] font-semibold align-middle whitespace-nowrap ${
                        isToday ? 'text-brand-yellow-dk' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {p2(day)}
                      </td>
                      <td className="px-2 py-0.5 text-center text-[10px] text-slate-300 dark:text-slate-700 align-middle">
                        {DAYS[dow]}
                      </td>
                      {members.map(m => {
                        const k = `${dateStr}|${m.id}`
                        return (
                          <InlineCell
                            key={m.id}
                            dateStr={dateStr}
                            member={m}
                            region={region}
                            types={types}
                            isWeekend={isWeekend}
                            initialEntries={lookup[k] || []}
                            active={activeCell === k}
                            onActivate={setActiveCell}
                            onChanged={() => loadData(true)}
                          />
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
