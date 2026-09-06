import { nanoid } from 'nanoid'
import { COUNTDOWN_MS, MAX_PLAYERS, MIN_PLAYERS } from '../../constants'
import { dealWords, loadPacks, pickPack } from './packs'
import { addScore, isCorrectGuess } from './scoring'
import { roundDurationMs } from './timing'
import {
  fail, ok, type EndReason, type Player, type Result, type Room, type Round, type RoundSummary,
} from './types'

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
  sessionToken: string | null,
  now: number,
): Result<Player> {
  room.lastActivityAt = now

  const existing = room.players.get(playerId)
  if (existing) {
    // playerId เป็นของสาธารณะ (ทุกคนเห็นใน MaskedPlayer.id) จึงพิสูจน์ตัวตนไม่ได้ด้วยตัวเอง
    if (existing.sessionToken !== sessionToken) {
      return fail('BAD_SESSION', 'ตัวตนนี้ถูกใช้อยู่แล้ว กรุณาเข้าร่วมด้วยชื่อใหม่')
    }
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

/** ออกจากห้องด้วยความตั้งใจ — ต่างจากเน็ตหลุด ที่ต้องกันที่นั่งไว้ให้ */
export function leaveRoom(room: Room, playerId: string, now: number): Result {
  room.lastActivityAt = now

  const player = room.players.get(playerId)
  if (!player) return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้ในห้อง')

  // ระหว่างเกม ตัวจริงยังนั่งอยู่ในวง ที่นั่งต้องอยู่ครบ — แค่หลุดจอ
  if (room.phase !== 'LOBBY') {
    player.connected = false
    return ok(undefined)
  }

  room.players.delete(playerId)

  // เจ้าของห้องเดินออก ต้องมีคนสืบทอด ไม่งั้นห้องค้างจนโดนกวาด
  // spec ไม่ได้กำหนดวิธีเลือก — โปรเจกต์นี้เลือก "คนที่เข้าห้องก่อนและยังต่ออยู่"
  if (playerId === room.hostId && room.players.size > 0) {
    const byJoin = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)
    room.hostId = (byJoin.find((p) => p.connected) ?? byJoin[0]).id
  }

  return ok(undefined)
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

/**
 * GM บันทึกว่าใครตายและใครเป็นคนหลอกสำเร็จ
 * คืนคำของคนตายเพื่อเปิดให้ทุกคนเห็น
 */
export function recordKill(
  room: Room,
  gmId: string,
  victimId: string,
  killerId: string,
  now: number,
): Result<string> {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'บันทึกได้เฉพาะตอนกำลังเล่น')
  }
  if (gmId !== round.gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }
  if (victimId === killerId) {
    return fail('INVALID_TARGET', 'คนตายกับคนหลอกต้องเป็นคนละคน')
  }
  if (!room.players.has(victimId) || !room.players.has(killerId)) {
    return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้ในห้อง')
  }
  if (!round.alive.has(victimId)) {
    return fail('ALREADY_DEAD', 'คนนี้ตายไปแล้ว')
  }

  round.alive.delete(victimId)
  round.wordBurned.add(victimId)
  round.deaths.push({ victimId, killerId, at: now })
  addScore(room, killerId, 1)
  room.lastActivityAt = now

  // เหลือคนรอดคนเดียว รอบจบทันที
  if (round.alive.size <= 1) {
    endRound(room, 'LAST_MAN', now)
  }

  return ok(round.assignments.get(victimId)!)
}

/**
 * ยกเลิกการบันทึกที่กดผิด
 * victim กลับมาเล่นต่อได้ แต่ยังติด wordBurned เพราะเห็นคำตัวเองไปแล้ว
 */
export function undoKill(room: Room, gmId: string, deathIndex: number): Result {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'ยกเลิกได้เฉพาะตอนกำลังเล่น')
  }
  if (gmId !== round.gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }

  const death = round.deaths[deathIndex]
  if (!death) return fail('INVALID_TARGET', 'ไม่พบรายการที่จะยกเลิก')

  round.deaths.splice(deathIndex, 1)
  round.alive.add(death.victimId)
  addScore(room, death.killerId, -1)
  // ไม่ลบออกจาก wordBurned โดยเจตนา — เห็นคำไปแล้วย้อนไม่ได้

  return ok(undefined)
}

export function endRound(room: Room, reason: EndReason, now: number): Result {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'รอบนี้จบไปแล้ว')
  }

  round.endReason = reason
  room.phase = 'ROUND_END'
  room.lastGmId = round.gmId
  room.lastActivityAt = now
  room.roundHistory.push(summarize(room, round, reason))

  return ok(undefined)
}

/** เวอร์ชันที่ GM เรียกเอง — แยกจาก endRound เพราะ endRound ถูกเรียกจาก timer ที่ไม่มีตัวตน */
export function endRoundByGm(room: Room, gmId: string, now: number): Result {
  if (room.round?.gmId !== gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }
  return endRound(room, 'GM', now)
}

/** host เตะคนออกจากห้อง ทำได้เฉพาะตอนอยู่ใน LOBBY */
export function kickPlayer(room: Room, hostId: string, targetId: string, now: number): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เตะคนได้เฉพาะตอนรออยู่ในห้อง')
  }
  if (targetId === hostId) {
    return fail('INVALID_TARGET', 'เตะตัวเองไม่ได้')
  }
  if (!room.players.delete(targetId)) {
    return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้ในห้อง')
  }

  room.lastActivityAt = now
  return ok(undefined)
}

/** ทายคำของตัวเองตอนจบรอบ ถูกได้ 1 คะแนน ส่งได้ครั้งเดียว */
export function submitGuess(room: Room, playerId: string, text: string): Result<boolean> {
  const round = room.round
  if (room.phase !== 'ROUND_END' || !round) {
    return fail('WRONG_PHASE', 'ทายคำได้เฉพาะตอนจบรอบ')
  }
  if (round.guesses.has(playerId)) {
    return fail('ALREADY_GUESSED', 'คุณส่งคำตอบไปแล้ว')
  }
  if (!round.alive.has(playerId) || round.wordBurned.has(playerId)) {
    return fail('CANNOT_GUESS', 'คุณเห็นคำของตัวเองไปแล้ว ทายไม่ได้')
  }

  const answer = round.assignments.get(playerId)
  if (!answer) return fail('PLAYER_NOT_FOUND', 'ไม่พบคำของคุณ')

  const correct = isCorrectGuess(text, answer)
  round.guesses.set(playerId, { text, correct })
  if (correct) addScore(room, playerId, 1)

  // อัปเดตประวัติรอบล่าสุดให้สะท้อนคนที่ทายถูก
  const last = room.roundHistory.at(-1)
  if (last && correct) last.correctGuessers.push(playerId)

  return ok(correct)
}

export function nextRound(
  room: Room,
  hostId: string,
  now: number,
  rng: () => number = Math.random,
): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'ROUND_END') {
    return fail('WRONG_PHASE', 'ยังไม่จบรอบ')
  }

  if (room.currentRound >= room.totalRounds) {
    room.phase = 'GAME_END'
    room.lastActivityAt = now
    return ok(undefined)
  }

  return beginRound(room, now, rng)
}

/** เล่นใหม่ด้วยคนกลุ่มเดิมในห้องเดิม */
export function restartGame(room: Room, hostId: string, now: number): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'GAME_END') {
    return fail('WRONG_PHASE', 'เกมยังไม่จบ')
  }

  room.phase = 'LOBBY'
  room.currentRound = 0
  room.round = null
  // เกมใหม่คือห้องใหม่ในทางปฏิบัติ — ไม่งั้นเกณฑ์ stale-lobby นับต่อจากห้องเดิมแล้วกวาดทิ้งกลางวง
  room.createdAt = now
  room.roundHistory = []
  room.usedPackIds = []
  room.lastGmId = null
  room.countdownEndsAt = null
  room.lastActivityAt = now
  for (const p of room.players.values()) {
    p.score = 0
    p.ready = false
  }

  return ok(undefined)
}

function summarize(room: Room, round: Round, reason: EndReason): RoundSummary {
  return {
    round: room.currentRound,
    packTheme: round.packTheme,
    gmId: round.gmId,
    endReason: reason,
    deaths: [...round.deaths],
    words: Object.fromEntries(round.assignments),
    correctGuessers: [],
  }
}

function newPlayer(id: string, name: string, now: number): Player {
  return {
    id, name, connected: true, ready: false, score: 0, joinedAt: now,
    sessionToken: nanoid(),
  }
}

/** เลี่ยงคนที่เพิ่งเป็น GM ถ้ายังมีคนอื่นให้เลือก */
function pickGm(playerIds: string[], lastGmId: string | null, rng: () => number): string {
  const pool = playerIds.filter((id) => id !== lastGmId)
  const from = pool.length > 0 ? pool : playerIds
  return from[Math.floor(rng() * from.length)]
}
