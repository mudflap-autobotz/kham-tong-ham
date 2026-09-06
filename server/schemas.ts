import { z } from 'zod'
import {
  MAX_GUESS_LENGTH, MAX_NAME_LENGTH, MAX_PLAYER_ID_LENGTH, MAX_ROUNDS,
  MIN_ROUNDS, ROOM_CODE_LENGTH,
} from '../constants'

const playerName = z.string().trim().min(1, 'กรุณากรอกชื่อ').max(MAX_NAME_LENGTH)
const playerId = z.string().min(1).max(MAX_PLAYER_ID_LENGTH)
const sessionToken = z.string().max(MAX_PLAYER_ID_LENGTH).optional()

export const createRoomSchema = z.object({
  name: playerName,
  totalRounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  playerId: playerId.optional(),
  sessionToken,
})

export const joinRoomSchema = z.object({
  code: z.string().trim().length(ROOM_CODE_LENGTH),
  name: playerName,
  playerId: playerId.optional(),
  sessionToken,
})

export const readySchema = z.object({ ready: z.boolean() })

export const killSchema = z.object({
  victimId: playerId,
  killerId: playerId,
})

export const undoKillSchema = z.object({
  deathIndex: z.number().int().min(0),
})

export const guessSchema = z.object({
  text: z.string().trim().min(1).max(MAX_GUESS_LENGTH),
})

export const kickSchema = z.object({
  targetId: playerId,
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type JoinRoomInput = z.infer<typeof joinRoomSchema>
