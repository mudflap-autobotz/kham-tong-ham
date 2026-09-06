'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { COPY_FEEDBACK_MS, MIN_PLAYERS } from '../../../constants'
import type { RoomApi } from '../../lib/use-room'

export function Lobby({ api }: { api: RoomApi }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const state = api.state!

  const everyoneReady = state.players.every((p) => p.ready)
  const enoughPlayers = state.players.length >= MIN_PLAYERS
  const canStart = api.isHost && everyoneReady && enoughPlayers

  async function copyInvite() {
    const url = `${window.location.origin}/?code=${state.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      // เบราว์เซอร์บางตัวบล็อก clipboard — ให้ผู้ใช้ก๊อปจาก address bar เอง
      window.prompt('คัดลอกลิงก์นี้', url)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <div className="rounded-2xl bg-slate-800 p-4 text-center">
        <div className="text-sm text-slate-400">โค้ดห้อง</div>
        <div className="text-5xl font-bold tracking-[0.3em] text-sky-400">{state.code}</div>
        <button
          type="button"
          onClick={copyInvite}
          className="mt-3 w-full rounded-xl bg-slate-700 p-3 font-bold"
        >
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์เชิญ'}
        </button>
      </div>

      <div className="text-sm text-slate-400">
        ผู้เล่น {state.players.length} คน · {state.totalRounds} รอบ
      </div>

      {state.players.map((p) => (
        <div
          key={p.id}
          className={`flex items-center justify-between rounded-2xl bg-slate-800 p-4 ${
            p.connected ? '' : 'opacity-50'
          }`}
        >
          <span className="text-lg">
            {p.name}
            {p.id === state.viewerId && <span className="text-slate-400"> (คุณ)</span>}
            {p.isHost && (
              <span className="ml-2 rounded-full bg-sky-400 px-2 py-0.5 text-xs text-slate-900">
                host
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className={p.ready ? 'text-green-400' : 'text-slate-500'}>
              {!p.connected ? 'หลุด' : p.ready ? 'พร้อม' : 'ยังไม่พร้อม'}
            </span>
            {api.isHost && p.id !== state.viewerId && (
              <button
                type="button"
                onClick={() => api.kick(p.id)}
                aria-label={`เชิญ ${p.name} ออกจากห้อง`}
                className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-red-300"
              >
                เตะ
              </button>
            )}
          </span>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button
          type="button"
          onClick={() => api.setReady(!api.me?.ready)}
          className={`rounded-xl p-4 text-lg font-bold ${
            api.me?.ready ? 'bg-slate-700' : 'bg-green-400 text-slate-900'
          }`}
        >
          {api.me?.ready ? 'ยกเลิกพร้อม' : 'พร้อม'}
        </button>

        {api.isHost && (
          <>
            <button
              type="button"
              disabled={!canStart}
              onClick={api.startGame}
              className="rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900 disabled:opacity-40"
            >
              เริ่มเกม
            </button>
            {!canStart && (
              <p className="text-center text-sm text-slate-500">
                {!enoughPlayers
                  ? `ต้องมีอย่างน้อย ${MIN_PLAYERS} คน`
                  : 'รอให้ทุกคนกดพร้อมก่อน'}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => {
            api.leave()
            router.replace('/')
          }}
          className="p-3 text-sm text-slate-500"
        >
          ออกจากห้อง
        </button>
      </div>
    </main>
  )
}
