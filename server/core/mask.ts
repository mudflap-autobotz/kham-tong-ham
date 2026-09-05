import type { MaskedPlayer, MaskedRoomState, Room } from './types'

/**
 * ทางออกเดียวของ state ไปสู่ client
 * ห้าม emit `Room` ดิบไม่ว่ากรณีใด — คำของผู้เล่นจะหลุด
 */
export function maskFor(room: Room, viewerId: string): MaskedRoomState {
  const round = room.round
  const roundEnded = room.phase === 'ROUND_END' || room.phase === 'GAME_END'

  const players: MaskedPlayer[] = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => {
      const isAlive = round ? round.alive.has(p.id) : true
      const guess = round?.guesses.get(p.id) ?? null
      const hasGuessed = guess !== null
      const burned = round ? round.wordBurned.has(p.id) : false

      return {
        id: p.id,
        name: p.name,
        connected: p.connected,
        ready: p.ready,
        score: p.score,
        isHost: p.id === room.hostId,
        isGm: round ? p.id === round.gmId : false,
        isAlive,
        word: visibleWord(room, viewerId, p.id),
        hasGuessed,
        guessCorrect: guess?.correct ?? null,
        canGuess: room.phase === 'ROUND_END' && isAlive && !burned && !hasGuessed,
      }
    })

  return {
    code: room.code,
    phase: room.phase,
    viewerId,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    players,
    packTheme: roundEnded || room.phase === 'PLAYING' ? (round?.packTheme ?? null) : null,
    endsAt: room.phase === 'PLAYING' ? (round?.endsAt ?? null) : null,
    countdownEndsAt: room.countdownEndsAt,
    deaths: round?.deaths ?? [],
    endReason: round?.endReason ?? null,
    roundHistory: room.roundHistory,
  }
}

/** คืน null เมื่อผู้ชมยังไม่ควรเห็นคำนี้ — ไม่ใช่คืนคำแล้วให้ UI ซ่อน */
function visibleWord(room: Room, viewerId: string, targetId: string): string | null {
  const round = room.round
  if (!round) return null

  const word = round.assignments.get(targetId) ?? null
  if (word === null) return null

  // จบรอบแล้ว เปิดหมด
  if (room.phase === 'ROUND_END' || room.phase === 'GAME_END') return word

  // คำของคนอื่น เห็นได้เสมอระหว่างเล่น
  if (targetId !== viewerId) return word

  // คำของตัวเอง เห็นได้ต่อเมื่อตายไปแล้ว
  return round.alive.has(viewerId) ? null : word
}
