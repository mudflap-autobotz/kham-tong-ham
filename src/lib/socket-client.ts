'use client'

import { io, type Socket } from 'socket.io-client'

const PLAYER_ID_KEY = 'kth.playerId'
const PLAYER_NAME_KEY = 'kth.playerName'

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
