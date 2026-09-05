import { describe, it, expect } from 'vitest'
import { createRoom, joinRoom, setReady, startCountdown, beginRound } from './game'
import { MAX_PLAYERS } from '../../constants'
import type { Room } from './types'

const NOW = 1_000_000

function roomWithPlayers(n: number, ready = true): Room {
  const room = createRoom('ABC234', 'P1', 3, 'p1', NOW)
  for (let i = 2; i <= n; i++) {
    joinRoom(room, `P${i}`, `p${i}`, NOW)
  }
  if (ready) {
    for (const id of room.players.keys()) setReady(room, id, true)
  }
  return room
}

describe('createRoom', () => {
  it('host เข้าห้องทันทีและเป็นเจ้าของห้อง', () => {
    const room = createRoom('ABC234', 'สมชาย', 5, 'p1', NOW)
    expect(room.hostId).toBe('p1')
    expect(room.players.size).toBe(1)
    expect(room.players.get('p1')!.name).toBe('สมชาย')
  })

  it('เริ่มที่ phase LOBBY รอบที่ 0', () => {
    const room = createRoom('ABC234', 'สมชาย', 5, 'p1', NOW)
    expect(room.phase).toBe('LOBBY')
    expect(room.currentRound).toBe(0)
    expect(room.round).toBeNull()
  })
})

describe('joinRoom', () => {
  it('คนใหม่เข้าห้องได้', () => {
    const room = roomWithPlayers(1)
    const r = joinRoom(room, 'มานี', 'p2', NOW)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
  })

  it('เข้าด้วย playerId เดิม คืนสถานะเดิม ไม่สร้างคนใหม่', () => {
    const room = roomWithPlayers(2)
    room.players.get('p2')!.score = 7
    room.players.get('p2')!.connected = false

    const r = joinRoom(room, 'ชื่ออื่น', 'p2', NOW + 100)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
    expect(room.players.get('p2')!.score).toBe(7)
    expect(room.players.get('p2')!.connected).toBe(true)
  })

  it('ห้องเต็มแล้วเข้าไม่ได้', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    const r = joinRoom(room, 'เกินมา', 'extra', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ROOM_FULL')
  })

  it('คนเดิมกลับเข้าห้องที่เต็มได้ (reconnect ไม่ถูกกันด้วยเพดาน)', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    room.players.get('p2')!.connected = false
    const r = joinRoom(room, 'P2', 'p2', NOW)
    expect(r.ok).toBe(true)
  })

  it('เข้าห้องระหว่างเกมกำลังเล่นไม่ได้', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    const r = joinRoom(room, 'สาย', 'late', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('setReady', () => {
  it('เปลี่ยนสถานะพร้อมได้', () => {
    const room = roomWithPlayers(3, false)
    setReady(room, 'p2', true)
    expect(room.players.get('p2')!.ready).toBe(true)
    setReady(room, 'p2', false)
    expect(room.players.get('p2')!.ready).toBe(false)
  })

  it('กดพร้อมได้เฉพาะตอน LOBBY', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    const r = setReady(room, 'p2', false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('startCountdown', () => {
  it('host เริ่มได้เมื่อคนครบและพร้อมหมด', () => {
    const room = roomWithPlayers(3)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('COUNTDOWN')
    expect(room.countdownEndsAt).toBe(NOW + 3_000)
  })

  it('คนที่ไม่ใช่ host เริ่มไม่ได้', () => {
    const room = roomWithPlayers(3)
    const r = startCountdown(room, 'p2', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('คนไม่ถึงขั้นต่ำ เริ่มไม่ได้', () => {
    const room = roomWithPlayers(2)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_ENOUGH_PLAYERS')
  })

  it('ยังพร้อมไม่ครบ เริ่มไม่ได้', () => {
    const room = roomWithPlayers(4)
    setReady(room, 'p3', false)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_ALL_READY')
  })
})

describe('beginRound', () => {
  it('แจกคำให้ทุกคน คนละคำไม่ซ้ำ', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)

    const a = room.round!.assignments
    expect(a.size).toBe(4)
    expect(new Set(a.values()).size).toBe(4)
  })

  it('เข้า phase PLAYING และนับรอบขึ้น', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.phase).toBe('PLAYING')
    expect(room.currentRound).toBe(1)
  })

  it('ตั้งเวลาจบรอบตามจำนวนคน', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.round!.endsAt).toBe(NOW + 5 * 60_000)
  })

  it('ทุกคนเริ่มต้นด้วยสถานะยังไม่ตาย', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.round!.alive.size).toBe(4)
    expect(room.round!.wordBurned.size).toBe(0)
  })

  it('สุ่ม GM จากผู้เล่นในห้อง', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect([...room.players.keys()]).toContain(room.round!.gmId)
  })

  it('เลี่ยงสุ่ม GM ซ้ำคนเดิมจากรอบที่แล้ว', () => {
    const room = roomWithPlayers(4)
    room.lastGmId = 'p1'
    startCountdown(room, 'p1', NOW)
    // rng คืน 0 เสมอ = หยิบตัวแรกของ pool เสมอ
    // ถ้าไม่กรอง p1 ออก จะได้ p1 กลับมา
    beginRound(room, NOW, () => 0)
    expect(room.round!.gmId).not.toBe('p1')
  })

  it('บันทึก pack ที่ใช้ไปแล้ว', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.usedPackIds).toContain(room.round!.packId)
  })

  it('รีเซ็ต ready ของทุกคนเมื่อรอบเริ่ม', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    for (const p of room.players.values()) expect(p.ready).toBe(false)
  })
})
