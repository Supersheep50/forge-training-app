export const pad = (n: number) => String(n).padStart(2, '0')

/** Local yyyy-mm-dd for a date. */
export function dayKey(d: Date | string = new Date()) {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

/** Value for <input type="datetime-local">. */
export function toLocalInput(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${dayKey(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export function fmtDuration(sec?: number) {
  if (!sec && sec !== 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h) return `${h}h ${pad(m)}m`
  return `${m}m`
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

export function fmtDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(d).toLocaleDateString('en-GB', opts)
}

export const fmtLong = (d: string | Date) =>
  fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function fmtNum(n?: number, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function relDay(d: string | Date) {
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(d)).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return fmtDate(d, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined })
}

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Monday-based week start. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
