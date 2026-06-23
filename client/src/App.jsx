import { useState, useEffect, useCallback, useRef } from 'react'
import { api, sortMembers } from './lib/api'
import Sidebar from './components/Sidebar'
import AssignerView from './components/AssignerView'
import SchedulerView from './components/scheduler/SchedulerView'
import PickModal from './components/PickModal'
import Toast from './components/Toast'

export default function App() {
  const [members, setMembers]         = useState([])
  const [history, setHistory]         = useState([])
  const [pendingPick, setPendingPick] = useState(null)
  const [picking, setPicking]         = useState(false)
  const [toast, setToast]             = useState(null)
  const [darkMode, setDarkMode]       = useState(() => localStorage.getItem('theme') === 'dark')
  const [draggingId, setDraggingId]   = useState(null)
  const [dropOver, setDropOver]       = useState(false)
  const [balanceMode, setBalanceMode] = useState(false)
  const [region, setRegion]           = useState(() => localStorage.getItem('region') || 'US')
  const [view, setView]               = useState('assigner')
  const dragCounter                   = useRef(0)

  /* ── Theme & region persistence ─────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => { localStorage.setItem('region', region) }, [region])

  /* ── Toast helper ───────────────────────────────────────────────────────── */
  const showToast = (message, type = 'info') => setToast({ message, type })

  /* ── Data loading ───────────────────────────────────────────────────────── */
  const loadMembers = useCallback(async () => {
    const data = await api('GET', `/api/members?region=${region}`).catch(() => [])
    setMembers(sortMembers(data))
  }, [region])

  const loadHistory = useCallback(async () => {
    const data = await api('GET', `/api/history?region=${region}`).catch(() => [])
    setHistory(data)
  }, [region])

  useEffect(() => {
    loadMembers()
    loadHistory()
    const poll = setInterval(loadMembers, 30000)
    return () => clearInterval(poll)
  }, [loadMembers, loadHistory])

  /* ── Member handlers ────────────────────────────────────────────────────── */
  function handleAdded(member) {
    setMembers(prev => sortMembers([...prev, member]))
    showToast(`${member.first_name} ${member.last_name} added.`, 'success')
  }

  async function handleCheckin(id) {
    try {
      const updated = await api('POST', `/api/members/${id}/checkin`)
      setMembers(prev => sortMembers(prev.map(m => m.id === id ? updated : m)))
      showToast("Checked in — you're in the pool.", 'success')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleCheckout(id, duration_minutes) {
    try {
      const updated = await api('POST', `/api/members/${id}/checkout`, { duration_minutes })
      setMembers(prev => sortMembers(prev.map(m => m.id === id ? updated : m)))
      showToast(duration_minutes ? 'Checked out — timer set.' : 'Checked out for the rest of the day.', 'info')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleRemove(id) {
    try {
      await api('DELETE', `/api/members/${id}`)
      setMembers(prev => prev.filter(m => m.id !== id))
      showToast('Removed.', 'info')
    } catch { showToast('Could not remove.', 'error') }
  }

  /* ── Pick handlers ──────────────────────────────────────────────────────── */
  async function handlePick() {
    setPicking(true)
    try {
      const result = await api('POST', '/api/pick', balanceMode ? { balanced: true, region } : { region })
      setPendingPick(result)
    } catch (err) { showToast(err.message || 'Could not pick.', 'error') }
    finally { setPicking(false) }
  }

  async function handleManualPick(id) {
    try {
      const result = await api('POST', `/api/members/${id}/pick`)
      setPendingPick(result)
    } catch (err) { showToast(err.message || 'Could not assign.', 'error') }
  }

  async function handleConfirm() {
    try {
      await api('POST', `/api/pick/${pendingPick.pick_id}/confirm`)
      const name  = `${pendingPick.member.first_name} ${pendingPick.member.last_name}`
      const fresh = await api('GET', `/api/members?region=${region}`).catch(() => null)
      const sorted = fresh ? sortMembers(fresh) : null

      if (balanceMode) {
        if (sorted) {
          const checkedIn  = sorted.filter(m => m.is_checked_in)
          const counts     = checkedIn.map(m => m.pick_count)
          const isBalanced = checkedIn.length > 0 && counts.every(c => c === counts[0])
          if (isBalanced) {
            setMembers(sorted.map(m => ({ ...m, current_cycle_assigned: 0 })))
            setBalanceMode(false)
            showToast('Balance reached — switching back to cycle mode.', 'success')
          } else {
            setMembers(sorted)
            showToast(`Assigned to ${name}.`, 'success')
          }
        } else { showToast(`Assigned to ${name}.`, 'success') }
      } else {
        if (sorted) {
          const checkedIn     = sorted.filter(m => m.is_checked_in)
          const cycleComplete = checkedIn.length > 0 && checkedIn.every(m => m.current_cycle_assigned)
          setMembers(cycleComplete ? sorted.map(m => ({ ...m, current_cycle_assigned: 0 })) : sorted)
        }
        showToast(`Assigned to ${name}.`, 'success')
      }
      setPendingPick(null)
      loadHistory()
    } catch { showToast('Failed to confirm.', 'error') }
  }

  async function handleUnavailable() {
    try { await api('POST', `/api/pick/${pendingPick.pick_id}/cancel`) } catch {}
    setPendingPick(null)
    showToast('Cancelled — try again.', 'info')
  }

  async function handleReset() {
    try {
      await api('POST', '/api/reset', { region })
      await loadMembers()
      await loadHistory()
      showToast('Reset complete.', 'info')
    } catch { showToast('Reset failed.', 'error') }
  }

  /* ── Drag-and-drop handlers ─────────────────────────────────────────────── */
  function handleDragStart(id) { setDraggingId(id) }
  function handleDragEnd()     { setDraggingId(null); setDropOver(false); dragCounter.current = 0 }
  function handleDropZoneEnter(e) { e.preventDefault(); dragCounter.current += 1; if (draggingId) setDropOver(true) }
  function handleDropZoneLeave()  { dragCounter.current -= 1; if (dragCounter.current <= 0) { setDropOver(false); dragCounter.current = 0 } }
  function handleDropZoneOver(e)  { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function handleDrop(e) {
    e.preventDefault(); setDropOver(false); dragCounter.current = 0
    if (draggingId) { handleManualPick(draggingId); setDraggingId(null) }
  }

  /* ── Derived state ──────────────────────────────────────────────────────── */
  const available         = members.filter(m => m.is_checked_in).length
  const total             = members.length
  const totalAssign       = members.reduce((s, m) => s + m.pick_count, 0)
  const assignedThisCycle = members.filter(m => m.current_cycle_assigned).length

  const checkedInMembers = members.filter(m => m.is_checked_in)
  const balanceMaxCount  = balanceMode && checkedInMembers.length > 0
    ? Math.max(...checkedInMembers.map(m => m.pick_count)) : -1
  const balanceAllEqual  = balanceMode && checkedInMembers.length > 0
    && checkedInMembers.every(m => m.pick_count === balanceMaxCount)

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 font-sans overflow-hidden">
      <Sidebar
        view={view}
        setView={setView}
        region={region}
        setRegion={setRegion}
        available={available}
        total={total}
        totalAssign={totalAssign}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="flex-1 overflow-y-auto p-5 min-w-0 ml-56">
        {view === 'scheduler' ? (
          <SchedulerView region={region} />
        ) : (
          <AssignerView
            members={members}
            history={history}
            region={region}
            onAdded={handleAdded}
            onCheckin={handleCheckin}
            onCheckout={handleCheckout}
            onRemove={handleRemove}
            onPick={handlePick}
            onReset={handleReset}
            picking={picking}
            dropOver={dropOver}
            draggingId={draggingId}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDropZoneEnter={handleDropZoneEnter}
            handleDropZoneLeave={handleDropZoneLeave}
            handleDropZoneOver={handleDropZoneOver}
            handleDrop={handleDrop}
            balanceMode={balanceMode}
            setBalanceMode={setBalanceMode}
            assignedThisCycle={assignedThisCycle}
            balanceAllEqual={balanceAllEqual}
            balanceMaxCount={balanceMaxCount}
          />
        )}
      </main>

      {pendingPick && (
        <PickModal
          pick={pendingPick}
          onConfirm={handleConfirm}
          onUnavailable={handleUnavailable}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
