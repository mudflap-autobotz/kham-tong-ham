import { describe, it, expect } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('อนุญาตภายในโควตา', () => {
    const rl = new RateLimiter(3, 60_000)
    expect(rl.check('1.1.1.1', 0)).toBe(true)
    expect(rl.check('1.1.1.1', 1)).toBe(true)
    expect(rl.check('1.1.1.1', 2)).toBe(true)
  })

  it('ปฏิเสธเมื่อเกินโควตา', () => {
    const rl = new RateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) rl.check('1.1.1.1', i)
    expect(rl.check('1.1.1.1', 4)).toBe(false)
  })

  it('โควตาคืนเมื่อพ้นช่วงเวลา', () => {
    const rl = new RateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) rl.check('1.1.1.1', i)
    expect(rl.check('1.1.1.1', 61_000)).toBe(true)
  })

  it('แต่ละ key นับแยกกัน', () => {
    const rl = new RateLimiter(1, 60_000)
    expect(rl.check('a', 0)).toBe(true)
    expect(rl.check('b', 0)).toBe(true)
    expect(rl.check('a', 0)).toBe(false)
  })
})
