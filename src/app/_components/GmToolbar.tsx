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

  // รอบจบไปแล้ว ย้อนได้แค่รายการสุดท้ายที่เป็นตัวปิดรอบ (ดู undoKill ฝั่ง server)
  const roundOver = state.phase !== 'PLAYING'
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?'

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
          {!roundOver && (
            <button
              type="button"
              onClick={() => setStep('pickVictim')}
              className="mb-2 w-full rounded-xl bg-red-400 p-4 text-lg font-bold text-slate-900"
            >
              บันทึกคนตาย
            </button>
          )}

          {state.deaths.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-xs text-slate-500">
                {roundOver ? 'กดผิด? ย้อนรายการสุดท้ายได้' : 'รายการที่บันทึกไว้'}
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {state.deaths.map((d, i) => {
                  // ตอนรอบจบแล้ว ย้อนได้เฉพาะตัวสุดท้าย รายการอื่นโชว์ไว้เฉยๆ
                  const undoable = !roundOver || i === state.deaths.length - 1
                  return (
                    <li key={`${d.victimId}-${d.at}`} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {nameOf(d.victimId)}{' '}
                        <span className="text-slate-500">โดน {nameOf(d.killerId)} หลอก</span>
                      </span>
                      {undoable && (
                        <button
                          type="button"
                          onClick={() => api.undoKill(i)}
                          className="shrink-0 rounded-lg bg-slate-700 px-3 py-1 text-sm"
                        >
                          เลิกทำ
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {!roundOver && (
            <button
              type="button"
              onClick={api.endRound}
              className="w-full rounded-xl bg-slate-700 p-3"
            >
              จบรอบนี้
            </button>
          )}
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
