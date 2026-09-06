'use client'

import type { RoomApi } from '../../lib/use-room'

const MEDALS = ['🥇', '🥈', '🥉']

export function Summary({ api }: { api: RoomApi }) {
  const state = api.state!
  const standings = [...state.players].sort((a, b) => b.score - a.score)
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <h1 className="mt-4 text-center text-3xl font-bold">จบเกม</h1>

      {standings[0] && (
        <div className="rounded-2xl bg-slate-800 p-6 text-center ring-2 ring-sky-400">
          <div className="text-5xl">🥇</div>
          <div className="text-2xl font-bold">{standings[0].name}</div>
          <div className="text-slate-400">{standings[0].score} คะแนน</div>
        </div>
      )}

      <table className="w-full">
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id} className="border-b border-slate-700">
              <td className="w-10 py-2">{MEDALS[i] ?? i + 1}</td>
              <td className="py-2">
                {p.name}
                {p.id === state.viewerId && <span className="text-slate-400"> (คุณ)</span>}
              </td>
              <td className="py-2 text-right text-lg font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-sm text-slate-400">ประวัติรายรอบ</div>
      {state.roundHistory.map((r) => (
        <div key={r.round} className="rounded-2xl bg-slate-800 p-4">
          <div className="mb-2 text-sm text-slate-400">
            รอบ {r.round} — หมวด: {r.packTheme} · GM: {nameOf(r.gmId)}
          </div>
          {r.deaths.map((d, i) => (
            <div key={i}>
              {nameOf(d.killerId)} หลอก {nameOf(d.victimId)} สำเร็จ
            </div>
          ))}
          {r.correctGuessers.map((id) => (
            <div key={id}>{nameOf(id)} ทายคำตัวเองถูก</div>
          ))}
          {r.deaths.length === 0 && r.correctGuessers.length === 0 && (
            <div className="text-slate-500">ไม่มีใครได้คะแนนในรอบนี้</div>
          )}
        </div>
      ))}

      {api.isHost && (
        <button
          type="button"
          onClick={api.restart}
          className="mt-4 rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900"
        >
          เล่นอีกรอบ (ห้องเดิม)
        </button>
      )}
    </main>
  )
}
