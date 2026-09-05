export type Phase = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_END' | 'GAME_END'

export type EndReason = 'TIME' | 'LAST_MAN' | 'GM'

export type Player = {
  id: string
  name: string
  connected: boolean
  ready: boolean
  score: number
  joinedAt: number
}

export type Death = {
  victimId: string
  killerId: string
  at: number
}

export type Guess = {
  text: string
  correct: boolean
}

export type Round = {
  packId: string
  packTheme: string
  gmId: string
  /** playerId → คำ — ห้ามหลุดออกจาก server โดยไม่ผ่าน maskFor() */
  assignments: Map<string, string>
  alive: Set<string>
  /** คนที่เคยเห็นคำตัวเองแล้ว หมดสิทธิ์ทายคำแม้จะ undo กลับมา alive */
  wordBurned: Set<string>
  deaths: Death[]
  guesses: Map<string, Guess>
  startedAt: number
  endsAt: number
  endReason: EndReason | null
}

/** สรุปหนึ่งรอบ เก็บไว้แสดงในหน้าสรุปท้ายเกม */
export type RoundSummary = {
  round: number
  packTheme: string
  gmId: string
  endReason: EndReason
  deaths: Death[]
  words: Record<string, string>
  correctGuessers: string[]
}

export type Room = {
  code: string
  hostId: string
  phase: Phase
  totalRounds: number
  currentRound: number
  players: Map<string, Player>
  round: Round | null
  usedPackIds: string[]
  /** GM ของรอบที่แล้ว ใช้เลี่ยงการสุ่มซ้ำคนเดิม */
  lastGmId: string | null
  roundHistory: RoundSummary[]
  countdownEndsAt: number | null
  createdAt: number
  lastActivityAt: number
}

export type Pack = {
  id: string
  theme: string
  words: string[]
}

/** มุมมองของผู้เล่นหนึ่งคน — สิ่งเดียวที่ถูกส่งออกจาก server */
export type MaskedPlayer = {
  id: string
  name: string
  connected: boolean
  ready: boolean
  score: number
  isHost: boolean
  isGm: boolean
  isAlive: boolean
  /** null = ยังไม่ควรเห็นคำนี้ */
  word: string | null
  hasGuessed: boolean
  /** ผลการทายคำ — null เมื่อยังไม่ได้ทาย */
  guessCorrect: boolean | null
  canGuess: boolean
}

export type MaskedRoomState = {
  code: string
  phase: Phase
  viewerId: string
  totalRounds: number
  currentRound: number
  players: MaskedPlayer[]
  packTheme: string | null
  endsAt: number | null
  countdownEndsAt: number | null
  deaths: Death[]
  endReason: EndReason | null
  roundHistory: RoundSummary[]
}

/** ผลลัพธ์ของทุกฟังก์ชันใน core ที่อาจปฏิเสธคำสั่ง */
export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: ErrorCode; message: string }

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'SERVER_FULL'
  | 'RATE_LIMITED'
  | 'NOT_HOST'
  | 'NOT_GM'
  | 'WRONG_PHASE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_ALL_READY'
  | 'PLAYER_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'ALREADY_DEAD'
  | 'ALREADY_GUESSED'
  | 'CANNOT_GUESS'
  | 'INVALID_INPUT'
  | 'NO_PACK_AVAILABLE'

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = (code: ErrorCode, message: string): Result<never> =>
  ({ ok: false, code, message })
