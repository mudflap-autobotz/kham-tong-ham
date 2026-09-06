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

  it('key ที่หมดอายุแล้วถูกทิ้ง — Map ไม่โตตามจำนวน IP ที่เคยแวะมา', () => {
    const rl = new RateLimiter(3, 60_000)
    const hits = (rl as unknown as { hits: Map<string, number[]> }).hits

    for (let i = 0; i < 500; i++) rl.check(`ip-${i}`, i)
    expect(hits.size, 'ครั้งที่ยังอยู่ในหน้าต่างเวลา ต้องยังถูกนับอยู่').toBe(500)

    // เวลาผ่านไปพ้นหน้าต่าง แล้วมี IP ใหม่แวะมา
    for (let i = 0; i < 10; i++) rl.check(`new-${i}`, 10_000_000 + i)
    expect(hits.size, 'key เก่าที่หมดอายุยังค้างอยู่').toBe(10)
  })

  it('เก็บกวาดแล้วยังนับถูก — IP เดิมที่กลับมาได้โควตาใหม่เต็ม', () => {
    const rl = new RateLimiter(2, 60_000)
    expect(rl.check('1.1.1.1', 0)).toBe(true)
    expect(rl.check('1.1.1.1', 1)).toBe(true)
    expect(rl.check('1.1.1.1', 2)).toBe(false)

    expect(rl.check('1.1.1.1', 61_000)).toBe(true)
    expect(rl.check('1.1.1.1', 61_001)).toBe(true)
    expect(rl.check('1.1.1.1', 61_002)).toBe(false)
  })

  it('แต่ละ key นับแยกกัน', () => {
    const rl = new RateLimiter(1, 60_000)
    expect(rl.check('a', 0)).toBe(true)
    expect(rl.check('b', 0)).toBe(true)
    expect(rl.check('a', 0)).toBe(false)
  })
})
