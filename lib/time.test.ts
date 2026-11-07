import { describe, expect, test } from 'claude-code/testing'
import { clockTime, stamp, took } from './time'

// 2026-11-07 15:41:07.400 UTC.
const T = Date.UTC(2026, 10, 7, 15, 41, 7, 400)

describe('Times', () => {
  test('a clock time is the local wall clock, from the offset Date reports (minutes behind UTC)', async () => {
    expect(clockTime(T, 0)).toBe('15:41:07')
    expect(clockTime(T, 360)).toBe('09:41:07')
    expect(clockTime(T, -330)).toBe('21:11:07')
    // Across midnight both ways.
    expect(clockTime(Date.UTC(2026, 10, 7, 2, 5, 0), 360)).toBe('20:05:00')
    expect(clockTime(Date.UTC(2026, 10, 7, 23, 0, 0), -120)).toBe('01:00:00')
  })

  test('a stamp adds the date only when the time is on another local day than now', async () => {
    expect(stamp(T, T + 3_600_000, 360, 360)).toBe('09:41:07')
    expect(stamp(T, T + 2 * 86_400_000, 360, 360)).toBe('2026-11-07 09:41')
    // The local day decides, not the UTC one: 02:05 UTC on the 7th is the evening of the 6th at UTC-6.
    expect(stamp(Date.UTC(2026, 10, 7, 2, 5, 0), Date.UTC(2026, 10, 7, 3, 0, 0), 360, 360)).toBe('20:05:00')
    expect(stamp(Date.UTC(2026, 10, 7, 2, 5, 0), Date.UTC(2026, 10, 7, 7, 0, 0), 360, 360)).toBe('2026-11-06 20:05')
  })

  test('a duration under a second shows nothing; past it, tenths, then seconds, minutes, and hours', async () => {
    expect(took(undefined)).toBe('')
    expect(took(999)).toBe('')
    expect(took(1_000)).toBe('1.0s')
    expect(took(9_949)).toBe('9.9s')
    expect(took(12_400)).toBe('12s')
    expect(took(59_600)).toBe('1m 00s')
    expect(took(192_000)).toBe('3m 12s')
    expect(took(3_725_000)).toBe('1h 02m')
  })
})
