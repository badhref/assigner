import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'

export default function InlineCell({ dateStr, member, region, types, isWeekend, initialEntries, active, onActivate, onChanged }) {
  const [localEntries, setLocalEntries] = useState(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef()

  const entries = active ? (localEntries !== null ? localEntries : initialEntries) : initialEntries

  useEffect(() => {
    if (active) { setLocalEntries(initialEntries); setSelected('') }
    else { setLocalEntries(null); setSelected('') }
  }, [active])

  useEffect(() => {
    if (!active) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onActivate(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active])

  const availableTypes = Object.keys(types).filter(name => {
    if (types[name].weekendOnly && !isWeekend) return false
    if (entries.some(e => e.assignment === name)) return false
    return true
  })

  async function handleAdd() {
    if (!selected || saving) return
    setSaving(true)
    try {
      const result = await api('POST', '/api/schedule/entry', { date: dateStr, member_id: member.id, assignment: selected, region })
      setLocalEntries(prev => [...(prev !== null ? prev : initialEntries), { id: result.id, assignment: selected }])
      setSelected('')
      onChanged()
    } catch {}
    finally { setSaving(false) }
  }

  async function handleRemove(id) {
    setLocalEntries(prev => (prev !== null ? prev : initialEntries).filter(e => e.id !== id))
    try { await api('DELETE', `/api/schedule/entry/${id}`); onChanged() }
    catch { setLocalEntries(initialEntries) }
  }

  const cellCls = `min-w-[80px] px-1.5 py-1.5 align-middle transition-colors`

  if (active) {
    return (
      <td ref={ref} className={`${cellCls} ring-2 ring-inset ring-brand-yellow`}>
        <div className="flex flex-wrap gap-1 mb-1">
          {entries.length === 0
            ? <span className="text-[11px] text-slate-400 italic">none</span>
            : entries.map(e => {
                const t = types[e.assignment] || {}
                return (
                  <span key={e.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold"
                    style={{ background: t.bg || '#eee', color: t.color || '#333' }}>
                    {t.short || e.assignment}
                    <button onClick={() => handleRemove(e.id)} className="opacity-60 hover:opacity-100 text-[9px]">✕</button>
                  </span>
                )
              })
          }
        </div>
        {availableTypes.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="text-[11px] px-1.5 py-0.5 border border-black/[0.08] dark:border-white/[0.08] rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="">+ add…</option>
              {availableTypes.map(name => {
                const t = types[name] || {}
                return <option key={name} value={name}>{t.short || name}</option>
              })}
            </select>
            {selected && (
              <button onClick={handleAdd} disabled={saving}
                className="px-1.5 py-0.5 bg-emerald-500 text-white text-[11px] font-bold rounded disabled:opacity-50">
                {saving ? '…' : '✓'}
              </button>
            )}
          </div>
        )}
      </td>
    )
  }

  return (
    <td ref={ref} className={`${cellCls} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 group`}
      onClick={() => onActivate(`${dateStr}|${member.id}`)}>
      <div className="flex flex-wrap gap-1 justify-center">
        {entries.map(e => {
          const t = types[e.assignment] || {}
          return (
            <span key={e.id} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-bold"
              style={{ background: t.bg || '#eee', color: t.color || '#333' }}>
              {t.short || e.assignment}
            </span>
          )
        })}
        {entries.length === 0 && (
          <span className="text-slate-300 dark:text-slate-700 text-sm opacity-0 group-hover:opacity-100 transition-opacity">+</span>
        )}
      </div>
    </td>
  )
}
