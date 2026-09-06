import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'
import { RoomStore } from './core/room-store'
import { registerHandlers } from './socket-handlers'
import type { MaskedRoomState } from './core/types'

let httpServer: HttpServer
let io: Server
let port: number
let clients: ClientSocket[] = []

beforeEach(async () => {
  httpServer = createServer()
  io = new Server(httpServer)
  registerHandlers(io, new RoomStore())

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as { port: number }).port
      resolve()
    })
  })
})

afterEach(async () => {
  for (const c of clients) c.disconnect()
  clients = []
  io.close()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

function connect(): ClientSocket {
  const c = ioc(`http://localhost:${port}`, { transports: ['websocket'] })
  clients.push(c)
  return c
}

/** รอ event หนึ่งครั้ง พร้อม timeout กันเทสค้าง */
function once<T>(socket: ClientSocket, event: string, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`รอ "${event}" เกิน ${ms}ms`)), ms)
    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

/**
 * ติดตาม state ล่าสุดของ socket แบบต่อเนื่อง
 * ห้ามใช้ once('state:sync') เพื่ออ่านสถานะปัจจุบัน — sync อาจมาถึงก่อนที่จะเริ่มรอ
 */
function track(socket: ClientSocket) {
  let latest: MaskedRoomState | null = null
  socket.on('state:sync', (s: MaskedRoomState) => { latest = s })

  return {
    get current(): MaskedRoomState {
      if (!latest) throw new Error('ยังไม่เคยได้รับ state:sync')
      return latest
    },
    /**
     * รอจนกว่า state จะเข้าเงื่อนไข
     * เจตนาสลีปก่อนเช็คเสมอ (ไม่ใช่เช็คก่อนสลีป) — ถ้า resolve แบบ sync
     * ทันทีที่ latest ผ่านเงื่อนไข event loop จะไม่มีโอกาสประมวลผล
     * state:sync ของ socketอื่นที่มาถึงพร้อมกันแต่ยังค้างอยู่ใน queue
     */
    async until(
      pred: (s: MaskedRoomState) => boolean,
      ms = 8000,
    ): Promise<MaskedRoomState> {
      const deadline = Date.now() + ms
      while (true) {
        await new Promise((r) => setTimeout(r, 25))
        if (latest && pred(latest)) return latest
        if (Date.now() >= deadline) throw new Error('รอ state ตามเงื่อนไขไม่ทัน')
      }
    },
  }
}

async function createRoom(name = 'สมชาย', totalRounds = 3) {
  const c = connect()
  const p = once<MaskedRoomState>(c, 'state:sync')
  c.emit('room:create', { name, totalRounds })
  return { socket: c, state: await p }
}

async function joinRoom(code: string, name: string) {
  const c = connect()
  const p = once<MaskedRoomState>(c, 'state:sync')
  c.emit('room:join', { code, name })
  return { socket: c, state: await p }
}

describe('room:create', () => {
  it('สร้างห้องแล้วได้ state กลับมาพร้อมโค้ด', async () => {
    const { state } = await createRoom()
    expect(state.code).toHaveLength(6)
    expect(state.phase).toBe('LOBBY')
    expect(state.players).toHaveLength(1)
  })

  it('payload ที่ไม่ถูกต้อง ได้ error กลับมา', async () => {
    const c = connect()
    const p = once<{ code: string }>(c, 'error')
    c.emit('room:create', { name: '', totalRounds: 999 })
    expect((await p).code).toBe('INVALID_INPUT')
  })
})

describe('room:join', () => {
  it('คนที่สองเข้าห้องได้ และคนแรกได้รับ state ใหม่', async () => {
    const host = await createRoom()
    const hostUpdate = once<MaskedRoomState>(host.socket, 'state:sync')

    await joinRoom(host.state.code, 'มานี')
    const updated = await hostUpdate
    expect(updated.players).toHaveLength(2)
  })

  it('โค้ดห้องที่ไม่มีอยู่ ได้ ROOM_NOT_FOUND', async () => {
    const c = connect()
    const p = once<{ code: string }>(c, 'error')
    c.emit('room:join', { code: 'ZZZZZZ', name: 'ใคร' })
    expect((await p).code).toBe('ROOM_NOT_FOUND')
  })
})

describe('การแยกห้อง', () => {
  it('event ของห้องหนึ่งไม่รั่วไปอีกห้อง', async () => {
    const roomA = await createRoom('A')
    const roomB = await createRoom('B')

    let leaked = false
    roomB.socket.on('state:sync', () => { leaked = true })

    await joinRoom(roomA.state.code, 'คนของห้อง A')
    await new Promise((r) => setTimeout(r, 200))

    expect(leaked, 'ห้อง B ไม่ควรได้รับ event ของห้อง A').toBe(false)
  })
})

describe('การตรวจสิทธิ์', () => {
  it('คนที่ไม่ใช่ host เริ่มเกมไม่ได้', async () => {
    const host = await createRoom()
    const guest1 = await joinRoom(host.state.code, 'มานี')
    const guest2 = await joinRoom(host.state.code, 'ปิติ')

    for (const s of [host.socket, guest1.socket, guest2.socket]) {
      s.emit('player:ready', { ready: true })
    }
    await new Promise((r) => setTimeout(r, 100))

    const p = once<{ code: string }>(guest1.socket, 'error')
    guest1.socket.emit('game:start')
    expect((await p).code).toBe('NOT_HOST')
  })

  it('คนที่ไม่ใช่ GM บันทึกคนตายไม่ได้', async () => {
    const host = await createRoom()
    const g1 = await joinRoom(host.state.code, 'มานี')
    const g2 = await joinRoom(host.state.code, 'ปิติ')

    for (const s of [host.socket, g1.socket, g2.socket]) {
      s.emit('player:ready', { ready: true })
    }
    await new Promise((r) => setTimeout(r, 100))

    const playing = once<{ gmId: string }>(host.socket, 'round:started', 8000)
    host.socket.emit('game:start')
    const started = await playing

    // หา socket ของคนที่ไม่ใช่ GM
    const sockets = [
      { s: host.socket, id: host.state.viewerId },
      { s: g1.socket, id: g1.state.viewerId },
      { s: g2.socket, id: g2.state.viewerId },
    ]
    const notGm = sockets.find((x) => x.id !== started.gmId)!
    const victim = sockets.find((x) => x.id !== started.gmId && x.id !== notGm.id)!

    const p = once<{ code: string }>(notGm.s, 'error')
    notGm.s.emit('gm:kill', { victimId: victim.id, killerId: notGm.id })
    expect((await p).code).toBe('NOT_GM')
  })
})

describe('การซ่อนคำ', () => {
  it('ไม่มีใครได้รับคำของตัวเองใน payload ระหว่างเล่น', async () => {
    const host = await createRoom()
    const g1 = await joinRoom(host.state.code, 'มานี')
    const g2 = await joinRoom(host.state.code, 'ปิติ')

    const views = [track(host.socket), track(g1.socket), track(g2.socket)]

    for (const s of [host.socket, g1.socket, g2.socket]) {
      s.emit('player:ready', { ready: true })
    }
    await new Promise((r) => setTimeout(r, 100))

    host.socket.emit('game:start')
    const states = await Promise.all(views.map((v) => v.until((s) => s.phase === 'PLAYING')))

    for (const st of states) {
      const me = st.players.find((p) => p.id === st.viewerId)!
      expect(me.word, `${me.name} เห็นคำตัวเอง`).toBeNull()
      // คนอื่นต้องเห็นคำครบ
      const others = st.players.filter((p) => p.id !== st.viewerId)
      for (const o of others) expect(o.word).toBeTruthy()
    }
  })
})

describe('reconnect', () => {
  it('กลับเข้าห้องด้วย playerId เดิม ได้สถานะเดิมคืน', async () => {
    const host = await createRoom()
    const g = await joinRoom(host.state.code, 'มานี')
    const originalId = g.state.viewerId

    g.socket.disconnect()
    await new Promise((r) => setTimeout(r, 100))

    const back = connect()
    const p = once<MaskedRoomState>(back, 'state:sync')
    back.emit('room:join', {
      code: host.state.code,
      name: 'มานี',
      playerId: originalId,
      sessionToken: g.state.sessionToken,
    })
    const st = await p

    expect(st.viewerId).toBe(originalId)
    expect(st.players).toHaveLength(2)
  })
})

/** พา 3 คนเข้าถึง PLAYING พร้อม view ต่อคน ใช้ทดสอบเรื่องตัวตน */
async function playingTrio() {
  const host = await createRoom('สมชาย', 2)
  const g1 = await joinRoom(host.state.code, 'มานี')
  const g2 = await joinRoom(host.state.code, 'ปิติ')

  const seats = [
    { s: host.socket, state: host.state, view: track(host.socket) },
    { s: g1.socket, state: g1.state, view: track(g1.socket) },
    { s: g2.socket, state: g2.state, view: track(g2.socket) },
  ]
  for (const x of seats) x.s.emit('player:ready', { ready: true })
  await seats[0].view.until((s) => s.players.every((p) => p.ready))

  host.socket.emit('game:start')
  await Promise.all(seats.map((x) => x.view.until((s) => s.phase === 'PLAYING')))

  return { code: host.state.code, seats }
}

describe('sessionToken กันการสวมตัวตน', () => {
  it('สวม id ของคนอื่นโดยไม่มี token ถูกปฏิเสธ และไม่ได้เห็นคำของเขา', async () => {
    const { code, seats } = await playingTrio()
    const victim = seats[1]
    const victimId = victim.state.viewerId

    const attacker = connect()
    const leaked: MaskedRoomState[] = []
    attacker.on('state:sync', (s: MaskedRoomState) => leaked.push(s))

    const err = once<{ code: string }>(attacker, 'error')
    attacker.emit('room:join', { code, name: 'คนแอบอ้าง', playerId: victimId })
    expect((await err).code).toBe('BAD_SESSION')

    await new Promise((r) => setTimeout(r, 200))
    expect(leaked.some((s) => s.viewerId === victimId), 'ผู้บุกรุกได้มุมมองของเหยื่อ').toBe(false)

    const victimNow = victim.view.current
    expect(victimNow.players.find((p) => p.id === victimId)!.word).toBeNull()
  })

  it('สวม id ของคนอื่นด้วย token มั่ว ถูกปฏิเสธเช่นกัน', async () => {
    const { code, seats } = await playingTrio()
    const victimId = seats[1].state.viewerId

    const attacker = connect()
    const leaked: MaskedRoomState[] = []
    attacker.on('state:sync', (s: MaskedRoomState) => leaked.push(s))

    const err = once<{ code: string }>(attacker, 'error')
    attacker.emit('room:join', {
      code,
      name: 'คนแอบอ้าง',
      playerId: victimId,
      sessionToken: 'token-มั่ว',
    })
    expect((await err).code).toBe('BAD_SESSION')

    await new Promise((r) => setTimeout(r, 200))
    expect(leaked.some((s) => s.viewerId === victimId)).toBe(false)
  })

  it('เจ้าตัวหลุดแล้วกลับมาด้วย token ที่ถูก ได้ที่นั่งเดิมคืน และยังไม่เห็นคำตัวเอง', async () => {
    const { code, seats } = await playingTrio()
    const me = seats[2]
    const myId = me.state.viewerId
    const scoreBefore = me.view.current.players.find((p) => p.id === myId)!.score

    me.s.disconnect()
    await new Promise((r) => setTimeout(r, 100))

    const back = connect()
    const p = once<MaskedRoomState>(back, 'state:sync')
    back.emit('room:join', {
      code,
      name: 'ปิติ',
      playerId: myId,
      sessionToken: me.state.sessionToken,
    })
    const st = await p

    expect(st.viewerId).toBe(myId)
    expect(st.phase).toBe('PLAYING')
    const meAgain = st.players.find((p) => p.id === myId)!
    expect(meAgain.score).toBe(scoreBefore)
    expect(meAgain.word, 'กลับเข้ามาแล้วต้องยังไม่เห็นคำตัวเอง').toBeNull()
  })
})

describe('เกมเต็มรอบ 4 คน', () => {
  it('สร้าง → ready → เล่น → kill → จบรอบ → ทายคำ → สรุป', async () => {
    const host = await createRoom('สมชาย', 2)
    const g1 = await joinRoom(host.state.code, 'มานี')
    const g2 = await joinRoom(host.state.code, 'ปิติ')
    const g3 = await joinRoom(host.state.code, 'ชูใจ')

    const seats = [
      { s: host.socket, id: host.state.viewerId, view: track(host.socket) },
      { s: g1.socket, id: g1.state.viewerId, view: track(g1.socket) },
      { s: g2.socket, id: g2.state.viewerId, view: track(g2.socket) },
      { s: g3.socket, id: g3.state.viewerId, view: track(g3.socket) },
    ]
    const seatOf = (id: string) => seats.find((x) => x.id === id)!
    const hostView = seats[0].view

    for (const x of seats) x.s.emit('player:ready', { ready: true })
    await hostView.until((s) => s.players.every((p) => p.ready))

    // ---- รอบ 1 ----
    host.socket.emit('game:start')
    const playing = await hostView.until((s) => s.phase === 'PLAYING')

    const gmId = playing.players.find((p) => p.isGm)!.id
    const gm = seatOf(gmId)
    const victim = seats.find((x) => x.id !== gmId)!
    const killer = seats.find((x) => x.id !== gmId && x.id !== victim.id)!

    // GM บันทึกคนตาย 1 คน
    const died = once<{ victimId: string; revealedWord: string }>(host.socket, 'player:died')
    gm.s.emit('gm:kill', { victimId: victim.id, killerId: killer.id })
    expect((await died).victimId).toBe(victim.id)

    // เหยื่อเห็นคำตัวเองได้แล้ว คนอื่นที่ยังไม่ตายยังไม่เห็นคำตัวเอง
    const victimView = await victim.view.until(
      (s) => !s.players.find((p) => p.id === victim.id)!.isAlive,
    )
    expect(victimView.players.find((p) => p.id === victim.id)!.word).toBeTruthy()
    expect(killer.view.current.players.find((p) => p.id === killer.id)!.word).toBeNull()

    // คนหลอกได้ 1 คะแนน
    expect(killer.view.current.players.find((p) => p.id === killer.id)!.score).toBe(1)

    // GM จบรอบเอง (เส้นทางหมดเวลากินเวลาจริง 5 นาที ตรวจด้วยมือใน Task 17)
    gm.s.emit('gm:endRound')
    const atRoundEnd = await killer.view.until((s) => s.phase === 'ROUND_END')
    expect(atRoundEnd.endReason).toBe('GM')

    // คนรอดที่ไม่ติด wordBurned ทายคำตัวเองถูก
    const myWord = atRoundEnd.players.find((p) => p.id === killer.id)!.word!
    killer.s.emit('guess:submit', { text: myWord })
    const afterGuess = await killer.view.until(
      (s) => s.players.find((p) => p.id === killer.id)!.hasGuessed,
    )
    const killerAfter = afterGuess.players.find((p) => p.id === killer.id)!
    expect(killerAfter.guessCorrect).toBe(true)
    expect(killerAfter.score).toBe(2) // +1 หลอกสำเร็จ +1 ทายถูก

    // เหยื่อที่ตายแล้วทายไม่ได้
    const victimAtEnd = victim.view.current.players.find((p) => p.id === victim.id)!
    expect(victimAtEnd.canGuess).toBe(false)

    // ---- รอบ 2 ----
    host.socket.emit('round:next')
    const r2 = await hostView.until((s) => s.phase === 'PLAYING' && s.currentRound === 2)
    const gm2Id = r2.players.find((p) => p.isGm)!.id
    expect(gm2Id, 'GM ต้องไม่ใช่คนเดิม').not.toBe(gmId)

    seatOf(gm2Id).s.emit('gm:endRound')
    await hostView.until((s) => s.phase === 'ROUND_END' && s.currentRound === 2)

    // ---- จบเกม ----
    const gameEnd = once<{ standings: { id: string; score: number }[] }>(
      host.socket,
      'game:ended',
    )
    host.socket.emit('round:next')
    const summary = await gameEnd

    expect(summary.standings).toHaveLength(4)
    const scores = summary.standings.map((x) => x.score)
    expect([...scores].sort((a, b) => b - a), 'standings ต้องเรียงมากไปน้อย').toEqual(scores)

    const finalState = await hostView.until((s) => s.phase === 'GAME_END')
    expect(finalState.roundHistory).toHaveLength(2)
    // จบเกมแล้วเปิดคำทุกคน
    for (const p of finalState.players) expect(p.word).toBeTruthy()
  }, 20_000)
})

describe('สลับห้อง', () => {
  it('คนหนึ่งอยู่ได้ห้องเดียว — ย้ายห้องแล้วห้องเก่าเห็นว่าหลุด', async () => {
    const hostA = await createRoom('เจ้าของห้อง A')
    const hostB = await createRoom('เจ้าของห้อง B')

    const hostAView = track(hostA.socket)

    const wanderer = await joinRoom(hostA.state.code, 'คนเร่ร่อน')
    await hostAView.until((s) => s.players.length === 2)

    const wandererView = track(wanderer.socket)
    wanderer.socket.emit('room:join', { code: hostB.state.code, name: 'คนเร่ร่อน' })

    const roomAAfter = await hostAView.until((s) =>
      s.players.some((p) => p.name === 'คนเร่ร่อน' && !p.connected),
    )
    const wandererInA = roomAAfter.players.find((p) => p.name === 'คนเร่ร่อน')!
    expect(wandererInA.connected).toBe(false)

    const roomBAfter = await wandererView.until((s) => s.players.length === 2)
    expect(roomBAfter.code).toBe(hostB.state.code)
    expect(roomBAfter.players).toHaveLength(2)
  })
})
