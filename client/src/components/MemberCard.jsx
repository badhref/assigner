import { useState } from 'react'
import { memberStatus, getReturnTime } from '../lib/api'

function CheckoutPanel({ onConfirm, onCancel }) {
  const [mins, setMins] = useState('30')
  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-black/[0.05] dark:border-white/[0.05]">
      <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">Out for:</span>
      <input
        type="number" min="1" max="480" value={mins}
        onChange={e => setMins(e.target.value)}
        className="w-12 text-center px-1.5 py-1 text-[12.5px] border border-black/[0.08] dark:border-white/[0.08] rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-yellow"
      />
      <span className="text-[11.5px] text-slate-400">min</span>
      <button
        onClick={() => onConfirm(Math.max(1, parseInt(mins) || 30))}
        className="px-2.5 py-1 text-[11.5px] font-semibold rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-200 transition-all"
      >
        Check Out
      </button>
      <button
        onClick={() => onConfirm(null)}
        className="px-2.5 py-1 text-[11.5px] font-semibold rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-200 transition-all"
      >
        Rest of Day
      </button>
      <button
        onClick={onCancel}
        className="px-2.5 py-1 text-[11.5px] font-medium rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

const statusDot = {
  in:    'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
  timed: 'bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]',
  out:   'bg-slate-300 dark:bg-slate-600',
}
const borderAccent = {
  in:    'border-l-emerald-400',
  timed: 'border-l-amber-400',
  out:   'border-l-transparent',
}

export default function MemberCard({ member, onCheckin, onCheckout, onRemove, onDragStart, onDragEnd, isDragging, balanceExcluded }) {
  const [showCheckout, setShowCheckout] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const status   = memberStatus(member)
  const returnAt = getReturnTime(member.checkout_until)
  const dimmed   = member.current_cycle_assigned || balanceExcluded
  const canDrag  = status === 'in'

  const statusLabel = status === 'in'
    ? 'Available'
    : status === 'timed' && returnAt
    ? `Returns ${returnAt}`
    : 'Out'

  return (
    <div className={`
      rounded-xl border-l-[3px] border border-black/[0.07] dark:border-white/[0.07]
      bg-white dark:bg-slate-900 overflow-hidden mb-1.5
      transition-all
      ${borderAccent[status]}
      ${dimmed ? 'opacity-40' : ''}
      ${canDrag && !isDragging ? 'hover:shadow-card' : ''}
      ${isDragging ? 'opacity-35' : ''}
    `}>
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={canDrag}
        onDragStart={canDrag ? e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(member.id) } : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot[status]}`} />

        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate">
            {member.first_name} {member.last_name}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{statusLabel}</div>
        </div>

        <div className="text-[11.5px] font-bold text-slate-300 dark:text-slate-600 min-w-[22px] text-right shrink-0">
          {member.pick_count}×
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {status === 'out' || status === 'timed' ? (
            <button
              onClick={() => onCheckin(member.id)}
              className="px-2.5 py-1 text-[11.5px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all"
            >
              Check In
            </button>
          ) : (
            <button
              onClick={() => setShowCheckout(v => !v)}
              className="px-2.5 py-1 text-[11.5px] font-semibold rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-400 hover:text-white hover:border-amber-400 transition-all"
            >
              Check Out
            </button>
          )}

          {confirmRemove ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-red-500 font-semibold">Remove?</span>
              <button onClick={() => { onRemove(member.id); setConfirmRemove(false) }}
                className="px-2 py-0.5 text-[11px] font-bold bg-red-500 text-white rounded-md border border-red-500">Yes</button>
              <button onClick={() => setConfirmRemove(false)}
                className="px-2 py-0.5 text-[11px] font-semibold text-slate-400 rounded-md border border-black/[0.08] dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-md border border-black/[0.07] dark:border-white/[0.07] text-slate-300 dark:text-slate-600 text-[11px] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/20 transition-all"
              title="Remove"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {showCheckout && (
        <CheckoutPanel
          onConfirm={mins => { setShowCheckout(false); onCheckout(member.id, mins) }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
