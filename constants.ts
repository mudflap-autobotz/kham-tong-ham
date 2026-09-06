/** ค่าคงที่ทั้งระบบ — ห้าม hardcode ตัวเลขพวกนี้ที่อื่น */

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 10
export const DEFAULT_ROUNDS = 5

/** ทุก 4 คน เพิ่มเวลา 5 นาที */
export const PLAYERS_PER_TIME_BUCKET = 4
export const MINUTES_PER_TIME_BUCKET = 5

export const COUNTDOWN_MS = 3_000

export const MAX_ROOMS = 200
export const SWEEP_INTERVAL_MS = 5 * 60_000
/** ห้องที่ไม่มีใคร connected นานกว่านี้ ถูกลบ */
export const EMPTY_ROOM_TTL_MS = 30 * 60_000
/** ห้อง LOBBY ที่ไม่เคยเริ่มเกม นานกว่านี้ ถูกลบ */
export const STALE_LOBBY_TTL_MS = 60 * 60_000
/** ห้องที่จบเกมแล้ว นานกว่านี้ ถูกลบ */
export const FINISHED_ROOM_TTL_MS = 30 * 60_000

export const ROOM_CREATE_LIMIT = 3
export const ROOM_CREATE_WINDOW_MS = 60_000

export const ROOM_CODE_LENGTH = 6
/** ตัด I O 0 1 ออกเพราะอ่านสับสนตอนบอกกันปากเปล่า */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const MAX_NAME_LENGTH = 20
export const MAX_GUESS_LENGTH = 60
/** playerId มาจาก nanoid() ฝั่ง client อาจส่ง id เก่ามาตอน reconnect */
export const MAX_PLAYER_ID_LENGTH = 64
