import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

const PRESETS = [
  { color: '#1D4ED8', bg: '#DBEAFE' }, { color: '#7C3AED', bg: '#EDE9FE' },
  { color: '#059669', bg: '#D1FAE5' }, { color: '#D97706', bg: '#FEF3C7' },
  { color: '#DC2626', bg: '#FEE2E2' }, { color: '#0891B2', bg: '#CFFAFE' },
  { color: '#9333EA', bg: '#F3E8FF' }, { color: '#DB2777', bg: '#FCE7F3' },
  { color: '#15803D', bg: '#DCFCE7' }, { color: '#B45309', bg: '#FEF9C3' },
  { color: '#374151', bg: '#F3F4F6' }, { color: '#7F1D1D', bg: '#FFF1F2' },
]

const inputCls = `w-full px-2.5 py-1.5 text-[13px] border border-black/[0.08] dark:border-white/[0.08] rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-yellow focus:shadow-[0_0_0_3px_rgba(251,206,7,0.12)] transition-all`

export default function RolesEditor({ onChanged }) {
  const [types, setTypes]     = useState(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [newRole, setNewRole] = useState({ name: '', short: '', color: '#1D4ED8', bg: '#DBEAFE', featured: false, weekendOnly: false })
  const [renaming, setRenaming] = useState({ name: null, value: '' })

  useEffect(() => {
    api('GET', '/api/schedule/types').then(d => setTypes(d)).catch(() => setTypes({}))
  }, [])

  async function persist(updated) {
    setSaving(true); setError('')
    try { await api('PUT', '/api/schedule/types', updated); setTypes(updated); onChanged() }
    catch (err) { setError(err.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function toggleFeatured(name) { await persist({ ...types, [name]: { ...types[name], featured: !types[name].featured } }) }
  async function toggleWeekendOnly(name) { await persist({ ...types, [name]: { ...types[name], weekendOnly: !types[name].weekendOnly } }) }
  async function deleteRole(name) {
    if (!window.confirm(`Delete "${name}"? Existing schedule entries won't be deleted.`)) return
    const updated = { ...types }; delete updated[name]; await persist(updated)
  }
  async function commitRename() {
    const oldName = renaming.name, newName = renaming.value.trim()
    if (!newName || newName === oldName) { setRenaming({ name: null, value: '' }); return }
    if (types[newName]) { setError(`"${newName}" already exists.`); return }
    setSaving(true); setError('')
    try {
      await api('PUT', '/api/schedule/rename-role', { oldName, newName })
      const fresh = await api('GET', '/api/schedule/types')
      setTypes(fresh); onChanged(); setRenaming({ name: null, value: '' })
    } catch (err) { setError(err.message || 'Rename failed.') }
    finally { setSaving(false) }
  }
  async function addRole() {
    const name = newRole.name.trim(), short = newRole.short.trim().toUpperCase()
    if (!name || !short) { setError('Role name and short code are required.'); return }
    if (types[name]) { setError(`"${name}" already exists.`); return }
    setError('')
    await persist({ ...types, [name]: { color: newRole.color, bg: newRole.bg, short, featured: newRole.featured, weekendOnly: newRole.weekendOnly } })
    setNewRole({ name: '', short: '', color: '#1D4ED8', bg: '#DBEAFE', featured: false, weekendOnly: false })
  }

  if (!types) return <div className="p-8 text-center text-[13px] text-slate-400">Loading roles…</div>

  return (
    <div>
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-black/[0.06] dark:border-white/[0.05] text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Roles marked <strong className="text-slate-700 dark:text-slate-200">★</strong> appear in the Upcoming Coverage widget. A person can hold multiple roles on the same day.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              {['Role', 'Short Code', '★ Upcoming', '🏖 Weekdays', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.06em] border-b border-black/[0.06] dark:border-white/[0.05] whitespace-nowrap" style={i >= 2 && i <= 3 ? {textAlign:'center'} : {}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(types).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-[12.5px] text-slate-400 italic">No roles yet — add one below.</td></tr>
            )}
            {Object.entries(types).map(([name, t]) => {
              const isRenaming = renaming.name === name
              return (
                <tr key={name} className="border-b border-black/[0.04] dark:border-white/[0.03] last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold mr-2" style={{ background: t.bg, color: t.color }}>
                      {t.short}
                    </span>
                    {isRenaming ? (
                      <span className="inline-flex items-center gap-1.5">
                        <input autoFocus className={`${inputCls} !w-36 !py-1 !text-[12.5px]`}
                          value={renaming.value}
                          onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming({ name: null, value: '' }) }}
                        />
                        <button onClick={commitRename} disabled={saving}
                          className="px-2 py-0.5 bg-brand-yellow text-black text-[11.5px] font-bold rounded disabled:opacity-50">✓</button>
                        <button onClick={() => setRenaming({ name: null, value: '' })}
                          className="px-2 py-0.5 text-slate-400 text-[11.5px] hover:text-slate-600 dark:hover:text-slate-300">✕</button>
                      </span>
                    ) : (
                      <span>
                        {name}
                        <button onClick={() => setRenaming({ name, value: name })} disabled={saving}
                          className="ml-1.5 text-[12px] opacity-25 hover:opacity-100 transition-opacity">✏️</button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11.5px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-black/[0.06] dark:border-white/[0.05]">{t.short}</code>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleFeatured(name)} disabled={saving || isRenaming}
                      className={`text-base transition-opacity disabled:cursor-not-allowed ${t.featured ? 'opacity-100' : 'opacity-25 hover:opacity-70'}`}>
                      {t.featured ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleWeekendOnly(name)} disabled={saving || isRenaming}
                      className={`text-base transition-opacity disabled:cursor-not-allowed ${t.weekendOnly ? 'opacity-100' : 'opacity-25 hover:opacity-70'}`}>
                      {t.weekendOnly ? '🏖' : '—'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => deleteRole(name)} disabled={saving || isRenaming}
                      className="text-[12px] text-slate-300 dark:text-slate-600 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:cursor-not-allowed">
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add role */}
      <div className="px-5 py-5 border-t border-black/[0.06] dark:border-white/[0.05] bg-slate-50 dark:bg-slate-800/30">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.09em] mb-4">Add New Role</div>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.07em] mb-1.5">Role Name</label>
            <input className={inputCls} placeholder="e.g. On Call" value={newRole.name}
              onChange={e => setNewRole(r => ({ ...r, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.07em] mb-1.5">Short Code</label>
            <input className={inputCls} placeholder="ONC" maxLength={6} value={newRole.short}
              onChange={e => setNewRole(r => ({ ...r, short: e.target.value.toUpperCase() }))} />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.07em] mb-2">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <div key={i}
                onClick={() => setNewRole(r => ({ ...r, color: p.color, bg: p.bg }))}
                className={`w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border-2 ${newRole.color === p.color ? 'border-slate-700 dark:border-slate-200' : 'border-transparent'}`}
                style={{ background: `linear-gradient(135deg,${p.bg} 50%,${p.color} 50%)` }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: newRole.bg, color: newRole.color }}>
              {newRole.short || 'ABC'}
            </span>
            <span className="text-[11px] text-slate-400">preview</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={newRole.featured} onChange={e => setNewRole(r => ({ ...r, featured: e.target.checked }))} />
            Show in Upcoming (★)
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={newRole.weekendOnly} onChange={e => setNewRole(r => ({ ...r, weekendOnly: e.target.checked }))} />
            Weekends only
          </label>
          <button onClick={addRole} disabled={saving || !newRole.name.trim() || !newRole.short.trim()}
            className="px-4 py-1.5 bg-brand-yellow hover:bg-brand-yellow-dk text-black text-[12.5px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? 'Saving…' : '+ Add Role'}
          </button>
        </div>
      </div>
    </div>
  )
}
