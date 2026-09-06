import { createServer } from 'node:http'
import next from 'next'
import { Server } from 'socket.io'
import { SWEEP_INTERVAL_MS } from '../constants'
import { RoomStore } from './core/room-store'
import { registerHandlers } from './socket-handlers'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT ?? 3000)

const app = next({ dev })
const handle = app.getRequestHandler()

await app.prepare()

const httpServer = createServer((req, res) => {
  handle(req, res)
})

const io = new Server(httpServer, {
  path: '/api/socket',
  // ผู้เล่นบนมือถือสลับเครือข่ายบ่อย ให้เวลากลับมาก่อนถือว่าหลุด
  connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
})

const store = new RoomStore()
registerHandlers(io, store)

// กวาดห้องร้างเป็นระยะ นอกเหนือจากที่กวาดตอนสร้างห้อง
setInterval(() => {
  const removed = store.sweep(Date.now())
  if (removed > 0) console.log(`[sweep] ลบห้องร้าง ${removed} ห้อง เหลือ ${store.size()}`)
}, SWEEP_INTERVAL_MS)

httpServer.listen(port, () => {
  console.log(`พร้อมใช้งานที่ http://localhost:${port}`)
})
