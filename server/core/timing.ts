import {
  MINUTES_PER_TIME_BUCKET, MS_PER_MINUTE, PLAYERS_PER_TIME_BUCKET,
} from '../../constants'

/**
 * ทุก 4 คน (ปัดขึ้น) ได้เวลาเพิ่ม 5 นาที
 * 3-4 คน → 5 นาที · 5-8 → 10 · 9-12 → 15
 */
export function roundDurationMs(playerCount: number): number {
  const buckets = Math.ceil(playerCount / PLAYERS_PER_TIME_BUCKET)
  return buckets * MINUTES_PER_TIME_BUCKET * MS_PER_MINUTE
}
