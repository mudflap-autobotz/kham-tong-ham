'use client'

import { useEffect, useState } from 'react'

/**
 * นับถอยหลังจาก timestamp ปลายทาง
 * server ไม่ส่ง tick รายวินาที — client คำนวณเองจาก endsAt
 */
export function useCountdown(target: number | null): number {
  const [remaining, setRemaining] = useState(() => secondsLeft(target))

  useEffect(() => {
    if (target === null) {
      setRemaining(0)
      return
    }

    setRemaining(secondsLeft(target))
    const id = setInterval(() => setRemaining(secondsLeft(target)), 250)
    return () => clearInterval(id)
  }, [target])

  return remaining
}

function secondsLeft(target: number | null): number {
  if (target === null) return 0
  return Math.max(0, Math.ceil((target - Date.now()) / 1000))
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
