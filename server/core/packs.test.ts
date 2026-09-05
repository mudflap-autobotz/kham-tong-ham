import { describe, it, expect } from 'vitest'
import { loadPacks, pickPack, dealWords } from './packs'
import { MAX_PLAYERS } from '../../constants'
import type { Pack } from './types'

describe('loadPacks', () => {
  it('โหลดได้อย่างน้อย 1 pack', () => {
    expect(loadPacks().length).toBeGreaterThan(0)
  })

  it('ทุก pack มีคำอย่างน้อยเท่าจำนวนคนสูงสุด', () => {
    for (const p of loadPacks()) {
      expect(p.words.length, `pack ${p.id} มีคำไม่พอ`).toBeGreaterThanOrEqual(MAX_PLAYERS)
    }
  })

  it('ทุก pack ไม่มีคำซ้ำกันภายในตัวเอง', () => {
    for (const p of loadPacks()) {
      expect(new Set(p.words).size, `pack ${p.id} มีคำซ้ำ`).toBe(p.words.length)
    }
  })

  it('id ของ pack ไม่ซ้ำกัน', () => {
    const ids = loadPacks().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

const fakePacks: Pack[] = [
  { id: 'a', theme: 'A', words: ['a1', 'a2', 'a3'] },
  { id: 'b', theme: 'B', words: ['b1', 'b2', 'b3'] },
]

describe('pickPack', () => {
  it('เลี่ยง pack ที่ใช้ไปแล้ว', () => {
    const r = pickPack(fakePacks, ['a'], () => 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.id).toBe('b')
  })

  it('ใช้ครบทุก pack แล้ววนกลับมาใช้ซ้ำได้', () => {
    const r = pickPack(fakePacks, ['a', 'b'], () => 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(['a', 'b']).toContain(r.value.id)
  })

  it('ไม่มี pack เลย ตอบ NO_PACK_AVAILABLE', () => {
    const r = pickPack([], [], () => 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NO_PACK_AVAILABLE')
  })
})

describe('dealWords', () => {
  it('ทุกคนได้คำคนละคำ ไม่ซ้ำกัน', () => {
    const ids = ['p1', 'p2', 'p3']
    const m = dealWords(fakePacks[0], ids)
    expect(m.size).toBe(3)
    expect(new Set(m.values()).size).toBe(3)
  })

  it('คำที่แจกมาจาก pack นั้นเท่านั้น', () => {
    const m = dealWords(fakePacks[0], ['p1', 'p2'])
    for (const w of m.values()) {
      expect(fakePacks[0].words).toContain(w)
    }
  })

  it('ทุก playerId ได้รับคำครบ', () => {
    const ids = ['x', 'y', 'z']
    const m = dealWords(fakePacks[0], ids)
    for (const id of ids) expect(m.get(id)).toBeTruthy()
  })

  it('โยน error ถ้าคำใน pack ไม่พอกับจำนวนคน', () => {
    expect(() => dealWords(fakePacks[0], ['p1', 'p2', 'p3', 'p4'])).toThrow()
  })
})
