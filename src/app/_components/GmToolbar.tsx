'use client'

import { useState } from 'react'
import type { RoomApi } from '../../lib/use-room'

type Step = 'idle' | 'pickVictim' | 'pickKiller'

export function GmToolbar({ api }: { api: RoomApi }) {
  const state = api.state!
  const [step, setStep] = useState<Step>('idle')
  const [victimId, setVictimId] = useState<string | null>(null)

  const alive = state.players.filter((p) => p.isAlive)
  const victim = state.players.find((p) => p.id === victimId) ?? null

  function reset() {
    setStep('idle')
    setVictimId(null)
  }

  function confirmKiller(killerId: string) {
    if (victimId) api.kill(victimId, killerId)
    reset()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t-2 border-sky-400 bg-slate-800 p-3">
      {step === 'idle' && (
        <>
          <div className="mb-2 text-sm text-slate-400">คุณเป็น Game Master</div>
          <button
            type="button"
            onClick={() => setStep('pickVictim')}
            className="mb-2 w-full rounded-xl bg-red-400 p-4 text-lg font-bold text-slate-900"
          >
            บันทึกคนตาย
          </button>
          {state.deaths.length > 0 && (
            <button
              type="button"
              onClick={() => api.undoKill(state.deaths.length - 1)}
              className="mb-2 w-full rounded-xl bg-slate-700 p-3"
            >
              เลิกทำครั้งล่าสุด
            </button>
          )}
          <button
            type="button"
            onClick={api.endRound}
            className="w-full rounded-xl bg-slate-700 p-3"
          >
            จบรอบนี้
          </button>
        </>
      )}

      {step === 'pickVictim' && (
        <>
          <div className="mb-2 text-sm text-slate-400">ใครพูดคำตัวเอง?</div>
          <div className="mb-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">
            {alive.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setVictimId(p.id)
                  setStep('pickKiller')
                }}
                className="rounded-xl bg-slate-700 p-3 font-bold"
              >
                {p.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={reset} className="w-full rounded-xl bg-slate-900 p-3">
            ยกเลิก
          </button>
        </>
      )}

      {step === 'pickKiller' && (
        <>
          <div className="mb-2 text-sm text-slate-400">ใครหลอก {victim?.name} ได้?</div>
          <div className="mb-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">
            {state.players
              .filter((p) => p.id !== victimId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => confirmKiller(p.id)}
                  className="rounded-xl bg-slate-700 p-3 font-bold"
                >
                  {p.name}
                </button>
              ))}
          </div>
          <button type="button" onClick={reset} className="w-full rounded-xl bg-slate-900 p-3">
            ยกเลิก
          </button>
        </>
      )}
    </div>
  )
}
