export default function PickModal({ pick, onConfirm, onUnavailable }) {
  const m = pick.member
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] p-5">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal w-full max-w-sm overflow-hidden border border-black/[0.08] dark:border-white/[0.07]">
        {/* Yellow header */}
        <div className="bg-brand-yellow px-6 py-5">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-black/40 mb-1">
            Selected for Assignment
          </div>
          <div className="text-[26px] font-extrabold text-black leading-tight tracking-tight">
            {m.first_name} {m.last_name}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="space-y-1 mb-4">
            <div className="text-[13px] text-slate-500 dark:text-slate-400">
              Status: <span className="font-semibold text-emerald-500">Available</span>
            </div>
            <div className="text-[13px] text-slate-500 dark:text-slate-400">
              Total assignments: <span className="font-semibold text-slate-800 dark:text-slate-200">{m.pick_count}</span>
            </div>
          </div>

          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Was the work item successfully assigned?
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirm}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-[14px] font-bold rounded-xl transition-all"
            >
              ✓ Yes, Assigned
            </button>
            <button
              onClick={onUnavailable}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 dark:text-slate-400 hover:text-red-500 text-[14px] font-semibold rounded-xl border border-black/[0.08] dark:border-white/[0.07] hover:border-red-200 dark:hover:border-red-500/20 transition-all"
            >
              ✕ Not Available
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
