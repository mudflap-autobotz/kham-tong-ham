/** ค่าคงที่ทั้งระบบ — ห้าม hardcode ตัวเลขพวกนี้ที่อื่น */

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 10
export const DEFAULT_ROUNDS = 5

/** หน่วยเวลาพื้นฐาน — ที่อื่นคูณจากค่านี้ ห้ามเขียน 60_000 ซ้ำ */
export const MS_PER_MINUTE = 60_000

/** ทุก 4 คน เพิ่มเวลา 3 นาที */
export const PLAYERS_PER_TIME_BUCKET = 4
export const MINUTES_PER_TIME_BUCKET = 3

/** โอกาสที่รอบหนึ่งจะมีคำวิเศษ (คำใช้ทั่วไป หลุดธีม) แทรกเข้ามา 1 คำ */
export const WILDCARD_CHANCE = 0.5
/** ลึกกว่า MAX_PLAYERS มาก เพื่อให้แต่ละรอบหยิบคำได้ชุดต่างกันจริง */
export const MIN_WORDS_PER_PACK = 20

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

/** ผู้เล่นบนมือถือสลับเครือข่ายบ่อย ให้เวลากลับมาก่อนถือว่าหลุด */
export const RECONNECT_GRACE_MS = 30_000
/** ถี่กว่า 1 วินาที เพื่อไม่ให้เลขบนจอกระตุกข้ามวินาทีเวลา timer ถูกเลื่อน */
export const COUNTDOWN_TICK_MS = 250
/** เหลือเวลาน้อยกว่านี้ ตัวเลขเปลี่ยนเป็นสีแดงเตือน */
export const TIME_WARNING_SECONDS = 30
/** ตัวเลือกจำนวนรอบที่หน้าแรกให้กด — ต้องอยู่ในช่วง MIN_ROUNDS..MAX_ROUNDS */
export const ROUND_CHOICES = [3, 5, 7, 10]
/** ป้าย "คัดลอกแล้ว" ค้างไว้เท่านี้ก่อนกลับเป็นข้อความเดิม */
export const COPY_FEEDBACK_MS = 2_000
