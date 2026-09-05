import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MAX_PLAYERS } from '../../constants'
import { fail, ok, type Pack, type Result } from './types'

let cache: Pack[] | null = null

/**
 * อ่าน data/packs.json ครั้งเดียวแล้วจำไว้
 * ตรวจความถูกต้องตอนโหลด — pack ที่คำไม่พอทำให้เกมพังกลางคัน จึงต้องรู้ตั้งแต่ต้น
 */
export function loadPacks(): Pack[] {
  if (cache) return cache

  const path = fileURLToPath(new URL('../../data/packs.json', import.meta.url))
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { packs: Pack[] }

  for (const p of parsed.packs) {
    if (p.words.length < MAX_PLAYERS) {
      throw new Error(`pack "${p.id}" มี ${p.words.length} คำ ต้องมีอย่างน้อย ${MAX_PLAYERS}`)
    }
    if (new Set(p.words).size !== p.words.length) {
      throw new Error(`pack "${p.id}" มีคำซ้ำกันภายใน`)
    }
  }

  cache = parsed.packs
  return cache
}

export function pickPack(
  packs: Pack[],
  usedPackIds: string[],
  rng: () => number = Math.random,
): Result<Pack> {
  if (packs.length === 0) {
    return fail('NO_PACK_AVAILABLE', 'ไม่มีชุดคำให้เล่น')
  }

  const unused = packs.filter((p) => !usedPackIds.includes(p.id))
  // ใช้ครบทุก pack แล้ววนกลับมาใช้ซ้ำได้ — เกมยาวกว่าจำนวน pack ไม่ควรพัง
  const pool = unused.length > 0 ? unused : packs

  return ok(pool[Math.floor(rng() * pool.length)])
}

export function dealWords(
  pack: Pack,
  playerIds: string[],
  rng: () => number = Math.random,
): Map<string, string> {
  if (pack.words.length < playerIds.length) {
    throw new Error(`pack "${pack.id}" มีคำไม่พอสำหรับ ${playerIds.length} คน`)
  }

  const shuffled = shuffle(pack.words, rng)
  return new Map(playerIds.map((id, i) => [id, shuffled[i]]))
}

/** Fisher-Yates */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
