import { COUNTDOWN_MS, MAX_PLAYERS, MIN_PLAYERS } from '../../constants'
import { dealWords, loadPacks, pickPack } from './packs'
import { roundDurationMs } from './timing'
import { fail, ok, type Player, type Result, type Room } from './types'

export function createRoom(
  code: string,
  hostName: string,
  totalRounds: number,
  hostId: string,
  now: number,
): Room {
  return {
    code,
    hostId,
    phase: 'LOBBY',
    totalRounds,
    currentRound: 0,
    players: new Map([[hostId, newPlayer(hostId, hostName, now)]]),
    round: null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: now,
    lastActivityAt: now,
  }
}

/**
 * ใช้ทั้งตอนเข้าครั้งแรกและตอน reconnect
 * คนเดิมที่กลับมาต้องได้คะแนน คำ และบทบาทเดิมคืนครบ
 */
export function joinRoom(
  room: Room,
  name: string,
  playerId: string,
  now: number,
): Result<Player> {
  room.lastActivityAt = now

  const existing = room.players.get(playerId)
  if (existing) {
    existing.connected = true
    return ok(existing)
  }

  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เกมเริ่มไปแล้ว เข้าร่วมไม่ได้')
  }
  if (room.players.size >= MAX_PLAYERS) {
    return fail('ROOM_FULL', `ห้องเต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`)
  }

  const player = newPlayer(playerId, name, now)
  room.players.set(playerId, player)
  return ok(player)
}

export function setReady(room: Room, playerId: string, ready: boolean): Result {
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'กดพร้อมได้เฉพาะตอนรออยู่ในห้อง')
  }
  const p = room.players.get(playerId)
  if (!p) return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้')

  p.ready = ready
  return ok(undefined)
}

export function startCountdown(room: Room, playerId: string, now: number): Result {
  if (playerId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้')
  }
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เกมเริ่มไปแล้ว')
  }
  if (room.players.size < MIN_PLAYERS) {
    return fail('NOT_ENOUGH_PLAYERS', `ต้องมีอย่างน้อย ${MIN_PLAYERS} คน`)
  }
  if (![...room.players.values()].every((p) => p.ready)) {
    return fail('NOT_ALL_READY', 'ยังมีคนกดพร้อมไม่ครบ')
  }

  room.phase = 'COUNTDOWN'
  room.countdownEndsAt = now + COUNTDOWN_MS
  room.lastActivityAt = now
  return ok(undefined)
}

/**
 * เริ่มรอบใหม่ — สุ่ม pack สุ่ม GM แจกคำ ตั้งนาฬิกา
 * เรียกได้จาก 3 ที่: จบ countdown, กดรอบต่อไป, เล่นอีกรอบ
 */
export function beginRound(
  room: Room,
  now: number,
  rng: () => number = Math.random,
): Result {
  const packResult = pickPack(loadPacks(), room.usedPackIds, rng)
  if (!packResult.ok) return packResult

  const pack = packResult.value
  const playerIds = [...room.players.keys()]

  room.phase = 'PLAYING'
  room.currentRound += 1
  room.countdownEndsAt = null
  room.usedPackIds.push(pack.id)
  room.lastActivityAt = now

  for (const p of room.players.values()) p.ready = false

  room.round = {
    packId: pack.id,
    packTheme: pack.theme,
    gmId: pickGm(playerIds, room.lastGmId, rng),
    assignments: dealWords(pack, playerIds, rng),
    alive: new Set(playerIds),
    wordBurned: new Set(),
    deaths: [],
    guesses: new Map(),
    startedAt: now,
    endsAt: now + roundDurationMs(playerIds.length),
    endReason: null,
  }

  return ok(undefined)
}

function newPlayer(id: string, name: string, now: number): Player {
  return { id, name, connected: true, ready: false, score: 0, joinedAt: now }
}

/** เลี่ยงคนที่เพิ่งเป็น GM ถ้ายังมีคนอื่นให้เลือก */
function pickGm(playerIds: string[], lastGmId: string | null, rng: () => number): string {
  const pool = playerIds.filter((id) => id !== lastGmId)
  const from = pool.length > 0 ? pool : playerIds
  return from[Math.floor(rng() * from.length)]
}
