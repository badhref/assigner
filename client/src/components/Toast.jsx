import { useEffect } from 'react'

const styles = {
  success: 'bg-emerald-500 text-white',
  error:   'bg-red-500 text-white',
  info:    'bg-slate-800 text-white dark:bg-slate-700',
}

export default function Toast({ message, type = 'info', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`
      fixed bottom-6 right-6 z-[1000] max-w-xs px-4 py-3
      rounded-xl text-[13px] font-semibold shadow-modal
      pointer-events-none
      animate-[toast_0.22s_ease]
      ${styles[type] || styles.info}
    `}>
      {message}
    </div>
  )
}
