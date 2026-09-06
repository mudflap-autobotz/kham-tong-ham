'use client'

import { useCountdown } from '../../lib/use-countdown'
import type { RoomApi } from '../../lib/use-room'

export function Countdown({ api }: { api: RoomApi }) {
  const seconds = useCountdown(api.state!.countdownEndsAt)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="text-[8rem] font-bold leading-none text-sky-400">
        {seconds > 0 ? seconds : 'เริ่ม!'}
      </div>
      <div className="text-slate-400">กำลังแจกคำ...</div>
    </main>
  )
}
