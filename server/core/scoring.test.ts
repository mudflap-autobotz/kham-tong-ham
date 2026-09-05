import { describe, it, expect } from 'vitest'
import { normalizeThai, isCorrectGuess, addScore } from './scoring'
import type { Room } from './types'

describe('normalizeThai', () => {
  it('ตัดช่องว่างหัวท้ายและช่องว่างกลางคำ', () => {
    expect(normalizeThai('  ลูกชิ้น ปิ้ง  ')).toBe(normalizeThai('ลูกชิ้นปิ้ง'))
  })

  it('ตัดวรรณยุกต์ออก', () => {
    expect(normalizeThai('ก๋วยเตี๋ยว')).toBe('กวยเตียว')
    expect(normalizeThai('ส้มตำ')).toBe('สมตำ')
  })

  it('ไม่ตัดสระ — สระผิดถือว่าผิด', () => {
    expect(normalizeThai('พริก')).not.toBe(normalizeThai('พรก'))
  })

  it('ตัดการันต์ออก', () => {
    expect(normalizeThai('รีโมท')).toBe('รีโมท')
    expect(normalizeThai('สัตว์')).toBe('สัตว')
  })

  it('ตัวอักษรอังกฤษกลายเป็นตัวเล็ก', () => {
    expect(normalizeThai('OverTime')).toBe('overtime')
  })
})

describe('isCorrectGuess', () => {
  it('ตรงเป๊ะ ถือว่าถูก', () => {
    expect(isCorrectGuess('ปาท่องโก๋', 'ปาท่องโก๋')).toBe(true)
  })

  it('วรรณยุกต์ผิด ยังถือว่าถูก', () => {
    expect(isCorrectGuess('ปาทองโก', 'ปาท่องโก๋')).toBe(true)
  })

  it('มีช่องว่างเกิน ยังถือว่าถูก', () => {
    expect(isCorrectGuess(' ลูกชิ้น ปิ้ง ', 'ลูกชิ้นปิ้ง')).toBe(true)
  })

  it('ตัวสะกดผิด ถือว่าผิด', () => {
    expect(isCorrectGuess('ปาท่องโก๊ะ', 'ปาท่องโก๋')).toBe(false)
  })

  it('คำอื่นไปเลย ถือว่าผิด', () => {
    expect(isCorrectGuess('ส้มตำ', 'ปาท่องโก๋')).toBe(false)
  })

  it('คำว่างเปล่า ถือว่าผิด', () => {
    expect(isCorrectGuess('', 'ปาท่องโก๋')).toBe(false)
    expect(isCorrectGuess('   ', 'ปาท่องโก๋')).toBe(false)
  })
})

function roomWith(scores: Record<string, number>): Room {
  return {
    code: 'ABC234',
    hostId: 'p1',
    phase: 'PLAYING',
    totalRounds: 3,
    currentRound: 1,
    players: new Map(
      Object.entries(scores).map(([id, score]) => [
        id,
        { id, name: id, connected: true, ready: true, score, joinedAt: 0 },
      ]),
    ),
    round: null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  }
}

describe('addScore', () => {
  it('บวกคะแนนให้ผู้เล่น', () => {
    const room = roomWith({ p1: 2 })
    addScore(room, 'p1', 1)
    expect(room.players.get('p1')!.score).toBe(3)
  })

  it('ลบคะแนนได้ (ใช้ตอน undo)', () => {
    const room = roomWith({ p1: 2 })
    addScore(room, 'p1', -1)
    expect(room.players.get('p1')!.score).toBe(1)
  })

  it('คะแนนไม่ต่ำกว่าศูนย์', () => {
    const room = roomWith({ p1: 0 })
    addScore(room, 'p1', -1)
    expect(room.players.get('p1')!.score).toBe(0)
  })

  it('ผู้เล่นที่ไม่มีอยู่ ไม่ทำให้พัง', () => {
    const room = roomWith({ p1: 2 })
    expect(() => addScore(room, 'ghost', 1)).not.toThrow()
  })
})
