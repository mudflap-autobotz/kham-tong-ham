import { customAlphabet } from 'nanoid'
import {
  EMPTY_ROOM_TTL_MS, FINISHED_ROOM_TTL_MS, MAX_ROOMS,
  ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, STALE_LOBBY_TTL_MS,
} from '../../constants'
import { createRoom } from './game'
import { fail, ok, type Result, type Room } from './types'

const genCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)

/**
 * ที่เก็บห้องทั้งหมดของเซิร์ฟเวอร์
 * นี่คือจุดเดียวที่ต้องแก้ถ้าย้ายไป Redis — game.ts ไม่รู้จักคลาสนี้
 */
export class RoomStore {
  private rooms = new Map<string, Room>()

  create(hostName: string, totalRounds: number, hostId: string, now: number): Result<Room> {
    // กวาดห้องร้างก่อนเสมอ เพื่อคืนที่ว่างก่อนจะปฏิเสธคนใหม่
    this.sweep(now)

    if (this.rooms.size >= MAX_ROOMS) {
      return fail('SERVER_FULL', 'เซิร์ฟเวอร์เต็ม ลองใหม่อีกครั้งในภายหลัง')
    }

    const room = createRoom(this.freshCode(), hostName, totalRounds, hostId, now)
    this.rooms.set(room.code, room)
    return ok(room)
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase())
  }

  size(): number {
    return this.rooms.size
  }

  all(): Room[] {
    return [...this.rooms.values()]
  }

  /** ลบห้องที่ไม่มีใครใช้แล้ว คืนจำนวนที่ลบ */
  sweep(now: number): number {
    let removed = 0
    for (const [code, room] of this.rooms) {
      if (this.isStale(room, now)) {
        this.rooms.delete(code)
        removed++
      }
    }
    return removed
  }

  private isStale(room: Room, now: number): boolean {
    const anyoneHere = [...room.players.values()].some((p) => p.connected)
    const idleFor = now - room.lastActivityAt

    if (!anyoneHere && idleFor > EMPTY_ROOM_TTL_MS) return true
    // spec สั่งทั้ง "ลบ LOBBY เก่าเกิน 60 นาที" และ "ห้ามลบห้องที่ยังมีคนอยู่" — ข้อหลังชนะ
    if (!anyoneHere && room.phase === 'LOBBY' && now - room.createdAt > STALE_LOBBY_TTL_MS) {
      return true
    }
    if (room.phase === 'GAME_END' && idleFor > FINISHED_ROOM_TTL_MS) return true

    return false
  }

  private freshCode(): string {
    let code = genCode()
    while (this.rooms.has(code)) code = genCode()
    return code
  }
}
