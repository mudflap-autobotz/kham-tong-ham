'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DEFAULT_ROUNDS, MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../constants'
import { getPlayerName } from '../lib/socket-client'
import { useRoom } from '../lib/use-room'

const ROUND_CHOICES = [3, 5, 7, 10]

export default function HomePage() {
  const router = useRouter()
  const params = useSearchParams()
  const room = useRoom()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS)

  // ชื่อเดิมและโค้ดจากลิงก์เชิญ เติมให้อัตโนมัติ
  useEffect(() => {
    setName(getPlayerName())
    const invited = params.get('code')
    if (invited) setCode(invited.toUpperCase())
  }, [params])

  // เข้าห้องสำเร็จเมื่อ state มาถึง
  useEffect(() => {
    if (room.state) router.push(`/room/${room.state.code}`)
  }, [room.state, router])

  const nameOk = name.trim().length > 0
  const codeOk = code.trim().length === ROOM_CODE_LENGTH

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <h1 className="mt-8 text-center text-4xl font-bold text-sky-400">คำต้องห้าม</h1>
      <p className="text-center text-sm text-slate-400">
        คุณไม่เห็นคำของตัวเอง แต่ทุกคนเห็น — อย่าเผลอพูดออกมา
      </p>

      {room.error && (
        <div className="rounded-xl bg-red-950 p-3 text-center text-red-300">
          {room.error.message}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-sm text-slate-400">ชื่อของคุณ</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="พิมพ์ชื่อที่เพื่อนเรียก"
          className="mt-1 w-full rounded-xl bg-slate-800 p-4 text-lg outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-400">จำนวนรอบ</span>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {ROUND_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRounds(n)}
              className={`rounded-xl p-3 text-lg font-bold ${
                rounds === n ? 'bg-sky-400 text-slate-900' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </label>

      <button
        type="button"
        disabled={!nameOk}
        onClick={() => room.createRoom(name.trim(), rounds)}
        className="rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900 disabled:opacity-40"
      >
        สร้างห้อง
      </button>

      <div className="my-2 text-center text-slate-500">หรือ</div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={ROOM_CODE_LENGTH}
        placeholder="ABC234"
        className="w-full rounded-xl bg-slate-800 p-4 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-sky-400"
      />
      <button
        type="button"
        disabled={!nameOk || !codeOk}
        onClick={() => room.joinRoom(code.trim(), name.trim())}
        className="rounded-xl bg-slate-700 p-4 text-lg font-bold disabled:opacity-40"
      >
        เข้าร่วมห้อง
      </button>
    </main>
  )
}
