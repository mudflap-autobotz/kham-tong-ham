'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ErrorCode, MaskedPlayer, MaskedRoomState } from '../../server/core/types'
import { getPlayerId, getSocket, savePlayerName } from './socket-client'

type RoomError = { code: ErrorCode; message: string }

export function useRoom() {
  const [state, setState] = useState<MaskedRoomState | null>(null)
  const [error, setError] = useState<RoomError | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    const onState = (s: MaskedRoomState) => {
      setState(s)
      setError(null)
    }
    const onError = (e: RoomError) => setError(e)
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('state:sync', onState)
    socket.on('error', onError)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    setConnected(socket.connected)

    return () => {
      socket.off('state:sync', onState)
      socket.off('error', onError)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  const emit = useCallback((event: string, payload?: unknown) => {
    getSocket().emit(event, payload)
  }, [])

  const me = useMemo(
    () => state?.players.find((p) => p.id === state.viewerId) ?? null,
    [state],
  )

  return {
    state,
    error,
    connected,
    me,
    isHost: me?.isHost ?? false,
    isGm: me?.isGm ?? false,
    clearError: useCallback(() => setError(null), []),

    createRoom: useCallback(
      (name: string, totalRounds: number) => {
        savePlayerName(name)
        emit('room:create', { name, totalRounds, playerId: getPlayerId() })
      },
      [emit],
    ),
    joinRoom: useCallback(
      (code: string, name: string) => {
        savePlayerName(name)
        emit('room:join', { code: code.toUpperCase(), name, playerId: getPlayerId() })
      },
      [emit],
    ),
    setReady: useCallback((ready: boolean) => emit('player:ready', { ready }), [emit]),
    kick: useCallback((targetId: string) => emit('room:kick', { targetId }), [emit]),
    startGame: useCallback(() => emit('game:start'), [emit]),
    kill: useCallback(
      (victimId: string, killerId: string) => emit('gm:kill', { victimId, killerId }),
      [emit],
    ),
    undoKill: useCallback((deathIndex: number) => emit('gm:undoKill', { deathIndex }), [emit]),
    endRound: useCallback(() => emit('gm:endRound'), [emit]),
    guess: useCallback((text: string) => emit('guess:submit', { text }), [emit]),
    nextRound: useCallback(() => emit('round:next'), [emit]),
    restart: useCallback(() => emit('game:restart'), [emit]),
    leave: useCallback(() => emit('room:leave'), [emit]),
  }
}

export type RoomApi = ReturnType<typeof useRoom>
export type { MaskedPlayer, MaskedRoomState }
