import type { Server, Socket } from 'socket.io'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { COUNTDOWN_MS, ROOM_CREATE_LIMIT, ROOM_CREATE_WINDOW_MS } from '../constants'
import {
  beginRound, endRound, endRoundByGm, joinRoom, kickPlayer, nextRound,
  recordKill, restartGame, setReady, startCountdown, submitGuess, undoKill,
} from './core/game'
import { maskFor } from './core/mask'
import { RateLimiter } from './core/rate-limit'
import type { RoomStore } from './core/room-store'
import type { ErrorCode, Room } from './core/types'
import {
  createRoomSchema, guessSchema, joinRoomSchema, kickSchema,
  killSchema, readySchema, undoKillSchema,
} from './schemas'

type Deps = { now?: () => number; rng?: () => number }

type SocketData = { playerId?: string; roomCode?: string }

export function registerHandlers(io: Server, store: RoomStore, deps: Deps = {}): void {
  const now = deps.now ?? (() => Date.now())
  const rng = deps.rng ?? Math.random
  const limiter = new RateLimiter(ROOM_CREATE_LIMIT, ROOM_CREATE_WINDOW_MS)
  const timers = new Map<string, NodeJS.Timeout>()

  /**
   * ส่ง state ให้ทุกคนในห้อง โดยแต่ละคนได้มุมมองของตัวเอง
   * ใช้ event name อื่นได้ (เช่น 'round:started') เมื่อ client ต้องแยกแยะ
   * ช่วงเปลี่ยนผ่านจาก state:sync ทั่วไป — payload ยังผ่าน maskFor() เหมือนกันเสมอ
   */
  function broadcast(room: Room, event: string = 'state:sync'): void {
    for (const socket of io.of('/').sockets.values()) {
      const data = socket.data as SocketData
      if (data.roomCode !== room.code || !data.playerId) continue
      socket.emit(event, maskFor(room, data.playerId))
    }
  }

  function sendError(socket: Socket, code: ErrorCode, message: string): void {
    socket.emit('error', { code, message })
  }

  function clearTimer(code: string): void {
    const t = timers.get(code)
    if (t) {
      clearTimeout(t)
      timers.delete(code)
    }
  }

  /** ตั้งเวลาจบรอบอัตโนมัติ ยกเลิก timer เก่าก่อนเสมอ */
  function scheduleRoundEnd(room: Room): void {
    clearTimer(room.code)
    const remaining = Math.max(0, (room.round?.endsAt ?? 0) - now())

    timers.set(
      room.code,
      setTimeout(() => {
        timers.delete(room.code)
        const live = store.get(room.code)
        if (!live || live.phase !== 'PLAYING') return
        endRound(live, 'TIME', now())
        io.to(live.code).emit('round:ended', {
          endReason: 'TIME',
          needsGuessFrom: [...(live.round?.alive ?? [])],
        })
        broadcast(live)
      }, remaining),
    )
  }

  function startRoundNow(room: Room): void {
    const r = beginRound(room, now(), rng)
    if (!r.ok) {
      // ไม่มี socket ให้ตอบเพราะเรียกจาก timer — แจ้งทั้งห้องแทน
      io.to(room.code).emit('error', { code: r.code, message: r.message })
      return
    }

    // round:started ต้องเป็นมุมมองที่ maskFor() แล้วต่อคน (ไม่ใช่ payload กลาง)
    // เพราะ client ต้องรู้ทันทีว่าใครเป็น GM และคำของใครเปิดให้เห็นบ้าง
    broadcast(room, 'round:started')
    broadcast(room)
    scheduleRoundEnd(room)
  }

  /** หาห้องและตัวตนของ socket นี้ — คืน null พร้อมส่ง error ถ้าไม่ครบ */
  function context(socket: Socket): { room: Room; playerId: string } | null {
    const data = socket.data as SocketData
    if (!data.roomCode || !data.playerId) {
      sendError(socket, 'ROOM_NOT_FOUND', 'คุณยังไม่ได้อยู่ในห้องไหน')
      return null
    }
    const room = store.get(data.roomCode)
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'ไม่พบห้องนี้แล้ว')
      return null
    }
    return { room, playerId: data.playerId }
  }

  /** validate payload แล้วเรียก fn — ทุก handler ที่รับ payload ต้องผ่านทางนี้ */
  function withInput<T>(
    socket: Socket,
    schema: z.ZodType<T>,
    raw: unknown,
    fn: (input: T) => void,
  ): void {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      sendError(socket, 'INVALID_INPUT', 'ข้อมูลที่ส่งมาไม่ถูกต้อง')
      return
    }
    fn(parsed.data)
  }

  io.on('connection', (socket) => {
    socket.on('room:create', (raw) => {
      withInput(socket, createRoomSchema, raw, (input) => {
        const ip = socket.handshake.address
        if (!limiter.check(ip, now())) {
          sendError(socket, 'RATE_LIMITED', 'สร้างห้องถี่เกินไป รอสักครู่แล้วลองใหม่')
          return
        }

        const playerId = input.playerId ?? nanoid()
        const result = store.create(input.name, input.totalRounds, playerId, now())
        if (!result.ok) {
          sendError(socket, result.code, result.message)
          return
        }

        const room = result.value
        socket.data = { playerId, roomCode: room.code } satisfies SocketData
        void socket.join(room.code)
        socket.emit('state:sync', maskFor(room, playerId))
      })
    })

    socket.on('room:join', (raw) => {
      withInput(socket, joinRoomSchema, raw, (input) => {
        const room = store.get(input.code)
        if (!room) {
          sendError(socket, 'ROOM_NOT_FOUND', 'ไม่พบห้องนี้ ตรวจโค้ดอีกครั้ง')
          return
        }

        const playerId = input.playerId ?? nanoid()
        const result = joinRoom(room, input.name, playerId, now())
        if (!result.ok) {
          sendError(socket, result.code, result.message)
          return
        }

        // คนหนึ่งอยู่ได้ห้องเดียว
        const prev = (socket.data as SocketData).roomCode
        if (prev && prev !== room.code) void socket.leave(prev)

        socket.data = { playerId, roomCode: room.code } satisfies SocketData
        void socket.join(room.code)
        broadcast(room)
      })
    })

    socket.on('player:ready', (raw) => {
      withInput(socket, readySchema, raw, (input) => {
        const ctx = context(socket)
        if (!ctx) return
        const r = setReady(ctx.room, ctx.playerId, input.ready)
        if (!r.ok) return sendError(socket, r.code, r.message)
        broadcast(ctx.room)
      })
    })

    socket.on('game:start', () => {
      const ctx = context(socket)
      if (!ctx) return

      const r = startCountdown(ctx.room, ctx.playerId, now())
      if (!r.ok) return sendError(socket, r.code, r.message)

      broadcast(ctx.room)
      clearTimer(ctx.room.code)
      timers.set(
        ctx.room.code,
        setTimeout(() => {
          timers.delete(ctx.room.code)
          const live = store.get(ctx.room.code)
          if (live && live.phase === 'COUNTDOWN') startRoundNow(live)
        }, COUNTDOWN_MS),
      )
    })

    socket.on('gm:kill', (raw) => {
      withInput(socket, killSchema, raw, (input) => {
        const ctx = context(socket)
        if (!ctx) return

        const r = recordKill(ctx.room, ctx.playerId, input.victimId, input.killerId, now())
        if (!r.ok) return sendError(socket, r.code, r.message)

        io.to(ctx.room.code).emit('player:died', {
          victimId: input.victimId,
          killerId: input.killerId,
          revealedWord: r.value,
        })

        // recordKill อาจจบรอบเองเมื่อเหลือคนสุดท้าย
        if (ctx.room.phase === 'ROUND_END') {
          clearTimer(ctx.room.code)
          io.to(ctx.room.code).emit('round:ended', {
            endReason: 'LAST_MAN',
            needsGuessFrom: [...(ctx.room.round?.alive ?? [])],
          })
        }
        broadcast(ctx.room)
      })
    })

    socket.on('gm:undoKill', (raw) => {
      withInput(socket, undoKillSchema, raw, (input) => {
        const ctx = context(socket)
        if (!ctx) return
        const r = undoKill(ctx.room, ctx.playerId, input.deathIndex)
        if (!r.ok) return sendError(socket, r.code, r.message)
        broadcast(ctx.room)
      })
    })

    socket.on('gm:endRound', () => {
      const ctx = context(socket)
      if (!ctx) return

      const r = endRoundByGm(ctx.room, ctx.playerId, now())
      if (!r.ok) return sendError(socket, r.code, r.message)

      clearTimer(ctx.room.code)
      io.to(ctx.room.code).emit('round:ended', {
        endReason: 'GM',
        needsGuessFrom: [...(ctx.room.round?.alive ?? [])],
      })
      broadcast(ctx.room)
    })

    socket.on('guess:submit', (raw) => {
      withInput(socket, guessSchema, raw, (input) => {
        const ctx = context(socket)
        if (!ctx) return
        const r = submitGuess(ctx.room, ctx.playerId, input.text)
        if (!r.ok) return sendError(socket, r.code, r.message)
        broadcast(ctx.room)
      })
    })

    socket.on('round:next', () => {
      const ctx = context(socket)
      if (!ctx) return

      const r = nextRound(ctx.room, ctx.playerId, now(), rng)
      if (!r.ok) return sendError(socket, r.code, r.message)

      if (ctx.room.phase === 'GAME_END') {
        io.to(ctx.room.code).emit('game:ended', {
          standings: standingsOf(ctx.room),
          roundHistory: ctx.room.roundHistory,
        })
        broadcast(ctx.room)
        return
      }

      broadcast(ctx.room, 'round:started')
      broadcast(ctx.room)
      scheduleRoundEnd(ctx.room)
    })

    socket.on('game:restart', () => {
      const ctx = context(socket)
      if (!ctx) return
      const r = restartGame(ctx.room, ctx.playerId, now())
      if (!r.ok) return sendError(socket, r.code, r.message)
      broadcast(ctx.room)
    })

    socket.on('room:kick', (raw) => {
      withInput(socket, kickSchema, raw, (input) => {
        const ctx = context(socket)
        if (!ctx) return

        const r = kickPlayer(ctx.room, ctx.playerId, input.targetId, now())
        if (!r.ok) return sendError(socket, r.code, r.message)

        // ตัด socket ของคนที่ถูกเตะออกจากห้องก่อน ไม่งั้นยังได้รับ state ต่อ
        for (const s of io.of('/').sockets.values()) {
          const d = s.data as SocketData
          if (d.roomCode === ctx.room.code && d.playerId === input.targetId) {
            s.emit('error', { code: 'PLAYER_NOT_FOUND', message: 'คุณถูกเชิญออกจากห้อง' })
            void s.leave(ctx.room.code)
            s.data = {} satisfies SocketData
          }
        }
        broadcast(ctx.room)
      })
    })

    socket.on('room:leave', () => {
      const ctx = context(socket)
      if (!ctx) return
      markDisconnected(ctx.room, ctx.playerId)
      void socket.leave(ctx.room.code)
      socket.data = {} satisfies SocketData
      broadcast(ctx.room)
    })

    socket.on('disconnect', () => {
      const data = socket.data as SocketData
      if (!data.roomCode || !data.playerId) return
      const room = store.get(data.roomCode)
      if (!room) return
      markDisconnected(room, data.playerId)
      broadcast(room)
    })
  })
}

/** ผู้เล่นที่หลุดยังอยู่ในห้องและยังนับเป็นคนรอด — ตัวจริงยังนั่งเล่นอยู่ในวง */
function markDisconnected(room: Room, playerId: string): void {
  const p = room.players.get(playerId)
  if (p) p.connected = false
}

function standingsOf(room: Room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
}
