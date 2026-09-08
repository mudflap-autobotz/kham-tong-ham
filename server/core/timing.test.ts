import { describe, it, expect } from 'vitest'
import { roundDurationMs } from './timing'

const MIN = 60_000

describe('roundDurationMs', () => {
  it('3-4 คน ได้ 3 นาที', () => {
    expect(roundDurationMs(3)).toBe(3 * MIN)
    expect(roundDurationMs(4)).toBe(3 * MIN)
  })

  it('5-8 คน ได้ 6 นาที', () => {
    expect(roundDurationMs(5)).toBe(6 * MIN)
    expect(roundDurationMs(8)).toBe(6 * MIN)
  })

  it('9-12 คน ได้ 9 นาที', () => {
    expect(roundDurationMs(9)).toBe(9 * MIN)
    expect(roundDurationMs(12)).toBe(9 * MIN)
  })

  it('ขอบเขตของ bucket ขยับที่ตัวคูณของ 4 พอดี', () => {
    expect(roundDurationMs(4)).not.toBe(roundDurationMs(5))
    expect(roundDurationMs(8)).not.toBe(roundDurationMs(9))
  })

  it('เพิ่มขึ้นแบบไม่ลดลงเมื่อคนเยอะขึ้น', () => {
    for (let n = 3; n < 12; n++) {
      expect(roundDurationMs(n + 1)).toBeGreaterThanOrEqual(roundDurationMs(n))
    }
  })
})
