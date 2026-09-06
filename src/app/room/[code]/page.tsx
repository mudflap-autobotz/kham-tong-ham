'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getPlayerName } from '../../../lib/socket-client'
import { useRoom } from '../../../lib/use-room'
import { Lobby } from '../../_components/Lobby'
import { Countdown } from '../../_components/Countdown'
import { Playing } from '../../_components/Playing'
import { RoundEnd } from '../../_components/RoundEnd'
import { Summary } from '../../_components/Summary'

export default function RoomPage() {
  const router = useRouter()
  const params = useParams<{ code: string }>()
  const api = useRoom()
  const code = (params.code ?? '').toUpperCase()
  const joinSent = useRef(false)

  // เข้าลิงก์ตรงหรือ refresh — ต่อ socket แล้ว join ห้องนี้ด้วยตัวตนเดิม
  // ref กัน re-render ยิง join ซ้ำ: `api` เป็น object ใหม่ทุกครั้งที่ render
  // ไม่เช็ค api.state เพราะ state ค้างอยู่ตอนหลุด ถ้าเช็คจะ join กลับไม่ได้เลย
  useEffect(() => {
    if (!api.connected || joinSent.current) return
    const name = getPlayerName()
    if (!name) {
      router.replace(`/?code=${code}`)
      return
    }
    joinSent.current = true
    api.joinRoom(code, name)
  }, [api, code, router])

  // หลุดแล้วต่อกลับมา ต้องยอมให้ join ใหม่ได้อีกครั้ง
  // socket ใหม่ = server ไม่รู้จักเราแล้ว ต้องยิง room:join ซ้ำเพื่อคืนที่นั่งเดิม
  useEffect(() => {
    if (!api.connected) joinSent.current = false
  }, [api.connected])

  if (api.error && !api.state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-red-300">{api.error.message}</p>
        <button
          type="button"
          onClick={() => router.replace('/')}
          className="rounded-xl bg-slate-700 px-6 py-3 font-bold"
        >
          กลับหน้าแรก
        </button>
      </main>
    )
  }

  if (!api.state) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-slate-400">
        กำลังเชื่อมต่อ...
      </main>
    )
  }

  switch (api.state.phase) {
    case 'LOBBY':
      return <Lobby api={api} />
    case 'COUNTDOWN':
      return <Countdown api={api} />
    case 'PLAYING':
      return <Playing api={api} />
    case 'ROUND_END':
      return <RoundEnd api={api} />
    case 'GAME_END':
      return <Summary api={api} />
  }
}
