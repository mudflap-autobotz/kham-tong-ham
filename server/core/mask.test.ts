import { describe, it, expect } from 'vitest'
import { maskFor } from './mask'
import type { Phase, Room } from './types'

const IDS = ['p1', 'p2', 'p3', 'p4']
const WORDS: Record<string, string> = {
  p1: 'ลูกชิ้นปิ้ง',
  p2: 'ปาท่องโก๋',
  p3: 'ส้มตำ',
  p4: 'น้ำแข็งไส',
}

function makeRoom(opts: {
  phase: Phase
  dead?: string[]
  guessed?: string[]
  burned?: string[]
}): Room {
  const dead = new Set(opts.dead ?? [])
  const hasRound = opts.phase !== 'LOBBY' && opts.phase !== 'COUNTDOWN'

  return {
    code: 'ABC234',
    hostId: 'p1',
    phase: opts.phase,
    totalRounds: 3,
    currentRound: 1,
    players: new Map(
      IDS.map((id) => [
        id,
        { id, name: id.toUpperCase(), connected: true, ready: true, score: 0, joinedAt: 0 },
      ]),
    ),
    round: hasRound
      ? {
          packId: 'street-food',
          packTheme: 'ของกินริมทาง',
          gmId: 'p2',
          assignments: new Map(Object.entries(WORDS)),
          alive: new Set(IDS.filter((id) => !dead.has(id))),
          wordBurned: new Set([...dead, ...(opts.burned ?? [])]),
          deaths: [...dead].map((id) => ({ victimId: id, killerId: 'p1', at: 0 })),
          guesses: new Map(
            (opts.guessed ?? []).map((id) => [id, { text: WORDS[id], correct: true }]),
          ),
          startedAt: 0,
          endsAt: 999_999,
          endReason: opts.phase === 'ROUND_END' ? 'TIME' : null,
        }
      : null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  }
}

const wordOf = (room: Room, viewerId: string, targetId: string) =>
  maskFor(room, viewerId).players.find((p) => p.id === targetId)!.word

describe('maskFor — ไม่มีใครเห็นคำตัวเองระหว่างเล่น', () => {
  it('ทุกคนที่ยังไม่ตาย เห็นคำตัวเองเป็น null ตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const id of IDS) {
      expect(wordOf(room, id, id), `${id} ไม่ควรเห็นคำตัวเอง`).toBeNull()
    }
  })

  it('ทุกคนเห็นคำของคนอื่นครบตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const viewer of IDS) {
      for (const target of IDS) {
        if (viewer === target) continue
        expect(wordOf(room, viewer, target)).toBe(WORDS[target])
      }
    }
  })

  it('GM ก็ไม่เห็นคำตัวเอง', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    expect(wordOf(room, 'p2', 'p2')).toBeNull()
  })

  it('คนตายแล้วเห็นคำตัวเองได้', () => {
    const room = makeRoom({ phase: 'PLAYING', dead: ['p3'] })
    expect(wordOf(room, 'p3', 'p3')).toBe(WORDS.p3)
  })

  it('คนตายแล้วไม่ทำให้คนอื่นเห็นคำตัวเอง', () => {
    const room = makeRoom({ phase: 'PLAYING', dead: ['p3'] })
    expect(wordOf(room, 'p1', 'p1')).toBeNull()
  })
})

describe('maskFor — เปิดคำเมื่อจบรอบ', () => {
  it('ROUND_END เปิดคำทุกคนให้ทุกคน', () => {
    const room = makeRoom({ phase: 'ROUND_END' })
    for (const viewer of IDS) {
      for (const target of IDS) {
        expect(wordOf(room, viewer, target)).toBe(WORDS[target])
      }
    }
  })

  it('GAME_END เปิดคำทุกคน', () => {
    const room = makeRoom({ phase: 'GAME_END' })
    expect(wordOf(room, 'p1', 'p1')).toBe(WORDS.p1)
  })
})

describe('maskFor — ก่อนแจกคำ', () => {
  it('LOBBY ทุกคนไม่มีคำ', () => {
    const room = makeRoom({ phase: 'LOBBY' })
    for (const id of IDS) expect(wordOf(room, id, id)).toBeNull()
  })

  it('COUNTDOWN ทุกคนไม่มีคำ', () => {
    const room = makeRoom({ phase: 'COUNTDOWN' })
    for (const id of IDS) expect(wordOf(room, id, id)).toBeNull()
  })
})

describe('maskFor — คำต้องไม่หลุดใน payload ทั้งก้อน', () => {
  it('คำของผู้ชมไม่ปรากฏใน JSON ที่ส่งออกเลย ตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const id of IDS) {
      const json = JSON.stringify(maskFor(room, id))
      expect(json, `คำของ ${id} หลุดไปใน payload`).not.toContain(WORDS[id])
    }
  })
})

describe('maskFor — ธงสถานะ', () => {
  it('บอกว่าใครเป็น host และใครเป็น GM', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    expect(s.players.find((p) => p.id === 'p1')!.isHost).toBe(true)
    expect(s.players.find((p) => p.id === 'p2')!.isGm).toBe(true)
    expect(s.players.find((p) => p.id === 'p3')!.isGm).toBe(false)
  })

  it('บอกว่าใครยังไม่ตาย', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING', dead: ['p3'] }), 'p1')
    expect(s.players.find((p) => p.id === 'p3')!.isAlive).toBe(false)
    expect(s.players.find((p) => p.id === 'p1')!.isAlive).toBe(true)
  })

  it('canGuess เป็นจริงเฉพาะคนรอดที่ยังไม่ทาย ตอน ROUND_END', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', dead: ['p3'], guessed: ['p1'] }), 'p1')
    const by = (id: string) => s.players.find((p) => p.id === id)!
    expect(by('p1').canGuess).toBe(false) // ทายไปแล้ว
    expect(by('p2').canGuess).toBe(true)  // รอด ยังไม่ทาย
    expect(by('p3').canGuess).toBe(false) // ตายแล้ว
  })

  it('guessCorrect บอกผลการทาย และเป็น null เมื่อยังไม่ทาย', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', guessed: ['p1'] }), 'p1')
    expect(s.players.find((p) => p.id === 'p1')!.guessCorrect).toBe(true)
    expect(s.players.find((p) => p.id === 'p2')!.guessCorrect).toBeNull()
  })

  it('คนที่ติด wordBurned ทายไม่ได้แม้จะยังรอด', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', burned: ['p4'] }), 'p4')
    expect(s.players.find((p) => p.id === 'p4')!.canGuess).toBe(false)
  })

  it('canGuess เป็นเท็จทุกคนตอน PLAYING', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    for (const p of s.players) expect(p.canGuess).toBe(false)
  })

  it('เรียงผู้เล่นตามลำดับการเข้าห้อง', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    expect(s.players.map((p) => p.id)).toEqual(IDS)
  })
})

describe('maskFor — viewer ที่ไม่อยู่ในห้อง ต้องไม่เห็นคำใครเลย', () => {
  it('viewer id แปลกปลอมไม่เห็นคำใครเลยตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    const json = JSON.stringify(maskFor(room, 'ghost'))
    for (const id of IDS) {
      expect(json, `คำของ ${id} หลุดไปหา viewer แปลกปลอม`).not.toContain(WORDS[id])
    }
  })

  it('viewer id แปลกปลอมไม่เห็นคำใครเลยตอน ROUND_END', () => {
    const room = makeRoom({ phase: 'ROUND_END' })
    const json = JSON.stringify(maskFor(room, 'ghost'))
    for (const id of IDS) {
      expect(json, `คำของ ${id} หลุดไปหา viewer แปลกปลอม`).not.toContain(WORDS[id])
    }
  })
})

describe('maskFor — roundHistory', () => {
  it('roundHistory ส่งผ่านทั้งก้อนให้ทุกคนเหมือนกัน เพราะคำของรอบที่จบแล้วเปิดอยู่แล้ว', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    room.roundHistory = [
      {
        round: 1,
        packTheme: 'ของกินริมทาง',
        gmId: 'p2',
        endReason: 'TIME',
        deaths: [],
        words: WORDS,
        correctGuessers: ['p1'],
      },
    ]

    for (const viewer of IDS) {
      expect(maskFor(room, viewer).roundHistory).toEqual(room.roundHistory)
    }
  })
})
