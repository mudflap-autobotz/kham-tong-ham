import {
  MINUTES_PER_TIME_BUCKET, MS_PER_MINUTE, PLAYERS_PER_TIME_BUCKET,
} from '../../constants'

/**
 * ทุก 4 คน (ปัดขึ้น) ได้เวลาเพิ่ม 3 นาที
 * 3-4 คน → 3 นาที · 5-8 → 6 · 9-12 → 9
 */
export function roundDurationMs(playerCount: number): number {
  const buckets = Math.ceil(playerCount / PLAYERS_PER_TIME_BUCKET)
  return buckets * MINUTES_PER_TIME_BUCKET * MS_PER_MINUTE
}
