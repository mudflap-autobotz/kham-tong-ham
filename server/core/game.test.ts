import { describe, it, expect } from 'vitest'
import { createRoom, joinRoom, setReady, startCountdown, beginRound } from './game'
import {
  recordKill, undoKill, endRound, endRoundByGm, kickPlayer, leaveRoom,
  submitGuess, nextRound, restartGame,
} from './game'
import { MAX_PLAYERS } from '../../constants'
import type { Room } from './types'

const NOW = 1_000_000

function roomWithPlayers(n: number, ready = true): Room {
  const room = createRoom('ABC234', 'P1', 3, 'p1', NOW)
  for (let i = 2; i <= n; i++) {
    joinRoom(room, `P${i}`, `p${i}`, null, NOW)
  }
  if (ready) {
    for (const id of room.players.keys()) setReady(room, id, true)
  }
  return room
}

/** token ของ player ที่ server ออกให้ — reconnect ที่ถูกต้องต้องยื่นค่านี้ */
const tokenOf = (room: Room, id: string) => room.players.get(id)!.sessionToken

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
    const r = joinRoom(room, 'มานี', 'p2', null, NOW)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
  })

  it('เข้าด้วย playerId เดิม คืนสถานะเดิม ไม่สร้างคนใหม่', () => {
    const room = roomWithPlayers(2)
    room.players.get('p2')!.score = 7
    room.players.get('p2')!.connected = false

    const r = joinRoom(room, 'ชื่ออื่น', 'p2', tokenOf(room, 'p2'), NOW + 100)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
    expect(room.players.get('p2')!.score).toBe(7)
    expect(room.players.get('p2')!.connected).toBe(true)
  })

  it('ห้องเต็มแล้วเข้าไม่ได้', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    const r = joinRoom(room, 'เกินมา', 'extra', null, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ROOM_FULL')
  })

  it('คนเดิมกลับเข้าห้องที่เต็มได้ (reconnect ไม่ถูกกันด้วยเพดาน)', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    room.players.get('p2')!.connected = false
    const r = joinRoom(room, 'P2', 'p2', tokenOf(room, 'p2'), NOW)
    expect(r.ok).toBe(true)
  })

  it('เข้าห้องระหว่างเกมกำลังเล่นไม่ได้', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    const r = joinRoom(room, 'สาย', 'late', null, NOW)
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
    expect(room.round!.endsAt).toBe(NOW + 3 * 60_000)
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

/** ห้องที่กำลังเล่นอยู่ พร้อมรู้ว่าใครเป็น GM */
function playingRoom(n = 4): { room: Room; gmId: string; others: string[] } {
  const room = roomWithPlayers(n)
  startCountdown(room, 'p1', NOW)
  beginRound(room, NOW, () => 0)
  const gmId = room.round!.gmId
  const others = [...room.players.keys()].filter((id) => id !== gmId)
  return { room, gmId, others }
}

describe('recordKill', () => {
  it('GM บันทึกคนตาย คนหลอกได้ 1 คะแนน', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    const r = recordKill(room, gmId, victim, killer, NOW)

    expect(r.ok).toBe(true)
    expect(room.players.get(killer)!.score).toBe(1)
    expect(room.players.get(victim)!.score).toBe(0)
  })

  it('คนตายออกจากรายชื่อคนรอด และติด wordBurned', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)

    expect(room.round!.alive.has(victim)).toBe(false)
    expect(room.round!.wordBurned.has(victim)).toBe(true)
  })

  it('คืนคำของคนตายเพื่อเปิดให้ดู', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    const r = recordKill(room, gmId, victim, killer, NOW)
    if (r.ok) expect(r.value).toBe(room.round!.assignments.get(victim))
  })

  it('คนที่ไม่ใช่ GM บันทึกไม่ได้', () => {
    const { room, others } = playingRoom()
    const r = recordKill(room, others[0], others[1], others[2], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('คนตายกับคนหลอกเป็นคนเดียวกันไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, others[0], others[0], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })

  it('ฆ่าคนที่ตายไปแล้วไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    const r = recordKill(room, gmId, victim, killer, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ALREADY_DEAD')
  })

  it('ฆ่าคนที่ไม่มีในห้องไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, 'ghost', others[0], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('PLAYER_NOT_FOUND')
  })

  it('GM ตายเองได้ ถ้าคนหลอกเป็นคนอื่น', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, gmId, others[0], NOW)
    expect(r.ok).toBe(true)
    expect(room.round!.alive.has(gmId)).toBe(false)
  })

  it('บันทึกไม่ได้ถ้าไม่ได้อยู่ใน phase PLAYING', () => {
    const { room, gmId, others } = playingRoom()
    endRound(room, 'GM', NOW)
    const r = recordKill(room, gmId, others[0], others[1], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })

  it('เหลือคนรอดคนเดียว รอบจบเองด้วยเหตุผล LAST_MAN', () => {
    const { room, gmId, others } = playingRoom(4)
    const alive = [...room.round!.alive]
    // ฆ่าไป 3 คน เหลือ 1
    recordKill(room, gmId, alive[0], alive[3], NOW)
    recordKill(room, gmId, alive[1], alive[3], NOW)
    recordKill(room, gmId, alive[2], alive[3], NOW)

    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('LAST_MAN')
  })
})

describe('undoKill', () => {
  it('คืนสถานะรอดและหักคะแนนคนหลอกกลับ', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)

    const r = undoKill(room, gmId, 0)
    expect(r.ok).toBe(true)
    expect(room.round!.alive.has(victim)).toBe(true)
    expect(room.players.get(killer)!.score).toBe(0)
    expect(room.round!.deaths).toHaveLength(0)
  })

  it('victim ยังติด wordBurned หลัง undo เพราะเห็นคำไปแล้ว', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    undoKill(room, gmId, 0)

    expect(room.round!.wordBurned.has(victim)).toBe(true)
  })

  it('คนที่ไม่ใช่ GM undo ไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    const r = undoKill(room, others[0], 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('undo index ที่ไม่มีอยู่ ตอบ INVALID_TARGET', () => {
    const { room, gmId } = playingRoom()
    const r = undoKill(room, gmId, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })
})

describe('undoKill ข้ามเส้นจบรอบ (LAST_MAN)', () => {
  /** ฆ่าจนเหลือคนรอดคนเดียว รอบจะปิดตัวเองด้วย LAST_MAN */
  function lastManRoom() {
    const { room, gmId } = playingRoom(4)
    const alive = [...room.round!.alive]
    const survivor = alive[3]
    recordKill(room, gmId, alive[0], survivor, NOW)
    recordKill(room, gmId, alive[1], survivor, NOW)
    recordKill(room, gmId, alive[2], survivor, NOW)
    return { room, gmId, survivor, lastVictim: alive[2] }
  }

  it('undo การบันทึกตัวที่ปิดรอบ ดึงรอบกลับมาเล่นต่อ', () => {
    const { room, gmId } = lastManRoom()
    const r = undoKill(room, gmId, room.round!.deaths.length - 1)

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.resumed).toBe(true)
    expect(room.phase).toBe('PLAYING')
    expect(room.round!.endReason).toBeNull()
  })

  it('เหยื่อกลับมารอด คะแนนคนหลอกถูกหักคืน และประวัติรอบถูกถอนออก', () => {
    const { room, gmId, survivor, lastVictim } = lastManRoom()
    expect(room.roundHistory).toHaveLength(1)
    const scoreBefore = room.players.get(survivor)!.score

    undoKill(room, gmId, room.round!.deaths.length - 1)

    expect(room.round!.alive.has(lastVictim)).toBe(true)
    expect(room.players.get(survivor)!.score).toBe(scoreBefore - 1)
    expect(room.roundHistory).toHaveLength(0)
    expect(room.round!.deaths).toHaveLength(2)
  })

  it('เหยื่อยังติด wordBurned — เห็นคำตัวเองไปแล้วย้อนไม่ได้', () => {
    const { room, gmId, lastVictim } = lastManRoom()
    undoKill(room, gmId, room.round!.deaths.length - 1)
    expect(room.round!.wordBurned.has(lastVictim)).toBe(true)
  })

  it('คนที่ยังรอดติด wordBurned ด้วย — ROUND_END เปิดคำให้เห็นไปแล้ว', () => {
    const { room, gmId, survivor, lastVictim } = lastManRoom()
    undoKill(room, gmId, room.round!.deaths.length - 1)

    // ทั้งคนที่รอดมาตลอด และเหยื่อที่เพิ่งถูกดึงกลับมา ต่างเห็นคำตัวเองตอนรอบจบ
    expect(room.round!.wordBurned.has(survivor)).toBe(true)
    expect(room.round!.wordBurned.has(lastVictim)).toBe(true)
  })

  it('เล่นรอบต่อจนจบอีกครั้ง ไม่มีใครได้สิทธิ์ทายฟรี', () => {
    const { room, gmId, survivor } = lastManRoom()
    undoKill(room, gmId, room.round!.deaths.length - 1)
    const scoreBefore = room.players.get(survivor)!.score

    endRound(room, 'GM', NOW)

    // ทายไม่ได้แล้ว เพราะเห็นคำตัวเองไปตอนรอบจบครั้งแรก
    const r = submitGuess(room, survivor, room.round!.assignments.get(survivor)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('CANNOT_GUESS')
    expect(room.players.get(survivor)!.score).toBe(scoreBefore)
  })

  it('นาฬิกาเดินต่อจากเดิม ไม่ถูกตั้งใหม่', () => {
    const { room, gmId } = lastManRoom()
    const endsAt = room.round!.endsAt
    undoKill(room, gmId, room.round!.deaths.length - 1)
    expect(room.round!.endsAt).toBe(endsAt)
  })

  it('ล้างคำทายที่ส่งเข้ามาหลังรอบจบ พร้อมคืนคะแนนที่ได้จากคำทายนั้น', () => {
    const { room, gmId, survivor } = lastManRoom()
    const scoreAfterKills = room.players.get(survivor)!.score
    submitGuess(room, survivor, room.round!.assignments.get(survivor)!)
    expect(room.players.get(survivor)!.score).toBe(scoreAfterKills + 1)

    undoKill(room, gmId, room.round!.deaths.length - 1)

    expect(room.round!.guesses.size).toBe(0)
    // -1 จากคำทายที่ถูกล้าง -1 จากการฆ่าที่ถูก undo
    expect(room.players.get(survivor)!.score).toBe(scoreAfterKills - 1)
  })

  it('undo รายการที่ไม่ใช่ตัวสุดท้าย ยังถูกปฏิเสธตอน ROUND_END', () => {
    const { room, gmId } = lastManRoom()
    const r = undoKill(room, gmId, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })

  it('รอบที่จบด้วย TIME ยัง undo ไม่ได้ — นั่นไม่ใช่การกดผิด', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRound(room, 'TIME', NOW)

    const r = undoKill(room, gmId, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })

  it('รอบที่ GM สั่งจบเอง ยัง undo ไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRoundByGm(room, gmId, NOW)

    const r = undoKill(room, gmId, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('leaveRoom', () => {
  it('ออกจาก LOBBY แล้วที่นั่งหายไปจริง ไม่ใช่แค่ขึ้นว่าหลุด', () => {
    const room = roomWithPlayers(4)
    const r = leaveRoom(room, 'p3', NOW + 5)

    expect(r.ok).toBe(true)
    expect(room.players.has('p3')).toBe(false)
    expect(room.players.size).toBe(3)
    expect(room.lastActivityAt).toBe(NOW + 5)
  })

  it('host เดินออก ตำแหน่งตกเป็นของคนที่เข้าก่อนและยังต่ออยู่', () => {
    const room = roomWithPlayers(4)
    // p2 เข้าก่อนแต่หลุดไปแล้ว จึงต้องข้ามไปหา p3
    room.players.get('p2')!.connected = false
    room.players.get('p3')!.joinedAt = NOW + 1
    room.players.get('p4')!.joinedAt = NOW + 2

    leaveRoom(room, 'p1', NOW + 10)
    expect(room.hostId).toBe('p3')
  })

  it('ไม่มีใครต่ออยู่เลย ตกเป็นของคนที่เข้าก่อนสุด', () => {
    const room = roomWithPlayers(3)
    for (const p of room.players.values()) p.connected = false
    room.players.get('p2')!.joinedAt = NOW + 1
    room.players.get('p3')!.joinedAt = NOW + 2

    leaveRoom(room, 'p1', NOW + 10)
    expect(room.hostId).toBe('p2')
  })

  it('คนที่ออกไม่ใช่ host ตำแหน่ง host ไม่เปลี่ยน', () => {
    const room = roomWithPlayers(3)
    leaveRoom(room, 'p2', NOW)
    expect(room.hostId).toBe('p1')
  })

  it('ห้องว่างหมด ไม่ลบห้องทิ้งเอง — room-store เป็นเจ้าของอายุห้อง', () => {
    const room = roomWithPlayers(1)
    leaveRoom(room, 'p1', NOW)
    expect(room.players.size).toBe(0)
    expect(room.hostId).toBe('p1')
  })

  it('ออกระหว่างเล่น ที่นั่งยังอยู่และยังนับเป็นคนรอด', () => {
    const { room, others } = playingRoom()
    const leaver = others[0]

    const r = leaveRoom(room, leaver, NOW)
    expect(r.ok).toBe(true)
    expect(room.players.has(leaver)).toBe(true)
    expect(room.players.get(leaver)!.connected).toBe(false)
    expect(room.round!.alive.has(leaver)).toBe(true)
  })

  it('คนที่ไม่มีในห้อง ตอบ PLAYER_NOT_FOUND', () => {
    const room = roomWithPlayers(3)
    const r = leaveRoom(room, 'ghost', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('PLAYER_NOT_FOUND')
  })
})

describe('endRound', () => {
  it('เปลี่ยนเป็น ROUND_END พร้อมเหตุผล', () => {
    const { room } = playingRoom()
    endRound(room, 'TIME', NOW)
    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('TIME')
  })

  it('บันทึกรอบลงประวัติ', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRound(room, 'TIME', NOW)

    expect(room.roundHistory).toHaveLength(1)
    expect(room.roundHistory[0].round).toBe(1)
    expect(room.roundHistory[0].deaths).toHaveLength(1)
  })

  it('จำ GM ของรอบนี้ไว้เลี่ยงสุ่มซ้ำ', () => {
    const { room, gmId } = playingRoom()
    endRound(room, 'TIME', NOW)
    expect(room.lastGmId).toBe(gmId)
  })

  it('จบรอบซ้ำไม่มีผล', () => {
    const { room } = playingRoom()
    endRound(room, 'TIME', NOW)
    const r = endRound(room, 'GM', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
    expect(room.roundHistory).toHaveLength(1)
  })
})

describe('submitGuess', () => {
  it('ทายถูกได้ 1 คะแนน', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const word = room.round!.assignments.get(p)!
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, word)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(true)
    expect(room.players.get(p)!.score).toBe(1)
  })

  it('ทายผิดไม่ได้คะแนน', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, 'คำที่ไม่มีทางถูก')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(false)
    expect(room.players.get(p)!.score).toBe(0)
  })

  it('พิมพ์วรรณยุกต์ผิดยังถือว่าถูก', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const word = room.round!.assignments.get(p)!
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, word.replace(/[็-๎]/g, ''))
    if (r.ok) expect(r.value).toBe(true)
  })

  it('ทายซ้ำครั้งที่สองไม่ได้', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    endRound(room, 'TIME', NOW)
    submitGuess(room, p, 'ผิด')

    const r = submitGuess(room, p, room.round!.assignments.get(p)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ALREADY_GUESSED')
  })

  it('คนที่ตายไปแล้วทายไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, victim, room.round!.assignments.get(victim)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('CANNOT_GUESS')
  })

  it('ทายได้เฉพาะตอน ROUND_END', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const r = submitGuess(room, p, room.round!.assignments.get(p)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('nextRound', () => {
  it('host ไปรอบต่อไปได้ คะแนนสะสมไม่หาย', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRound(room, 'TIME', NOW)

    const scoreBefore = room.players.get(others[1])!.score
    const r = nextRound(room, 'p1', NOW, () => 0)

    expect(r.ok).toBe(true)
    expect(room.phase).toBe('PLAYING')
    expect(room.currentRound).toBe(2)
    expect(room.players.get(others[1])!.score).toBe(scoreBefore)
  })

  it('คนที่ไม่ใช่ host ไปรอบต่อไปไม่ได้', () => {
    const { room, others } = playingRoom()
    endRound(room, 'TIME', NOW)
    const r = nextRound(room, others[0], NOW, () => 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('ครบจำนวนรอบแล้วเข้า GAME_END แทน', () => {
    const room = roomWithPlayers(4)
    room.totalRounds = 1
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    endRound(room, 'TIME', NOW)

    const r = nextRound(room, 'p1', NOW, () => 0)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('GAME_END')
  })
})

describe('restartGame', () => {
  it('คืนห้องกลับสู่ LOBBY และล้างคะแนน', () => {
    const room = roomWithPlayers(4)
    room.totalRounds = 1
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    endRound(room, 'TIME', NOW)
    nextRound(room, 'p1', NOW, () => 0)

    const r = restartGame(room, 'p1', NOW + 1_000)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('LOBBY')
    expect(room.currentRound).toBe(0)
    // นับอายุห้องใหม่ ไม่งั้นเกณฑ์ stale-lobby กวาดห้องที่เพิ่งเริ่มเล่นใหม่
    expect(room.createdAt).toBe(NOW + 1_000)
    expect(room.roundHistory).toHaveLength(0)
    expect(room.usedPackIds).toHaveLength(0)
    for (const p of room.players.values()) {
      expect(p.score).toBe(0)
      expect(p.ready).toBe(false)
    }
  })

  it('เล่นอีกรอบได้เฉพาะตอนจบเกม', () => {
    const { room } = playingRoom()
    const r = restartGame(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('endRoundByGm', () => {
  it('คนที่ไม่ใช่ GM จบรอบไม่ได้', () => {
    const { room, others } = playingRoom()
    const r = endRoundByGm(room, others[0], 2_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('GM จบรอบได้ และ endReason เป็น GM', () => {
    const { room, gmId } = playingRoom()
    const r = endRoundByGm(room, gmId, 2_000)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('GM')
  })
})

describe('kickPlayer', () => {
  it('host เตะคนอื่นออกได้ตอน LOBBY', () => {
    const room = roomWithPlayers(3)
    const target = [...room.players.keys()].find((id) => id !== room.hostId)!
    expect(kickPlayer(room, room.hostId, target, 1_000).ok).toBe(true)
    expect(room.players.has(target)).toBe(false)
  })

  it('คนที่ไม่ใช่ host เตะไม่ได้', () => {
    const room = roomWithPlayers(3)
    const ids = [...room.players.keys()]
    const notHost = ids.find((id) => id !== room.hostId)!
    const other = ids.find((id) => id !== room.hostId && id !== notHost)!
    const r = kickPlayer(room, notHost, other, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('เตะตัวเองไม่ได้', () => {
    const room = roomWithPlayers(3)
    const r = kickPlayer(room, room.hostId, room.hostId, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })

  it('เตะระหว่างเล่นไม่ได้', () => {
    const { room, others } = playingRoom()
    const target = others[0]
    const r = kickPlayer(room, room.hostId, target, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})
