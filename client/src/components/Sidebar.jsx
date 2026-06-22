export default function Sidebar({ view, setView, region, setRegion, darkMode, setDarkMode, available, total, totalAssign }) {
  const navItems = [
    { id: 'assigner',  label: 'Assigner',  icon: '⚡' },
    { id: 'scheduler', label: 'Scheduler', icon: '📅' },
  ]

  const stats = [
    { label: 'Available',          value: available,   green: true },
    { label: 'Total Members',      value: total },
    { label: 'Assignments (all)',  value: totalAssign },
  ]

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-56 bg-sidebar flex flex-col z-50 border-r border-white/[0.04]">

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05] shrink-0">
        <div className="w-9 h-9 bg-brand-yellow rounded-xl flex items-center justify-center shrink-0">
          <img src="/shell-logo.png" className="w-[22px] h-[22px] object-contain block" alt="Shell" />
        </div>
        <div>
          <div className="text-white font-bold text-[15px] leading-tight tracking-tight">Assigner</div>
          <div className="text-white/30 text-[10.5px] mt-0.5 font-normal">Work Assignment Tool</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2.5 pt-3 shrink-0">
        <div className="text-[9.5px] font-bold text-white/25 uppercase tracking-[0.1em] px-2 pb-1.5">
          Navigation
        </div>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`
              flex items-center gap-2.5 w-full px-2.5 py-[9px] rounded-lg
              text-[13px] font-medium mb-0.5 transition-colors text-left
              ${view === item.id
                ? 'bg-brand-yellow/[0.13] text-brand-yellow font-semibold'
                : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
              }
            `}
          >
            <span className="text-sm w-[18px] text-center shrink-0">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Region */}
      <div className="px-2.5 pt-3 shrink-0">
        <div className="text-[9.5px] font-bold text-white/25 uppercase tracking-[0.1em] px-2 pb-2">
          Region
        </div>
        <div className="flex gap-1.5">
          {['US', 'NL', 'BNG'].map(r => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`
                flex-1 py-1.5 rounded-md text-[11px] font-bold border transition-all
                ${region === r
                  ? 'bg-brand-yellow border-brand-yellow text-black'
                  : 'border-white/10 text-white/40 hover:border-white/22 hover:text-white/70'
                }
              `}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-2.5 pt-4 flex-1 overflow-hidden">
        {stats.map(s => (
          <div
            key={s.label}
            className="flex items-center justify-between px-2.5 py-2 bg-white/[0.04] rounded-lg border border-white/[0.05] mb-1.5"
          >
            <span className="text-[11px] text-white/35 font-medium">{s.label}</span>
            <span className={`text-[15px] font-extrabold tracking-tight ${s.green && s.value > 0 ? 'text-emerald-400' : 'text-white/75'}`}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Theme toggle */}
      <div className="px-2.5 py-3 border-t border-white/[0.05] shrink-0">
        <button
          onClick={() => setDarkMode(d => !d)}
          className="flex items-center gap-2.5 w-full px-2.5 py-[9px] rounded-lg text-white/40 text-[12.5px] font-medium hover:bg-white/[0.06] hover:text-white/70 transition-colors"
        >
          <span className="text-sm">{darkMode ? '☀️' : '🌙'}</span>
          <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  )
}
