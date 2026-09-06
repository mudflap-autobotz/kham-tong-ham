'use client'

import { TIME_WARNING_SECONDS } from '../../../constants'
import { formatClock, useCountdown } from '../../lib/use-countdown'
import type { RoomApi } from '../../lib/use-room'
import { GmToolbar } from './GmToolbar'
import { PlayerCard } from './PlayerCard'

export function Playing({ api }: { api: RoomApi }) {
  const state = api.state!
  const remaining = useCountdown(state.endsAt)

  const others = state.players.filter((p) => p.id !== state.viewerId)
  const me = api.me

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4 pb-56">
      <div className="flex justify-between text-sm text-slate-400">
        <span>
          รอบ {state.currentRound}/{state.totalRounds}
        </span>
        <span>หมวด: {state.packTheme}</span>
      </div>

      <div
        className={`text-center text-5xl font-bold tabular-nums ${
          remaining <= TIME_WARNING_SECONDS ? 'text-red-400' : 'text-slate-100'
        }`}
      >
        {formatClock(remaining)}
      </div>

      {me && <PlayerCard player={me} isMe />}

      {me && !me.isAlive && (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-sm text-slate-400">
          คุณตายแล้ว — คำของคุณเปิดให้เห็นด้านบน คุยกับเพื่อนต่อเพื่อหลอกคนอื่นได้
        </p>
      )}

      <div className="mt-2 text-sm text-slate-400">คำของคนอื่น</div>
      {others.map((p) => (
        <PlayerCard key={p.id} player={p} isMe={false} />
      ))}

      {api.isGm && <GmToolbar api={api} />}
    </main>
  )
}
