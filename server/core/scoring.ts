import type { Room } from './types'

/** วรรณยุกต์ ไม้ไต่คู้ การันต์ (U+0E47–U+0E4E) — ไม่รวมสระ */
const THAI_TONE_MARKS = /[็-๎]/g

/**
 * ปรับคำให้เทียบกันได้ — ยอมให้พิมพ์วรรณยุกต์ผิดหรือเว้นวรรคเกิน
 * แต่ตัวสะกดกับสระต้องถูก เพราะคนที่รู้คำตัวเองอยู่แล้วควรพิมพ์ได้ถูก
 */
export function normalizeThai(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(THAI_TONE_MARKS, '')
    .normalize('NFC')
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  const g = normalizeThai(guess)
  if (g.length === 0) return false
  return g === normalizeThai(answer)
}

/** ปรับคะแนนสะสม ไม่ให้ติดลบ (undo ที่คืนเกินจริงไม่ควรทำให้คะแนนเพี้ยน) */
export function addScore(room: Room, playerId: string, delta: number): void {
  const p = room.players.get(playerId)
  if (!p) return
  p.score = Math.max(0, p.score + delta)
}
