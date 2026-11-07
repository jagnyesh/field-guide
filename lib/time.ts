const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')

// Minutes behind UTC at that instant, as Date reports it, so a time across a DST change is right.
function offsetAt(ms: number): number {
  return new Date(ms).getTimezoneOffset()
}

// Local wall-clock time of an instant in milliseconds since the epoch, HH:MM:SS.
export function clockTime(ms: number, offsetMinutes = offsetAt(ms)): string {
  const t = (((ms - offsetMinutes * MINUTE) % DAY) + DAY) % DAY
  return `${pad(Math.floor(t / HOUR))}:${pad(Math.floor((t % HOUR) / MINUTE))}:${pad(Math.floor((t % MINUTE) / SECOND))}`
}

// A clock time, with the date in front when the instant is on another local day than `now`:
// for records a resumed session reads back days later.
export function stamp(ms: number, now: number, offsetMinutes = offsetAt(ms), nowOffsetMinutes = offsetAt(now)): string {
  const local = ms - offsetMinutes * MINUTE
  if (Math.floor(local / DAY) === Math.floor((now - nowOffsetMinutes * MINUTE) / DAY)) return clockTime(ms, offsetMinutes)
  const d = new Date(local)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${clockTime(ms, offsetMinutes).slice(0, 5)}`
}

// How long something took; '' under a second, where the number is noise to a reader.
export function took(ms: number | undefined): string {
  if (ms === undefined || !(ms >= SECOND)) return ''
  if (ms < 9_950) return `${(ms / SECOND).toFixed(1)}s`
  const s = Math.round(ms / SECOND)
  if (s < 60) return `${s}s`
  if (s < 3_600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`
  const m = Math.round(s / 60)
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`
}
