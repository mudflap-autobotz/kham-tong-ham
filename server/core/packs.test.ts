import { describe, it, expect } from 'vitest'
import { loadPacks, loadWildcards, pickPack, dealWords, injectWildcard } from './packs'
import { MAX_PLAYERS, MIN_WORDS_PER_PACK, WILDCARD_CHANCE } from '../../constants'
import type { Pack } from './types'

describe('loadPacks', () => {
  it('โหลดได้อย่างน้อย 1 pack', () => {
    expect(loadPacks().length).toBeGreaterThan(0)
  })

  it('ทุก pack มีคำอย่างน้อยเท่า MIN_WORDS_PER_PACK', () => {
    for (const p of loadPacks()) {
      expect(p.words.length, `pack ${p.id} มีคำไม่พอ`).toBeGreaterThanOrEqual(MIN_WORDS_PER_PACK)
    }
  })

  it('MIN_WORDS_PER_PACK ต้องพอสำหรับวงที่คนเยอะสุด', () => {
    expect(MIN_WORDS_PER_PACK).toBeGreaterThanOrEqual(MAX_PLAYERS)
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

describe('loadWildcards', () => {
  it('มีคำวิเศษให้แทรก และไม่ซ้ำกันเอง', () => {
    const w = loadWildcards()
    expect(w.length).toBeGreaterThan(0)
    expect(new Set(w).size).toBe(w.length)
  })

  it('คำวิเศษไม่ชนกับคำในธีมไหนเลย', () => {
    const inPacks = new Set(loadPacks().flatMap((p) => p.words))
    for (const w of loadWildcards()) {
      expect(inPacks.has(w), `คำวิเศษ "${w}" ชนกับคำใน pack`).toBe(false)
    }
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

const WILDS = ['w1', 'w2']
/** rng ค่าเดียวคงที่ — ค่าต่ำกว่า WILDCARD_CHANCE คือ "รอบนี้มีคำวิเศษ" */
const fixed = (v: number) => () => v

describe('injectWildcard', () => {
  const base = () => new Map([['p1', 'a1'], ['p2', 'a2'], ['p3', 'a3']])

  it('รอบที่ไม่ถูกสุ่ม คำทุกคนเหมือนเดิม', () => {
    const out = injectWildcard(base(), WILDS, fixed(WILDCARD_CHANCE))
    expect([...out]).toEqual([...base()])
  })

  it('รอบที่ถูกสุ่ม มีคน 1 คนได้คำวิเศษ ที่เหลือคำเดิม', () => {
    const out = injectWildcard(base(), WILDS, fixed(0))
    const changed = [...out].filter(([id, w]) => base().get(id) !== w)
    expect(changed).toHaveLength(1)
    expect(WILDS).toContain(changed[0][1])
  })

  it('ไม่มีคำวิเศษให้แทรก คืนคำเดิม', () => {
    const out = injectWildcard(base(), [], fixed(0))
    expect([...out]).toEqual([...base()])
  })

  it('ไม่มีผู้เล่น ไม่พัง', () => {
    expect(injectWildcard(new Map(), WILDS, fixed(0)).size).toBe(0)
  })

  it('คำวิเศษที่ชนกับคำที่แจกไปแล้ว ไม่ถูกหยิบมาแจกซ้ำ', () => {
    const out = injectWildcard(base(), ['a1'], fixed(0))
    expect(new Set(out.values()).size).toBe(out.size)
  })

  it('ทุกคนยังได้คำคนละคำ ไม่ซ้ำกัน', () => {
    const out = injectWildcard(base(), WILDS, fixed(0))
    expect(new Set(out.values()).size).toBe(out.size)
  })

  it('ไม่แก้ Map ที่รับเข้ามา', () => {
    const input = base()
    injectWildcard(input, WILDS, fixed(0))
    expect([...input]).toEqual([...base()])
  })
})
