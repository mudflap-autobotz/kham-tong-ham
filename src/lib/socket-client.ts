'use client'

import { io, type Socket } from 'socket.io-client'

const PLAYER_ID_KEY = 'kth.playerId'
const PLAYER_NAME_KEY = 'kth.playerName'
/** เก็บแยกต่อโค้ดห้อง — คนที่แวะห้อง B แล้วกลับมาห้อง A ต้องยังได้ที่นั่งเดิมใน A */
const SESSION_KEY = 'kth.sessionTokens'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/api/socket', transports: ['websocket', 'polling'] })
  }
  return socket
}

/** ตัวตนของผู้เล่นอยู่ได้ข้ามการ refresh — นี่คือกลไก reconnect ทั้งหมด */
export function getPlayerId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

export function getPlayerName(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PLAYER_NAME_KEY) ?? ''
}

export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name)
}

/** อ่านทั้งก้อนแบบทนพัง — ข้อมูลเสียหายต้องไม่ทำให้แอปเข้าห้องไม่ได้เลย */
function readTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function getSessionToken(code: string): string | null {
  if (typeof window === 'undefined') return null
  return readTokens()[code] ?? null
}

export function saveSessionToken(code: string, token: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...readTokens(), [code]: token }))
  } catch {
    // localStorage เต็มหรือถูกปิด — เล่นต่อได้ แค่ reconnect ไม่ได้
  }
}
