import { describe, it, expect } from 'vitest'
import { RoomStore } from './room-store'
import { restartGame } from './game'
import {
  EMPTY_ROOM_TTL_MS, FINISHED_ROOM_TTL_MS, MAX_ROOMS,
  ROOM_CODE_LENGTH, STALE_LOBBY_TTL_MS,
} from '../../constants'

const NOW = 1_000_000

describe('RoomStore.create', () => {
  it('สร้างห้องพร้อมโค้ดความยาวตามที่กำหนด', () => {
    const store = new RoomStore()
    const r = store.create('สมชาย', 5, 'p1', NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.code).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('โค้ดห้องไม่ชนกันเลยใน 300 ห้อง', () => {
    const store = new RoomStore()
    const codes = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) codes.add(r.value.code)
      // ลบทิ้งเพื่อไม่ให้ชนเพดาน แต่ยังเก็บโค้ดไว้ตรวจ
      if (r.ok) store.delete(r.value.code)
    }
    expect(codes.size).toBe(300)
  })

  it('โค้ดไม่มีตัวอักษรที่อ่านสับสน (I O 0 1)', () => {
    const store = new RoomStore()
    for (let i = 0; i < 50; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) {
        expect(r.value.code).not.toMatch(/[IO01]/)
        store.delete(r.value.code)
      }
    }
  })

  it('เกินเพดานแล้วปฏิเสธด้วย SERVER_FULL', () => {
    const store = new RoomStore()
    for (let i = 0; i < MAX_ROOMS; i++) store.create('x', 3, `p${i}`, NOW)
    const r = store.create('เกิน', 3, 'extra', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('SERVER_FULL')
  })

  it('sweep คืนที่ว่างก่อน แล้วสร้างได้', () => {
    const store = new RoomStore()
    for (let i = 0; i < MAX_ROOMS; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) for (const p of r.value.players.values()) p.connected = false
    }
    // เวลาผ่านไปนานพอให้ห้องร้างถูกกวาด
    const later = NOW + EMPTY_ROOM_TTL_MS + 1
    const r = store.create('คนใหม่', 3, 'fresh', later)
    expect(r.ok).toBe(true)
  })
})

describe('RoomStore.sweep', () => {
  function storeWith(mutate: (store: RoomStore, code: string) => void) {
    const store = new RoomStore()
    const r = store.create('x', 3, 'p1', NOW)
    if (!r.ok) throw new Error('สร้างห้องไม่สำเร็จ')
    mutate(store, r.value.code)
    return { store, code: r.value.code }
  }

  it('ลบห้องที่ไม่มีใครต่ออยู่นานเกิน TTL', () => {
    const { store, code } = storeWith((s, c) => {
      for (const p of s.get(c)!.players.values()) p.connected = false
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + EMPTY_ROOM_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ไม่ลบห้องที่ยังมีคนต่ออยู่ แม้จะผ่าน TTL ห้องร้างไปมากแล้ว', () => {
    const { store, code } = storeWith(() => {})
    // ผ่าน EMPTY_ROOM_TTL_MS ไปมาก แต่ยังไม่ถึง STALE_LOBBY_TTL_MS —
    // เกณฑ์ "ห้องร้าง" ไม่ควรมีผลเพราะยังมีคนต่ออยู่ (คนละเกณฑ์กับ stale-lobby)
    store.sweep(NOW + STALE_LOBBY_TTL_MS - 1)
    expect(store.get(code)).toBeDefined()
  })

  it('ลบห้อง LOBBY ที่ไม่เคยเริ่มเกมนานเกิน TTL เมื่อไม่มีใครต่ออยู่แล้ว', () => {
    const { store, code } = storeWith((s, c) => {
      for (const p of s.get(c)!.players.values()) p.connected = false
    })
    store.sweep(NOW + STALE_LOBBY_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ไม่ลบห้อง LOBBY เก่าที่ยังมีคนต่ออยู่ — "ห้ามลบห้องที่มีคน" ชนะเกณฑ์ stale-lobby', () => {
    const { store, code } = storeWith(() => {})
    store.sweep(NOW + STALE_LOBBY_TTL_MS + 1)
    expect(store.get(code)).toBeDefined()
  })

  it('ห้องที่เพิ่งกด "เล่นอีกรอบ" ไม่ถูกกวาด แม้สร้างมานานเกิน TTL แล้ว', () => {
    const { store, code } = storeWith((s, c) => {
      const room = s.get(c)!
      room.phase = 'GAME_END'
      // เล่นจนจบเกมกินเวลานานกว่า TTL ของ stale-lobby ได้ตามปกติ
      for (const p of room.players.values()) p.connected = false
    })
    const later = NOW + STALE_LOBBY_TTL_MS + 1
    const room = store.get(code)!
    expect(restartGame(room, 'p1', later).ok).toBe(true)

    store.sweep(later)
    expect(store.get(code)).toBeDefined()
  })

  it('ลบห้องที่จบเกมแล้วนานเกิน TTL', () => {
    const { store, code } = storeWith((s, c) => {
      s.get(c)!.phase = 'GAME_END'
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + FINISHED_ROOM_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ไม่ลบห้องที่กำลังเล่นอยู่', () => {
    const { store, code } = storeWith((s, c) => {
      s.get(c)!.phase = 'PLAYING'
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + STALE_LOBBY_TTL_MS * 10)
    expect(store.get(code)).toBeDefined()
  })

  it('คืนจำนวนห้องที่ลบไป', () => {
    const store = new RoomStore()
    for (let i = 0; i < 3; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) for (const p of r.value.players.values()) p.connected = false
    }
    expect(store.sweep(NOW + EMPTY_ROOM_TTL_MS + 1)).toBe(3)
  })
})

describe('RoomStore.get', () => {
  it('หาห้องด้วยโค้ดได้ ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    const store = new RoomStore()
    const r = store.create('x', 3, 'p1', NOW)
    if (!r.ok) throw new Error('สร้างห้องไม่สำเร็จ')
    expect(store.get(r.value.code.toLowerCase())).toBeDefined()
  })

  it('โค้ดที่ไม่มีอยู่ คืน undefined', () => {
    expect(new RoomStore().get('ZZZZZZ')).toBeUndefined()
  })
})
