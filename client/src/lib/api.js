export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function fmtDateTime(dt) {
  if (!dt) return ''
  const d = new Date(dt.replace(' ', 'T') + 'Z')
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function getReturnTime(checkout_until) {
  if (!checkout_until) return null
  const until = new Date(checkout_until.replace(' ', 'T') + 'Z')
  if (until <= Date.now()) return null
  return until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function memberStatus(m) {
  if (m.is_checked_in) return 'in'
  if (m.checkout_until) return 'timed'
  return 'out'
}

export function sortMembers(list) {
  return [...list].sort((a, b) =>
    (b.is_checked_in - a.is_checked_in) ||
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  )
}
