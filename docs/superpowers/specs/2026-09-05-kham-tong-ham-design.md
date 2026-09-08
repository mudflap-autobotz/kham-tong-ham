# คำต้องห้าม (Kham Tong Ham) — Design Spec

วันที่: 2026-09-05
สถานะ: อนุมัติแล้ว รอทำแผน implementation

## 1. ภาพรวม

เว็บกระดานเกม "คำต้องห้าม" สำหรับกลุ่มคนที่นั่งเล่นด้วยกันต่อหน้า (หรือคุยผ่าน Discord)
แต่ละคนได้คำภาษาไทย 1 คำจากชุดคำที่มีธีมเดียวกัน **ตัวเองไม่เห็นคำของตัวเอง แต่คนอื่นเห็น**
ผู้เล่นคุยกันเพื่อหลอกให้คนอื่นเผลอพูดคำของตัวเองออกมา ใครพูดคำตัวเองถือว่าตาย คนที่หลอกได้คะแนน

**เว็บไม่ทำหน้าที่เป็นช่องทางสนทนา** — ไม่มี chat ไม่มี voice ผู้เล่นคุยกันนอกเว็บ
เว็บทำหน้าที่: แจกคำ จับเวลา บันทึกคนตาย นับคะแนน สรุปผล

### ตัดสินใจไว้แล้ว (ยืนยันกับเจ้าของงาน)

| หัวข้อ | ข้อสรุป |
|---|---|
| Backend realtime | Socket.IO + Next.js custom server |
| State store | In-memory `Map` (ไม่มี DB) |
| คลังคำ | JSON ในโปรเจกต์ สุ่มทั้งชุด (pack) ต่อรอบ |
| Game Master | เป็นผู้เล่นด้วย มีคำของตัวเอง สุ่มใหม่ทุกรอบ |
| จำนวนคน | 3-12 คนต่อห้อง |
| การแจกคำ | คนละคำ ไม่ซ้ำกัน |
| อุปกรณ์ | Mobile-first |
| GM สายหลุด | ค้าง session ไว้ ไม่โอนสิทธิ์ ไม่ pause |
| หลายห้อง | รองรับ มีเพดาน 200 ห้อง |

## 2. Tech stack

ตรวจเวอร์ชันล่าสุดเมื่อ 2026-09-05 (`npm view <pkg> version`)

### Runtime

| อย่าง | เวอร์ชัน | เหตุผล |
|---|---|---|
| Node.js | 26.7.0 (ที่ติดตั้งอยู่) | ต้อง >= 20 สำหรับ Next 16 |
| npm | 11.19.0 | package manager ที่ใช้ |

### Core

| Package | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| `next` | 16.3.4 | App Router + custom server |
| `react` / `react-dom` | 19.2.8 | UI |
| `typescript` | 7.0.2 | ทั้งโปรเจกต์เป็น TS |
| `socket.io` | 4.8.3 | realtime ฝั่ง server |
| `socket.io-client` | 4.8.3 | realtime ฝั่ง client — ต้อง major เดียวกับ server |
| `tsx` | 4.23.13 | รัน `server/index.ts` ตอน dev โดยไม่ต้อง build ก่อน |

### UI

| Package | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| `tailwindcss` | 4.3.3 | styling — mobile-first, ใช้ใน mockup HTML ด้วยได้ |

Tailwind v4 ตั้งค่าใน CSS (`@import "tailwindcss"`) ไม่ใช้ `tailwind.config.js` แล้ว
`docs/mockups/*.html` ใช้ Tailwind ผ่าน CDN เพื่อให้เปิดไฟล์ดูได้เลยโดยไม่ต้อง build
ตอนย้ายเข้า Next ค่อยเปลี่ยนเป็น Tailwind ที่ build จริง — class ที่เขียนไว้ใช้ต่อได้ทั้งหมด

### Validation และ utility

| Package | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| `zod` | 4.5.4 | ตรวจ payload ทุก event ที่เข้ามาจาก client |
| `nanoid` | 6.0.1 | สร้าง `playerId` และโค้ดห้อง (custom alphabet ตัด I O 0 1) |

`zod` จำเป็นเพราะ payload จาก socket ไม่มี type safety ตอน runtime
client ที่แก้ payload เองส่งอะไรเข้ามาก็ได้ — ต้อง parse ก่อนถึงชั้น core ทุกครั้ง

### Testing

| Package | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| `vitest` | 5.0.0 | unit + integration test |

`server/core/` เป็นฟังก์ชันบริสุทธิ์จึงเทสได้ตรงๆ ไม่ต้องพึ่ง test environment พิเศษ
integration test เปิด Socket.IO server จริงบน port สุ่ม แล้วต่อด้วย `socket.io-client`

### ไม่ใช้ (และเหตุผล)

| อย่าง | ทำไมไม่ใช้ |
|---|---|
| ฐานข้อมูล | state อยู่ใน memory ตามที่ตัดสินใจไว้ ไม่มีอะไรต้องเก็บข้ามการรีสตาร์ท |
| Redis | ยังไม่จำเป็นที่ instance เดียว — ดูข้อจำกัดที่รู้ตัวในหัวข้อการจัดการห้อง |
| ระบบ auth | ผู้เล่นแค่กรอกชื่อ ตัวตนผูกกับ `playerId` + `sessionToken` ใน localStorage ไม่มี account ไม่มีรหัสผ่าน |
| state library (Redux/Zustand) | server เป็นแหล่งความจริงเดียว client แค่ถือ `MaskedRoomState` ก้อนเดียวใน hook |
| TanStack Query | ไม่มี HTTP data fetching เลย — state มาจาก `state:sync` ที่ server push เอง ไม่ต้อง cache ไม่ต้อง revalidate ใส่ไปก็เป็นแค่ `useState` ที่ถูกห่อ |
| Playwright / E2E | เกมเล่นเห็นหน้ากัน ตรวจ UI ด้วยตาจาก mockup พอ |

### ข้อควรระวังเรื่อง deploy

Next 16 ที่รันบน custom server **deploy บน Vercel ไม่ได้** (Vercel รันเป็น serverless ไม่มี process ค้างสำหรับ WebSocket)
ต้อง deploy บนที่ที่รัน Node process ยาวได้ — VPS, Railway, Fly.io, หรือ Docker บนเครื่องตัวเอง
ข้อนี้เป็นผลจากการเลือก Socket.IO + in-memory state และรับไว้แล้วตั้งแต่ต้น

## 3. Data model

```ts
type Phase = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_END' | 'GAME_END'

type Room = {
  code: string              // 6 ตัว จากชุด A-Z0-9 ตัด I O 0 1 ออก
  hostId: string            // คนสร้างห้อง — คนละบทบาทกับ GM
  phase: Phase
  totalRounds: number
  currentRound: number      // 1-based
  players: Map<string, Player>
  round: Round | null
  usedPackIds: string[]     // กัน pack ซ้ำภายในเกมเดียว
  createdAt: number
}

type Player = {
  id: string                // uuid เก็บใน localStorage → ตัวตนสาธารณะ ทุกคนเห็น
  sessionToken: string      // ความลับของเจ้าตัว → พิสูจน์สิทธิ์ตอน reconnect
  name: string
  connected: boolean
  ready: boolean
  score: number             // สะสมข้ามรอบ
  joinedAt: number
}

type Round = {
  packId: string
  gmId: string
  assignments: Map<string, string>     // playerId → คำ
  alive: Set<string>
  wordBurned: Set<string>              // เคยเห็นคำตัวเองแล้ว (ตาย หรือ ตายแล้ว undo)
  deaths: Death[]
  guesses: Map<string, Guess>
  startedAt: number
  endsAt: number                       // epoch ms
  endReason: 'TIME' | 'LAST_MAN' | 'GM' | null
}

type Death = { victimId: string; killerId: string; at: number }
type Guess = { text: string; correct: boolean }

type Pack = { id: string; theme: string; words: string[] }
```

### หลักการที่ยึด

- `Player.id` แยกจาก socket id — refresh หน้า/เน็ตหลุดแล้วกลับเข้าห้องเดิมได้ ไม่กลายเป็นคนใหม่
- `Player.id` เปิดเผยได้ แต่ `Player.sessionToken` ห้ามหลุดออกจากเจ้าตัว — ดูหัวข้อตัวตนใน §4
- `assignments` อยู่ที่ server เท่านั้น ทุก payload ที่ส่งออกต้องผ่าน `maskFor()`
- `endsAt` เป็น timestamp ไม่ใช่ตัวนับ — server ไม่ broadcast ทุกวินาที
- `hostId` ≠ `gmId` — host คุมห้อง (ตั้งค่า/เริ่มเกม/เตะคน/ไปรอบต่อไป), GM คุมรอบ (บันทึกคนตาย/จบรอบ)
- `deaths` เป็น list ไม่ใช่ flag — รองรับ undo และสรุปท้ายเกมว่าคะแนนมาจากไหน
- `wordBurned` — คนที่เคยเห็นคำตัวเองแล้ว ถึงจะ undo กลับมา alive ก็หมดสิทธิ์ทายคำตอนจบรอบ

### คลังคำ

`data/packs.json` — แต่ละ pack ต้องมีคำ **อย่างน้อย `MIN_WORDS_PER_PACK` (20) คำ**
ลึกกว่า `MAX_PLAYERS` มาก เพื่อให้แต่ละรอบหยิบได้ชุดคำต่างกันจริง ไม่ใช่วนคำเดิม
คำใน pack ต้องอยู่ในธีมเดียวกันจนหาเรื่องคุยให้อีกฝ่ายเผลอพูดได้ ไม่จำกัดว่าต้องเป็นคำนาม — เป็นคำกริยาหรือคำอื่นก็ได้
สุ่มหยิบเท่าจำนวนคน

**คำวิเศษ (`wildcards`)** — คำใช้ทั่วไปที่ไม่อยู่ในธีมไหน (`ใช่` `ไม่` `อะไร`)
โอกาส `WILDCARD_CHANCE` ที่รอบหนึ่งจะมี **1 คน** ได้คำวิเศษแทนคำในธีม
คำวิเศษห้ามชนกับคำใน pack ใดเลย — `loadPacks()` throw ถ้าชน
ไม่มีรอบที่ทุกคนได้คำวิเศษ (ทุกคนจะตายพร้อมกัน) และไม่บอกใครว่าใครถือ — เห็นเองตอน `ROUND_END`

## 4. Event protocol (Socket.IO)

หลักการ: client ส่ง **intent**, server ตัดสินและตอบ **state ที่ mask แล้ว**
ไม่มี event ใดที่ client เป็นคนบอกคะแนนหรือผลลัพธ์

### Client → Server

| Event | Payload | สิทธิ์ |
|---|---|---|
| `room:create` | `{ name, totalRounds }` | ใครก็ได้ |
| `room:join` | `{ code, name, playerId?, sessionToken? }` | ใครก็ได้ |
| `room:leave` | — | ทุกคนในห้อง |
| `player:ready` | `{ ready: boolean }` | ทุกคน (เฉพาะ `LOBBY`) |
| `game:start` | — | host |
| `gm:kill` | `{ victimId, killerId }` | GM ของรอบนั้น |
| `gm:undoKill` | `{ deathIndex }` | GM ของรอบนั้น |
| `gm:endRound` | — | GM ของรอบนั้น |
| `guess:submit` | `{ text }` | คนที่รอด ตอน `ROUND_END` |
| `round:next` | — | host ตอน `ROUND_END` |
| `room:kick` | `{ playerId }` | host (เฉพาะ `LOBBY`) |
| `game:restart` | — | host ตอน `GAME_END` |

### Server → Client

| Event | Payload |
|---|---|
| `state:sync` | `MaskedRoomState` — ส่งทุกครั้งที่ state เปลี่ยน |
| `round:started` | `{ round, gmId, packTheme, endsAt }` |
| `player:died` | `{ victimId, killerId, revealedWord }` |
| `round:ended` | `{ endReason, needsGuessFrom: string[] }` |
| `game:ended` | `{ standings, roundHistory }` |
| `error` | `{ code, message }` |

### maskFor() — invariant หลักของเกม

```ts
function maskFor(room: Room, viewerId: string): MaskedRoomState
```

ทุก emit ต้องผ่านฟังก์ชันนี้ กฎ:

1. ระหว่าง `PLAYING` — คำของ `viewerId` ส่งเป็น `null` เสมอ (ไม่ใช่ส่งไปแล้วซ่อนด้วย CSS)
2. คำของคนอื่น — ส่งค่าจริง
3. คนที่ตายแล้ว — ส่งคำจริงให้เจ้าตัวได้
4. `ROUND_END` / `GAME_END` — เปิดคำทุกคน

### รายละเอียดที่ตัดสินใจไว้

- **ไม่มี event รายวินาที** — client นับถอยหลังเองจาก `endsAt`; server ตั้ง `setTimeout` เดียวต่อรอบเพื่อยิง `round:ended`
- **`state:sync` ส่งทั้งก้อน ไม่ส่ง delta** — ห้อง 12 คนเล็กมาก การส่งทั้งก้อนตัดบั๊ก state หลุดกันทิ้ง
- **ตรวจสิทธิ์ที่ server ทุก event** — `gm:kill` จากคนที่ไม่ใช่ GM ต้องตอบ `error` ไม่ใช่แค่ซ่อนปุ่มใน UI
- **`gm:undoKill`** — คืนสถานะ alive และคืนคะแนน −1 ให้คนหลอก แต่ victim ยังติด `wordBurned` (เห็นคำไปแล้ว เล่นต่อได้แต่หมดสิทธิ์ทาย)
- **`guess:submit`** — ตรวจฝั่ง server, normalize ก่อนเทียบ, ส่งได้ครั้งเดียวต่อรอบ
- **reconnect** — `room:join` พร้อม `playerId` **และ `sessionToken`** เดิม คืนคะแนน คำ และสิทธิ์ GM ให้ครบ

### ตัวตน: `playerId` เปิดเผย · `sessionToken` เป็นความลับ

`playerId` เป็นของสาธารณะ — ทุกคนเห็นใน `MaskedPlayer.id` เพราะ UI ต้องอ้างถึงกัน
(กดเลือกคนตาย เลือกคนหลอก เตะคน) จึงพิสูจน์ตัวตนด้วยตัวเองไม่ได้:
ใครก็ตามที่เปิด devtools ก๊อป `id` ของเพื่อนแล้ว `room:join` ทับได้ทันที
ผลคืออ่านคำตัวเองจาก `state:sync` ได้ และได้สิทธิ์ host/GM ของคนนั้นไปด้วย — invariant ทั้งหมดของ `maskFor` พังลงตรงนี้

จึงแยกเป็นสองค่า:

| ค่า | ใครเห็น | หน้าที่ |
|---|---|---|
| `playerId` | ทุกคนในห้อง | ตัวตนสาธารณะ ใช้ชี้ตัวใน UI และใน payload |
| `sessionToken` | เจ้าตัวคนเดียว | ความลับที่พิสูจน์ว่า "ฉันคือเจ้าของที่นั่งนี้จริง" |

- `maskFor(room, viewerId)` ใส่ `sessionToken` ของ **viewer คนนั้นคนเดียว** ไว้ที่ระดับบนสุดของ `MaskedRoomState`
  ห้ามอยู่ใน `MaskedPlayer` เด็ดขาด — ถ้าอยู่ใน array ของผู้เล่น เท่ากับแจกกุญแจของทุกคนให้ทุกคน
- `room:join` ที่ส่ง `playerId` ซึ่งมีอยู่แล้วในห้อง แต่ `sessionToken` ไม่ตรง → ตอบ `error` รหัส `BAD_SESSION`
- client เก็บ token แยกต่อห้องใน localStorage และเมื่อโดน `BAD_SESSION` ต้องทิ้งทั้ง `playerId` และ token แล้วขึ้นตัวตนใหม่
  ไม่งั้นจะลองเข้าใหม่ด้วยของเก่าที่ใช้ไม่ได้วนไปเรื่อยๆ

## 5. หน้าจอและ flow

Mobile-first ทั้งหมด ทำเป็น HTML draft ใน `docs/mockups/` ก่อนเขียนโค้ดจริง
ทุก phase อยู่ URL เดียว `/room/[code]` สลับ view ตาม `phase` — ไม่มี routing race ตอน state เปลี่ยน

**Home (`/`)**
กรอกชื่อ (จำจาก localStorage) → "สร้างห้อง" | "เข้าร่วมห้อง" (กรอกโค้ด 6 ตัว)

**Lobby (`phase: LOBBY`)**
- โค้ดห้องตัวใหญ่ + ปุ่มคัดลอกลิงก์เชิญ
- รายชื่อผู้เล่น + สถานะ พร้อม / ยังไม่พร้อม / หลุด
- host เห็น: ตั้งจำนวนรอบ, ปุ่ม "เริ่มเกม" (กดได้เมื่อ ≥3 คน และพร้อมครบ), ปุ่มเตะคน
- คนอื่นเห็น: ปุ่ม "พร้อม"

**Countdown (`phase: COUNTDOWN`)** — นับ 3-2-1 เต็มจอ แล้วเข้าเกมอัตโนมัติ

**Playing (`phase: PLAYING`)** — หน้าหลัก
- แถบบน: เวลาถอยหลัง, "รอบ 2/5", ธีมของ pack
- การ์ดตัวเอง: ช่องคำแสดง `? ? ?` — คำไม่อยู่ใน DOM
- การ์ดคนอื่น: ชื่อ + คำ ตัวใหญ่อ่านง่าย (เล่นต่อหน้ากัน อาจต้องชะโงกดู); คนตายแล้วการ์ดจาง + ป้าย "ตายแล้ว"
- ถ้าเป็น GM: แถบเครื่องมือล่างจอ — "บันทึกคนตาย" (เลือกคนตาย → เลือกคนหลอก → ยืนยัน), "จบรอบ", รายการ undo
- ถ้าตายแล้ว: ปุ่ม "เปิดคำของฉัน" และดูเกมต่อได้

**Round end (`phase: ROUND_END`)**
- เปิดคำทุกคนพร้อมกัน
- คนที่รอด (และไม่ติด `wordBurned`): ช่องพิมพ์ "คำของคุณคืออะไร?" ส่งแล้วรู้ผลทันที
- ตารางคะแนนรอบนี้ + สะสม
- host: ปุ่ม "รอบต่อไป" หรือ "ดูสรุป" ถ้าครบรอบแล้ว

**Summary (`phase: GAME_END`)**
อันดับ 1-2-3 เด่น + ตารางเต็ม + ประวัติรายรอบ (ใครฆ่าใคร) + ปุ่ม "เล่นอีกรอบ" (ใช้ห้องเดิม รีเซ็ตคะแนน)

## 6. กติกาเวลาและคะแนน

### เวลาต่อรอบ

```
durationMs = Math.ceil(playerCount / 4) * 5 * 60_000
```

3-4 คน → 3 นาที · 5-8 คน → 6 นาที · 9-12 คน → 9 นาที
คิดจากจำนวนคน **ตอนเริ่มรอบ** มีคนหลุดกลางรอบเวลาไม่เปลี่ยน

### คะแนน (server คำนวณฝ่ายเดียว)

| เหตุการณ์ | ผล |
|---|---|
| GM บันทึกว่า A ตาย โดย B เป็นคนหลอก | B **+1**, A ได้ 0 |
| รอดจนจบรอบ + ทายคำตัวเองถูก | **+1** |
| รอดจนจบรอบ + ทายผิด | 0 |
| ตายไปแล้ว (หรือติด `wordBurned`) | ไม่มีสิทธิ์ทาย |
| undo kill | คืน −1 จาก B, A กลับมา alive |

### เงื่อนไขจบรอบ

1. หมดเวลา (`TIME`)
2. เหลือคนรอด 1 คน (`LAST_MAN`) — คนสุดท้ายได้สิทธิ์ทายคำเช่นกัน
3. GM กดจบเอง (`GM`)

### การทายคำ — normalize ก่อนเทียบ

```ts
const norm = (s: string) => s.trim().toLowerCase()
  .replace(/\s+/g, '')                // ตัดช่องว่างทั้งหมด
  .replace(/[็-๎]/g, '')    // ตัดวรรณยุกต์ ไม้ไต่คู้ การันต์
  .normalize('NFC')
```

ตัดวรรณยุกต์เพราะพิมพ์ไทยบนมือถือพลาดง่าย แต่ตัวสะกดหลักต้องถูก
ส่งได้ครั้งเดียวต่อรอบ ไม่ให้ลองซ้ำ

### รอบถัดไป

สุ่ม pack ใหม่ (เลี่ยง `usedPackIds`; ถ้าใช้ครบแล้ววนกลับได้) + สุ่ม GM ใหม่ (เลี่ยงคนที่เพิ่งเป็น ถ้ายังมีคนอื่นให้เลือก) + คะแนนสะสมต่อ

### เคสที่ต้องบังคับด้วยกฎ

- คนที่หลุดกลางรอบยังนับเป็น alive (ตัวจริงยังนั่งเล่นอยู่ในวง)
- `victimId === killerId` → ปฏิเสธ
- kill คนที่ตายแล้ว → ปฏิเสธ
- kill คนที่ไม่ได้อยู่ในรอบ → ปฏิเสธ

## 7. การจัดการห้องและ resource

ห้อง 12 คนเต็มกินหน่วยความจำราว 3-5 KB → 200 ห้องราว 1 MB
เพดานจึงไม่ได้มีไว้กัน RAM โดยตรง แต่กันการถูกยิงสร้างห้องรัวจนโตไม่หยุด

- **`MAX_ROOMS = 200`** — เกินแล้ว `room:create` ตอบ error "เซิร์ฟเวอร์เต็ม" **ห้ามลบห้องที่มีคนกำลังเล่น**
- **Sweeper ทุก 5 นาที** ลบ: ห้องที่ไม่มีใคร connected เกิน 30 นาที, ห้อง `LOBBY` ที่สร้างเกิน 60 นาทีแล้วไม่เคยเริ่ม, ห้อง `GAME_END` ที่จบเกิน 30 นาที
- **Rate limit** — สร้างได้ไม่เกิน 3 ห้อง/นาที ต่อ IP
- Sweeper ต้องรัน**ก่อน**เช็คเพดานเสมอ เพื่อคืนที่ว่างก่อนปฏิเสธคนใหม่
- โค้ดห้องสุ่มแล้วเช็คซ้ำใน Map ถ้าชนสุ่มใหม่
- ใช้ `socket.join(code)` และ `io.to(code).emit()` เสมอ — ห้ามใช้ `io.emit` (จะรั่วข้ามห้อง)
- คนหนึ่งอยู่ได้ห้องเดียว: join ห้องใหม่ = ออกจากห้องเก่าอัตโนมัติ

ค่าคงที่ทั้งหมดอยู่ใน `constants.ts` ไฟล์เดียว

### ข้อจำกัดที่รู้ตัว (known limitation)

State อยู่ใน memory ของ process เดียว จึง**รัน server ได้ instance เดียวเท่านั้น**
ถ้า scale หลาย instance ห้องจะกระจายคนละเครื่องและคนเข้าไม่เจอกัน
ทางแก้ในอนาคตคือย้าย `room-store` ไป Redis — ตอนนี้ไม่ทำ
`room-store.ts` จึงถูกออกแบบเป็น interface เดียวเพื่อให้เปลี่ยนภายหลังได้โดยไม่แตะ logic เกม

## 8. โครงไฟล์

```
kham-tong-ham/
├── docs/
│   ├── superpowers/specs/2026-09-05-kham-tong-ham-design.md
│   ├── requirements.md
│   └── mockups/
│       ├── home.html  lobby.html  playing.html
│       ├── round-end.html  summary.html
│       └── style.css
│
├── server/
│   ├── index.ts            # custom server: Next handler + Socket.IO
│   ├── socket-handlers.ts  # แปลง event → เรียก core → emit (ชั้นบาง)
│   └── core/
│       ├── room-store.ts   # Map + sweeper + เพดานห้อง
│       ├── game.ts         # state machine, kill, undo, endRound, nextRound
│       ├── mask.ts         # maskFor()
│       ├── scoring.ts      # คะแนน + normalize()
│       ├── timing.ts       # สูตรเวลา
│       └── types.ts
│
├── src/app/
│   ├── page.tsx
│   ├── room/[code]/page.tsx
│   └── _components/        # Lobby, Countdown, Playing, RoundEnd, Summary
├── src/lib/
│   ├── socket-client.ts
│   └── use-room.ts
├── data/packs.json
└── constants.ts
```

`server/core/` เป็นฟังก์ชันบริสุทธิ์: รับ state คืน state ใหม่ ไม่แตะ socket ไม่แตะ I/O
ทำให้เทสกติกาทั้งหมดได้โดยไม่ต้องเปิด server และแต่ละไฟล์เล็กพอจะแก้ทีละอันโดยไม่กระทบตัวอื่น

## 9. Testing

ใช้ TDD — เขียนเทสก่อนโค้ด

### Unit (vitest) — ครอบกติกาทั้งหมด

- **`mask.test.ts`** (สำคัญที่สุด) — วนทุกผู้เล่น × ทุก phase ยืนยันว่าไม่มีใครเห็นคำตัวเองระหว่าง `PLAYING` และเห็นได้เมื่อตาย/จบรอบ
- `scoring.test.ts` — +1 คนหลอก, undo คืนแต้ม, ทายถูก/ผิด, normalize ภาษาไทย, `wordBurned` หมดสิทธิ์ทาย
- `timing.test.ts` — 3→5น. 4→5น. 5→10น. 8→10น. 9→15น. 12→15น.
- `game.test.ts` — ลำดับ phase, kill เคสผิดกฎถูกปฏิเสธ, จบรอบทั้ง 3 แบบ, สุ่ม GM/pack ไม่ซ้ำ
- `room-store.test.ts` — โค้ดห้องไม่ชน, เพดาน 200, sweeper ลบเฉพาะห้องร้าง

### Integration (socket จริง, server ใน memory)

- Authorization — คนที่ไม่ใช่ GM ยิง `gm:kill` ต้องได้ `error`
- Reconnect — หลุดแล้ว join ด้วย `playerId` เดิม คืนคะแนน/คำ/สิทธิ์ GM ครบ
- Multi-room — 2 ห้องพร้อมกัน event ไม่รั่วข้ามห้อง
- เกมเต็มรอบ — 4 คน: สร้าง → ready → เล่น → kill → หมดเวลา → ทายคำ → สรุป

### ไม่ทำ

E2E เบราว์เซอร์ — เกมเล่นเห็นหน้ากัน ตรวจ UI ด้วยตาจาก mockup พอ

## 10. ลำดับการสร้าง

1. HTML mockup ทุกหน้า (`docs/mockups/`) — เห็น flow จริงก่อนลงโค้ด
2. `server/core/` + เทส (TDD)
3. `server/socket-handlers.ts` + integration test
4. Next.js UI ต่อของจริง
