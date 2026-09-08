import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MIN_WORDS_PER_PACK, WILDCARD_CHANCE } from '../../constants'
import { fail, ok, type Pack, type Result } from './types'

type PackFile = { packs: Pack[]; wildcards: string[] }

let cache: PackFile | null = null

/**
 * อ่าน data/packs.json ครั้งเดียวแล้วจำไว้
 * ตรวจความถูกต้องตอนโหลด — pack ที่คำไม่พอทำให้เกมพังกลางคัน จึงต้องรู้ตั้งแต่ต้น
 */
function load(): PackFile {
  if (cache) return cache

  const path = fileURLToPath(new URL('../../data/packs.json', import.meta.url))
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as PackFile

  const seenIds = new Set<string>()
  for (const p of parsed.packs) {
    if (seenIds.has(p.id)) {
      throw new Error(`pack id "${p.id}" ซ้ำกัน`)
    }
    seenIds.add(p.id)
    if (p.words.length < MIN_WORDS_PER_PACK) {
      throw new Error(`pack "${p.id}" มี ${p.words.length} คำ ต้องมีอย่างน้อย ${MIN_WORDS_PER_PACK}`)
    }
    if (new Set(p.words).size !== p.words.length) {
      throw new Error(`pack "${p.id}" มีคำซ้ำกันภายใน`)
    }
  }

  if (parsed.wildcards.length === 0) {
    throw new Error('ไม่มีคำวิเศษใน packs.json')
  }
  if (new Set(parsed.wildcards).size !== parsed.wildcards.length) {
    throw new Error('คำวิเศษซ้ำกันเอง')
  }
  // คำวิเศษต้องหลุดธีมทุก pack — ถ้าชนกับคำในธีม ผู้เล่นแยกไม่ออกว่ามันคือคำวิเศษ
  // และ injectWildcard อาศัย invariant นี้เพื่อไม่แจกคำซ้ำกันสองคน
  const inPacks = new Set(parsed.packs.flatMap((p) => p.words))
  const clash = parsed.wildcards.filter((w) => inPacks.has(w))
  if (clash.length > 0) {
    throw new Error(`คำวิเศษชนกับคำใน pack: ${clash.join(' ')}`)
  }

  cache = parsed
  return cache
}

export function loadPacks(): Pack[] {
  return load().packs
}

/** คำใช้ทั่วไปที่ไม่อยู่ในธีมไหน — แทรกเข้ารอบธรรมดาเพื่อความหลากหลาย */
export function loadWildcards(): string[] {
  return load().wildcards
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

/**
 * สุ่มว่ารอบนี้จะมีคำวิเศษไหม ถ้ามีก็ทับคำของคน 1 คน
 * คืน Map ใหม่เสมอ ไม่แก้ของเดิม
 *
 * ตั้งใจไม่บอกใครว่าใครถือคำวิเศษ — ทุกคนเห็นตอน ROUND_END ที่เปิดคำพร้อมกัน
 */
export function injectWildcard(
  assignments: Map<string, string>,
  wildcards: string[],
  rng: () => number = Math.random,
): Map<string, string> {
  const out = new Map(assignments)
  if (rng() >= WILDCARD_CHANCE || out.size === 0) return out

  // ถ้าข้อมูลพัง (คำวิเศษชนกับคำในธีม) การกรองนี้กันไม่ให้สองคนได้คำเดียวกัน
  const dealt = new Set(out.values())
  const pool = wildcards.filter((w) => !dealt.has(w))
  if (pool.length === 0) return out

  const targetId = shuffle([...out.keys()], rng)[0]
  out.set(targetId, pool[Math.floor(rng() * pool.length)])
  return out
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
