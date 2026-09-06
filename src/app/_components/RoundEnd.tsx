'use client'

import { useState } from 'react'
import { MAX_GUESS_LENGTH } from '../../../constants'
import type { RoomApi } from '../../lib/use-room'
import { PlayerCard } from './PlayerCard'

const END_REASON_TEXT: Record<string, string> = {
  TIME: 'หมดเวลา',
  LAST_MAN: 'เหลือคนรอดคนสุดท้าย',
  GM: 'Game Master จบรอบ',
}

export function RoundEnd({ api }: { api: RoomApi }) {
  const state = api.state!
  const [text, setText] = useState('')
  const me = api.me
  const isLastRound = state.currentRound >= state.totalRounds

  const standings = [...state.players].sort((a, b) => b.score - a.score)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <h2 className="text-xl font-bold">
        จบรอบ {state.currentRound} — {END_REASON_TEXT[state.endReason ?? ''] ?? ''}
      </h2>

      {me?.canGuess && (
        <div className="rounded-2xl bg-slate-800 p-4 ring-2 ring-sky-400">
          <div className="mb-2 text-sm text-slate-400">คำของคุณคืออะไร?</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_GUESS_LENGTH}
            placeholder="พิมพ์คำที่คิดว่าใช่"
            className="mb-2 w-full rounded-xl bg-slate-900 p-3 text-lg outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="button"
            disabled={text.trim().length === 0}
            onClick={() => api.guess(text.trim())}
            className="w-full rounded-xl bg-sky-400 p-3 font-bold text-slate-900 disabled:opacity-40"
          >
            ส่งคำตอบ
          </button>
          <p className="mt-2 text-xs text-slate-500">ส่งได้ครั้งเดียว วรรณยุกต์ผิดได้ ตัวสะกดต้องถูก</p>
        </div>
      )}

      {me?.hasGuessed && (
        <p
          className={`rounded-xl p-3 text-center font-bold ${
            me.guessCorrect ? 'bg-green-950 text-green-300' : 'bg-red-950 text-red-300'
          }`}
        >
          {me.guessCorrect ? 'ทายถูก! ได้ 1 คะแนน' : 'ทายผิด ไม่ได้คะแนนรอบนี้'}
        </p>
      )}

      {me && !me.isAlive && (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-slate-400">
          คุณตายในรอบนี้ จึงไม่มีสิทธิ์ทายคำ
        </p>
      )}

      <div className="mt-2 text-sm text-slate-400">เฉลยคำทุกคน</div>
      {state.players.map((p) => (
        <PlayerCard key={p.id} player={p} isMe={p.id === state.viewerId} />
      ))}

      <div className="mt-2 text-sm text-slate-400">คะแนนสะสม</div>
      <table className="w-full">
        <tbody>
          {standings.map((p) => (
            <tr key={p.id} className="border-b border-slate-700">
              <td className="py-2">{p.name}</td>
              <td className="py-2 text-right text-lg font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {api.isHost && (
        <button
          type="button"
          onClick={api.nextRound}
          className="mt-4 rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900"
        >
          {isLastRound ? 'ดูสรุปผล' : 'รอบต่อไป'}
        </button>
      )}
      {!api.isHost && (
        <p className="mt-4 text-center text-slate-500">รอ host กดไปต่อ</p>
      )}
    </main>
  )
}
