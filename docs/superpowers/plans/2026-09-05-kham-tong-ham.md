# คำต้องห้าม (Kham Tong Ham) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บกระดานเกม "คำต้องห้าม" ที่แจกคำไทยให้ผู้เล่น 3-12 คนโดยเจ้าตัวไม่เห็นคำของตัวเอง จับเวลา บันทึกคนตาย นับคะแนน และสรุปผล

**Architecture:** Server เป็นแหล่งความจริงเดียว (server-authoritative) — กติกาทั้งหมดอยู่ใน `server/core/` ซึ่งเป็นโมดูลที่ไม่แตะ I/O เลย (ไม่มี socket ไม่มี timer ไม่มี fs) จึงเทสได้ตรงๆ ชั้น `socket-handlers.ts` ทำหน้าที่แปลง event → เรียก core → emit เท่านั้น Client ไม่คำนวณกติกาใดๆ รับ `MaskedRoomState` มาวาด คำของผู้เล่นเองไม่เคยถูกส่งไปที่เครื่องเจ้าตัวระหว่างเล่น

**Tech Stack:** Next.js 16.3.4 (App Router + custom server), React 19.2.8, TypeScript 7.0.2, Socket.IO 4.8.3, Tailwind CSS 4.3.3, zod 4.5.4, nanoid 6.0.1, vitest 5.0.0, Node.js 26.7.0

**Spec:** `docs/superpowers/specs/2026-09-05-kham-tong-ham-design.md`

## Global Constraints

- Node.js >= 20 (เครื่องที่ใช้: 26.7.0), npm 11.19.0
- เวอร์ชัน dependency ตรึงตามที่ระบุใน Tech Stack ข้างบน (ตรวจจาก `npm view` เมื่อ 2026-09-05)
- ผู้เล่นต่อห้อง: ขั้นต่ำ 3 สูงสุด 12
- เพดานห้องพร้อมกัน: 200 ห้อง — ห้ามลบห้องที่มีคนกำลังเล่นเพื่อคืนที่ว่าง
- Rate limit สร้างห้อง: 3 ห้อง/นาที ต่อ IP
- สูตรเวลาต่อรอบ: `Math.ceil(playerCount / 4) * 5 * 60_000` มิลลิวินาที คิดจากจำนวนคน ณ ตอนเริ่มรอบ
- คะแนน: หลอกสำเร็จ +1 ให้คนหลอก · รอดจนจบรอบและทายคำตัวเองถูก +1 · undo kill คืน −1
- ทุก payload ที่ส่งออกจาก server ต้องผ่าน `maskFor()` — ห้าม emit `Room` ดิบ
- ทุก event ที่รับจาก client ต้องผ่าน zod parse ก่อนถึงชั้น core
- ใช้ `io.to(code).emit()` เสมอ — ห้ามใช้ `io.emit()` (จะรั่วข้ามห้อง)
- ค่าคงที่ทั้งหมดอยู่ใน `constants.ts` ไฟล์เดียว ห้าม hardcode ตัวเลขในโค้ดอื่น
- UI เป็น mobile-first ทุกหน้า
- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทยทั้งหมด
- TDD: เขียนเทสให้แดงก่อน แล้วค่อยเขียนโค้ดให้เขียว commit ทุกครั้งที่จบ task

## หมายเหตุ: จุดที่ขยายจากสเปก

สเปกเขียนไว้กว้าง แผนนี้ลงรายละเอียดเพิ่มในสามจุด — ตัดสินใจไว้ตรงนี้เพื่อให้ทุก task อ้างอิงตรงกัน:

1. **core ใช้การ mutate `Room` แล้วคืน `Result`** ไม่ใช่คืน state ใหม่แบบ immutable — สเปกเขียนว่า "รับ state คืน state ใหม่" แต่ `Room` มี `Map`/`Set` ซ้อนหลายชั้น การ deep clone ทุก event เพิ่มพื้นที่บั๊กโดยไม่ได้ประโยชน์ (server เป็น single-threaded และเป็นเจ้าของ state คนเดียว) สิ่งที่ทำให้ core เทสได้คือ **การไม่มี I/O** ซึ่งยังคงไว้ครบ
2. **เพิ่มไฟล์นอกโครงในสเปก 3 ไฟล์:** `server/core/packs.ts` (โหลดและสุ่ม pack), `server/core/rate-limit.ts` (โควตาสร้างห้องต่อ IP), `server/schemas.ts` (zod) — แยกออกมาเพราะแต่ละอันมีเหตุผลเปลี่ยนแปลงคนละแบบกับไฟล์ที่มีอยู่
3. **เพิ่ม event นอกตารางในสเปก 2 ตัว:** `room:kick` (สเปกหัวข้อ 5 ระบุว่า host มีปุ่มเตะคน แต่ตาราง event ไม่มี) และ `game:restart` (สเปกหัวข้อ 5 ระบุปุ่ม "เล่นอีกรอบ") — ทั้งคู่ตรวจสิทธิ์ host ที่ core เหมือน event อื่น
4. **เพิ่มฟิลด์ใน `Room` 3 ตัว:** `countdownEndsAt` (หน้า countdown ต้องรู้ว่านับถึงเมื่อไหร่), `lastGmId` (เลี่ยงสุ่ม GM ซ้ำคนเดิม), `roundHistory` (หน้าสรุปต้องแสดงประวัติรายรอบ)

---

## File Structure

**ชั้นกติกา — `server/core/` (ฟังก์ชันบริสุทธิ์ ไม่แตะ I/O)**

| ไฟล์ | รับผิดชอบ |
|---|---|
| `types.ts` | นิยาม type ทั้งหมดของโดเมน ไม่มี logic |
| `timing.ts` | สูตรเวลาต่อรอบอย่างเดียว |
| `scoring.ts` | normalize คำไทย + เทียบคำทาย + ปรับคะแนน |
| `mask.ts` | `maskFor()` — ตัดสินว่าใครเห็นคำอะไร |
| `packs.ts` | โหลด `data/packs.json`, validate, สุ่ม pack, แจกคำ |
| `game.ts` | state machine: start, kill, undo, endRound, guess, nextRound |
| `room-store.ts` | เก็บห้องใน `Map` + สร้างโค้ด + เพดาน + sweeper |
| `rate-limit.ts` | โควตาสร้างห้องต่อ IP |

**ชั้นเชื่อม — `server/`**

| ไฟล์ | รับผิดชอบ |
|---|---|
| `schemas.ts` | zod schema ของทุก payload ที่รับจาก client |
| `socket-handlers.ts` | รับ event → validate → เรียก core → emit (ไม่มีกติกาอยู่ในนี้) |
| `index.ts` | ผูก Next handler เข้ากับ HTTP server และติด Socket.IO |

**ชั้น UI — `src/`**

| ไฟล์ | รับผิดชอบ |
|---|---|
| `src/lib/socket-client.ts` | สร้าง socket singleton + จำ `playerId` ใน localStorage |
| `src/lib/use-room.ts` | hook เดียวที่ถือ `MaskedRoomState` และ action ทั้งหมด |
| `src/lib/use-countdown.ts` | hook นับถอยหลังจาก `endsAt` |
| `src/app/page.tsx` | หน้า Home |
| `src/app/room/[code]/page.tsx` | สลับ view ตาม `phase` |
| `src/app/_components/*.tsx` | Lobby, Countdown, Playing, RoundEnd, Summary, PlayerCard, GmToolbar |

**ราก**

| ไฟล์ | รับผิดชอบ |
|---|---|
| `constants.ts` | ค่าคงที่ทุกตัวของระบบ |
| `data/packs.json` | คลังคำ |
| `docs/mockups/*.html` | ดราฟต์หน้าตาก่อนลงโค้ดจริง |

**ทิศทางการพึ่งพา:** `types` ← `timing`/`scoring`/`mask`/`packs` ← `game` ← `room-store` ← `socket-handlers` ← `index`
ไม่มีลูกศรย้อนกลับ — ชั้นล่างไม่รู้จักชั้นบน

---

## Task 1: ตั้งโปรเจกต์และ mockup ทุกหน้า

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `next.config.ts`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder)
- Create: `docs/mockups/style.css`
- Create: `docs/mockups/home.html`, `lobby.html`, `countdown.html`, `playing.html`, `round-end.html`, `summary.html`

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces: โปรเจกต์ที่รัน `npm test` และ `npm run dev` ได้ + mockup ที่เปิดดูได้ในเบราว์เซอร์

**เป้าหมายของ mockup:** เห็น flow และหน้าตาจริงก่อนเขียน React ทุกหน้าเป็น HTML นิ่งๆ ข้อมูลปลอมฝังในไฟล์ ใช้ CSS มือเขียนใน `docs/mockups/style.css` (ไม่ใช่ Tailwind CDN — สเปกหัวข้อ 2 เขียนว่า CDN แต่เนื้อ mockup ที่แผนนี้กำหนดใช้ class ของตัวเอง `.card` `.btn` `.word` ทั้งหมด การใส่ script CDN ที่ไม่มีใครเรียกใช้จึงเป็นของเกิน) เปิดไฟล์ดูได้เลยโดยไม่ต้อง build — React จริงใน Task 13-16 ใช้ Tailwind v4 ที่ build จริง ไม่เกี่ยวกับไฟล์ mockup

- [ ] **Step 1: สร้าง git repo และไฟล์ ignore**

```bash
cd /Users/mudflap/Workspace/playground/kham-tong-ham
git init
cat > .gitignore <<'EOF'
node_modules/
.next/
dist/
*.log
.DS_Store
.env*.local
coverage/
EOF
git add .gitignore docs/
git commit -m "chore: init repo with design spec and plan"
```

- [ ] **Step 2: สร้าง package.json**

```json
{
  "name": "kham-tong-ham",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch server/index.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "socket.io": "4.8.3",
    "socket.io-client": "4.8.3",
    "nanoid": "6.0.1",
    "zod": "4.5.4"
  },
  "devDependencies": {
    "@types/node": "26.0.0",
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "@tailwindcss/postcss": "4.3.3",
    "tailwindcss": "4.3.3",
    "tsx": "4.23.13",
    "typescript": "7.0.2",
    "vitest": "5.0.0"
  }
}
```

- [ ] **Step 3: ติดตั้ง dependency**

```bash
npm install
```

ถ้าเวอร์ชันไหนติดตั้งไม่ได้ (ยังไม่ปล่อยจริง) ให้รัน `npm view <pkg> version` แล้วใช้เวอร์ชันล่าสุดที่มีจริง และแก้ไขตัวเลขใน `package.json` กับหัวข้อ Tech Stack ของแผนนี้ให้ตรงกัน อย่าปล่อยให้เอกสารกับโค้ดไม่ตรงกัน

- [ ] **Step 4: สร้าง tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@core/*": ["./server/core/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: สร้าง vitest.config.ts และ next.config.ts**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./server/core', import.meta.url)),
    },
  },
})
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 6: สร้างโครง Next ขั้นต่ำให้ build ผ่าน**

`src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  background: #0f172a;
  color: #f1f5f9;
  font-family: system-ui, -apple-system, "Noto Sans Thai", sans-serif;
}
```

`postcss.config.mjs`:
```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

`src/app/layout.tsx`:
```tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'คำต้องห้าม',
  description: 'เกมคำต้องห้าม เล่นกับเพื่อนแบบเห็นหน้ากัน',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/page.tsx` (placeholder — Task 12 จะเขียนของจริง):
```tsx
export default function Home() {
  return <main className="p-6">คำต้องห้าม</main>
}
```

- [ ] **Step 7: ยืนยันว่าเครื่องมือทำงาน**

```bash
npm run typecheck
npx vitest run --passWithNoTests
```
Expected: typecheck ผ่าน, vitest รายงานว่าไม่มีเทส (ยังไม่มีไฟล์เทส — ถูกต้อง)

`npm test` เปล่าๆ (ไม่มี `--passWithNoTests`) จะ exit 1 จนกว่า Task 3 จะมีไฟล์เทสไฟล์แรก — เป็นพฤติกรรมปกติของ vitest เมื่อไม่มีเทสเลย ไม่ใช่ pipeline พัง ตอนตรวจ Task 1 กับ Task 2 ให้ใช้คำสั่งข้างบนแทน

- [ ] **Step 8: เขียน `docs/mockups/style.css`**

สไตล์ร่วมของทุก mockup — โทนมืด ตัวหนังสือใหญ่อ่านง่ายบนมือถือ

```css
:root {
  --bg: #0f172a;
  --card: #1e293b;
  --card-dead: #16202e;
  --text: #f1f5f9;
  --muted: #94a3b8;
  --accent: #38bdf8;
  --danger: #f87171;
  --ok: #4ade80;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Noto Sans Thai", sans-serif;
  max-width: 480px;
  margin-inline: auto;
  padding: 16px;
  padding-bottom: 96px;
}

.card {
  background: var(--card);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}

.card.dead { background: var(--card-dead); opacity: 0.55; }

.word { font-size: 32px; font-weight: 700; letter-spacing: 1px; }
.word.hidden-word { color: var(--muted); letter-spacing: 8px; }

.name { font-size: 14px; color: var(--muted); margin-bottom: 4px; }

.btn {
  display: block;
  width: 100%;
  padding: 16px;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #082f49;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.btn.secondary { background: var(--card); color: var(--text); }
.btn.danger { background: var(--danger); color: #450a0a; }

.gm-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  max-width: 480px;
  margin-inline: auto;
  background: var(--card);
  padding: 12px;
  border-top: 2px solid var(--accent);
}

.timer { font-size: 40px; font-weight: 700; text-align: center; }
.topbar { display: flex; justify-content: space-between; color: var(--muted); font-size: 14px; margin-bottom: 8px; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--danger); color: #450a0a; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 10px 6px; text-align: left; border-bottom: 1px solid #334155; }
```

- [ ] **Step 9: เขียน mockup ทั้ง 6 หน้า**

ทุกไฟล์ขึ้นต้นเหมือนกัน:
```html
<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>คำต้องห้าม — [ชื่อหน้า]</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
```

`home.html` — เนื้อหา:
```html
<h1>คำต้องห้าม</h1>
<div class="card">
  <label class="name" for="nm">ชื่อของคุณ</label>
  <input id="nm" value="สมชาย" style="width:100%;padding:12px;font-size:18px;border-radius:8px;border:0">
</div>
<button class="btn">สร้างห้อง</button>
<div class="card">
  <label class="name" for="cd">มีโค้ดห้องแล้ว?</label>
  <input id="cd" placeholder="ABC234" style="width:100%;padding:12px;font-size:24px;letter-spacing:4px;text-align:center;border-radius:8px;border:0">
</div>
<button class="btn secondary">เข้าร่วมห้อง</button>
```

`lobby.html` — เนื้อหา:
```html
<div class="card" style="text-align:center">
  <div class="name">โค้ดห้อง</div>
  <div style="font-size:44px;font-weight:700;letter-spacing:8px">ABC234</div>
  <button class="btn secondary" style="margin-top:12px">คัดลอกลิงก์เชิญ</button>
</div>
<div class="card">
  <div class="name">จำนวนรอบ</div>
  <select style="width:100%;padding:12px;font-size:18px;border-radius:8px;border:0">
    <option>3 รอบ</option><option selected>5 รอบ</option><option>7 รอบ</option>
  </select>
</div>
<h3>ผู้เล่น 4 คน</h3>
<div class="card"><span>สมชาย <span class="badge" style="background:var(--accent);color:#082f49">host</span></span> — พร้อม</div>
<div class="card">มานี — พร้อม</div>
<div class="card">ปิติ — ยังไม่พร้อม</div>
<div class="card" style="opacity:.5">ชูใจ — หลุดการเชื่อมต่อ</div>
<button class="btn">เริ่มเกม</button>
<p style="color:var(--muted);font-size:13px">ต้องมีอย่างน้อย 3 คน และทุกคนกดพร้อมแล้ว</p>
```

`countdown.html` — เนื้อหา:
```html
<div style="display:flex;align-items:center;justify-content:center;height:70vh;flex-direction:column">
  <div style="font-size:120px;font-weight:700;color:var(--accent)">3</div>
  <div style="color:var(--muted)">กำลังแจกคำ...</div>
</div>
```

`playing.html` — เนื้อหา (หน้าที่สำคัญที่สุด แสดงทั้งมุมมอง GM และคนตาย):
```html
<div class="topbar"><span>รอบ 2/5</span><span>หมวด: ของกินริมทาง</span></div>
<div class="timer">07:42</div>

<div class="card" style="border:2px solid var(--accent)">
  <div class="name">คุณ (สมชาย)</div>
  <div class="word hidden-word">? ? ?</div>
</div>

<div class="card"><div class="name">มานี</div><div class="word">ลูกชิ้นปิ้ง</div></div>
<div class="card"><div class="name">ปิติ</div><div class="word">ต่อคิว</div></div>
<div class="card dead">
  <div class="name">ชูใจ <span class="badge">ตายแล้ว</span></div>
  <div class="word">น้ำแข็งไส</div>
</div>

<div class="gm-bar">
  <div class="name" style="margin-bottom:8px">คุณเป็น Game Master</div>
  <button class="btn danger" style="margin-bottom:8px">บันทึกคนตาย</button>
  <button class="btn secondary" style="margin-bottom:0">จบรอบนี้</button>
</div>
```

`round-end.html` — เนื้อหา:
```html
<h2>จบรอบ 2 — หมดเวลา</h2>
<div class="card" style="border:2px solid var(--accent)">
  <div class="name">คำของคุณคืออะไร?</div>
  <input placeholder="พิมพ์คำที่คิดว่าใช่" style="width:100%;padding:12px;font-size:18px;border-radius:8px;border:0;margin-bottom:8px">
  <button class="btn" style="margin-bottom:0">ส่งคำตอบ</button>
</div>
<h3>เฉลยคำทุกคน</h3>
<div class="card"><div class="name">สมชาย (คุณ)</div><div class="word">ปาท่องโก๋</div></div>
<div class="card"><div class="name">มานี</div><div class="word">ลูกชิ้นปิ้ง</div></div>
<div class="card"><div class="name">ปิติ</div><div class="word">ต่อคิว</div></div>
<h3>คะแนน</h3>
<table>
  <tr><th>ผู้เล่น</th><th>รอบนี้</th><th>รวม</th></tr>
  <tr><td>มานี</td><td>+2</td><td>5</td></tr>
  <tr><td>สมชาย</td><td>+1</td><td>3</td></tr>
  <tr><td>ปิติ</td><td>0</td><td>1</td></tr>
</table>
<button class="btn">รอบต่อไป</button>
```

`summary.html` — เนื้อหา:
```html
<h1 style="text-align:center">จบเกม</h1>
<div class="card" style="text-align:center;border:2px solid var(--accent)">
  <div style="font-size:48px">🥇</div>
  <div style="font-size:28px;font-weight:700">มานี</div>
  <div style="color:var(--muted)">9 คะแนน</div>
</div>
<table>
  <tr><th>อันดับ</th><th>ผู้เล่น</th><th>คะแนน</th></tr>
  <tr><td>1</td><td>มานี</td><td>9</td></tr>
  <tr><td>2</td><td>สมชาย</td><td>6</td></tr>
  <tr><td>3</td><td>ปิติ</td><td>4</td></tr>
  <tr><td>4</td><td>ชูใจ</td><td>2</td></tr>
</table>
<h3>ประวัติรายรอบ</h3>
<div class="card">
  <div class="name">รอบ 1 — หมวด: สัตว์เลี้ยง</div>
  <div>มานี หลอก ปิติ สำเร็จ</div>
  <div>สมชาย ทายคำตัวเองถูก</div>
</div>
<button class="btn">เล่นอีกรอบ</button>
```

ทุกไฟล์ปิดท้ายด้วย `</body></html>`

- [ ] **Step 10: เปิด mockup ดูด้วยตา**

```bash
open docs/mockups/home.html docs/mockups/lobby.html docs/mockups/playing.html docs/mockups/round-end.html docs/mockups/summary.html
```
ย่อหน้าต่างเบราว์เซอร์ให้กว้างเท่ามือถือ (ราว 390px) ตรวจว่าอ่านง่าย ปุ่มกดถนัด คำของคนอื่นตัวใหญ่พอ

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold project and add HTML mockups"
```

---

## Task 2: constants และ types

**Files:**
- Create: `constants.ts`
- Create: `server/core/types.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces: type ทุกตัวของโดเมน และค่าคงที่ทุกตัว — task ที่เหลือทั้งหมด import จากสองไฟล์นี้

Task นี้ไม่มีเทสเพราะไม่มี behavior — เป็นการประกาศล้วนๆ ตัว typecheck คือการตรวจ

- [ ] **Step 1: เขียน `constants.ts`**

```ts
/** ค่าคงที่ทั้งระบบ — ห้าม hardcode ตัวเลขพวกนี้ที่อื่น */

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 10
export const DEFAULT_ROUNDS = 5

/** ทุก 4 คน เพิ่มเวลา 5 นาที */
export const PLAYERS_PER_TIME_BUCKET = 4
export const MINUTES_PER_TIME_BUCKET = 5

export const COUNTDOWN_MS = 3_000

export const MAX_ROOMS = 200
export const SWEEP_INTERVAL_MS = 5 * 60_000
/** ห้องที่ไม่มีใคร connected นานกว่านี้ ถูกลบ */
export const EMPTY_ROOM_TTL_MS = 30 * 60_000
/** ห้อง LOBBY ที่ไม่เคยเริ่มเกม นานกว่านี้ ถูกลบ */
export const STALE_LOBBY_TTL_MS = 60 * 60_000
/** ห้องที่จบเกมแล้ว นานกว่านี้ ถูกลบ */
export const FINISHED_ROOM_TTL_MS = 30 * 60_000

export const ROOM_CREATE_LIMIT = 3
export const ROOM_CREATE_WINDOW_MS = 60_000

export const ROOM_CODE_LENGTH = 6
/** ตัด I O 0 1 ออกเพราะอ่านสับสนตอนบอกกันปากเปล่า */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const MAX_NAME_LENGTH = 20
export const MAX_GUESS_LENGTH = 60
```

- [ ] **Step 2: เขียน `server/core/types.ts`**

```ts
export type Phase = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_END' | 'GAME_END'

export type EndReason = 'TIME' | 'LAST_MAN' | 'GM'

export type Player = {
  id: string
  name: string
  connected: boolean
  ready: boolean
  score: number
  joinedAt: number
}

export type Death = {
  victimId: string
  killerId: string
  at: number
}

export type Guess = {
  text: string
  correct: boolean
}

export type Round = {
  packId: string
  packTheme: string
  gmId: string
  /** playerId → คำ — ห้ามหลุดออกจาก server โดยไม่ผ่าน maskFor() */
  assignments: Map<string, string>
  alive: Set<string>
  /** คนที่เคยเห็นคำตัวเองแล้ว หมดสิทธิ์ทายคำแม้จะ undo กลับมา alive */
  wordBurned: Set<string>
  deaths: Death[]
  guesses: Map<string, Guess>
  startedAt: number
  endsAt: number
  endReason: EndReason | null
}

/** สรุปหนึ่งรอบ เก็บไว้แสดงในหน้าสรุปท้ายเกม */
export type RoundSummary = {
  round: number
  packTheme: string
  gmId: string
  endReason: EndReason
  deaths: Death[]
  words: Record<string, string>
  correctGuessers: string[]
}

export type Room = {
  code: string
  hostId: string
  phase: Phase
  totalRounds: number
  currentRound: number
  players: Map<string, Player>
  round: Round | null
  usedPackIds: string[]
  /** GM ของรอบที่แล้ว ใช้เลี่ยงการสุ่มซ้ำคนเดิม */
  lastGmId: string | null
  roundHistory: RoundSummary[]
  countdownEndsAt: number | null
  createdAt: number
  lastActivityAt: number
}

export type Pack = {
  id: string
  theme: string
  words: string[]
}

/** มุมมองของผู้เล่นหนึ่งคน — สิ่งเดียวที่ถูกส่งออกจาก server */
export type MaskedPlayer = {
  id: string
  name: string
  connected: boolean
  ready: boolean
  score: number
  isHost: boolean
  isGm: boolean
  isAlive: boolean
  /** null = ยังไม่ควรเห็นคำนี้ */
  word: string | null
  hasGuessed: boolean
  /** ผลการทายคำ — null เมื่อยังไม่ได้ทาย */
  guessCorrect: boolean | null
  canGuess: boolean
}

export type MaskedRoomState = {
  code: string
  phase: Phase
  viewerId: string
  totalRounds: number
  currentRound: number
  players: MaskedPlayer[]
  packTheme: string | null
  endsAt: number | null
  countdownEndsAt: number | null
  deaths: Death[]
  endReason: EndReason | null
  roundHistory: RoundSummary[]
}

/** ผลลัพธ์ของทุกฟังก์ชันใน core ที่อาจปฏิเสธคำสั่ง */
export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: ErrorCode; message: string }

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'SERVER_FULL'
  | 'RATE_LIMITED'
  | 'NOT_HOST'
  | 'NOT_GM'
  | 'WRONG_PHASE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_ALL_READY'
  | 'PLAYER_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'ALREADY_DEAD'
  | 'ALREADY_GUESSED'
  | 'CANNOT_GUESS'
  | 'INVALID_INPUT'
  | 'NO_PACK_AVAILABLE'

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = (code: ErrorCode, message: string): Result<never> =>
  ({ ok: false, code, message })
```

- [ ] **Step 3: ตรวจว่า typecheck ผ่าน**

Run: `npm run typecheck`
Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add constants.ts server/core/types.ts
git commit -m "feat: add domain types and constants"
```

---

## Task 3: สูตรเวลาต่อรอบ

**Files:**
- Create: `server/core/timing.ts`
- Test: `server/core/timing.test.ts`

**Interfaces:**
- Consumes: `constants.ts` — `PLAYERS_PER_TIME_BUCKET`, `MINUTES_PER_TIME_BUCKET`
- Produces: `roundDurationMs(playerCount: number): number`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

`server/core/timing.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { roundDurationMs } from './timing'

const MIN = 60_000

describe('roundDurationMs', () => {
  it('3-4 คน ได้ 5 นาที', () => {
    expect(roundDurationMs(3)).toBe(5 * MIN)
    expect(roundDurationMs(4)).toBe(5 * MIN)
  })

  it('5-8 คน ได้ 10 นาที', () => {
    expect(roundDurationMs(5)).toBe(10 * MIN)
    expect(roundDurationMs(8)).toBe(10 * MIN)
  })

  it('9-12 คน ได้ 15 นาที', () => {
    expect(roundDurationMs(9)).toBe(15 * MIN)
    expect(roundDurationMs(12)).toBe(15 * MIN)
  })

  it('ขอบเขตของ bucket ขยับที่ตัวคูณของ 4 พอดี', () => {
    expect(roundDurationMs(4)).not.toBe(roundDurationMs(5))
    expect(roundDurationMs(8)).not.toBe(roundDurationMs(9))
  })

  it('เพิ่มขึ้นแบบไม่ลดลงเมื่อคนเยอะขึ้น', () => {
    for (let n = 3; n < 12; n++) {
      expect(roundDurationMs(n + 1)).toBeGreaterThanOrEqual(roundDurationMs(n))
    }
  })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/timing.test.ts`
Expected: FAIL — หาโมดูล `./timing` ไม่เจอ

- [ ] **Step 3: เขียน implementation ให้น้อยที่สุดที่ทำให้เขียว**

`server/core/timing.ts`:
```ts
import { MINUTES_PER_TIME_BUCKET, PLAYERS_PER_TIME_BUCKET } from '../../constants'

/**
 * ทุก 4 คน (ปัดขึ้น) ได้เวลาเพิ่ม 5 นาที
 * 3-4 คน → 5 นาที · 5-8 → 10 · 9-12 → 15
 */
export function roundDurationMs(playerCount: number): number {
  const buckets = Math.ceil(playerCount / PLAYERS_PER_TIME_BUCKET)
  return buckets * MINUTES_PER_TIME_BUCKET * 60_000
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run server/core/timing.test.ts`
Expected: PASS ทั้ง 5 เทส

- [ ] **Step 5: Commit**

```bash
git add server/core/timing.ts server/core/timing.test.ts
git commit -m "feat: add round duration formula"
```

---

## Task 4: คลังคำและการสุ่มแจก

**Files:**
- Create: `data/packs.json`
- Create: `server/core/packs.ts`
- Test: `server/core/packs.test.ts`

**Interfaces:**
- Consumes: `types.ts` — `Pack`, `Result`, `ok`, `fail`; `constants.ts` — `MAX_PLAYERS`
- Produces:
  - `loadPacks(): Pack[]`
  - `pickPack(packs: Pack[], usedPackIds: string[], rng?: () => number): Result<Pack>`
  - `dealWords(pack: Pack, playerIds: string[], rng?: () => number): Map<string, string>`

**เรื่อง rng:** ทุกฟังก์ชันที่สุ่มรับ `rng` เป็นพารามิเตอร์ท้ายสุด default เป็น `Math.random` เพื่อให้เทสส่งค่าที่คาดเดาได้เข้าไป — นี่คือเหตุผลเดียวที่ core ยังเป็นฟังก์ชันบริสุทธิ์ได้ทั้งที่ต้องสุ่ม

- [ ] **Step 1: สร้าง `data/packs.json` — 6 pack ละ 14 คำ**

คำในแต่ละ pack ต้องอยู่ในธีมเดียวกันจนคุยกันแล้วมีโอกาสเผลอพูดออกมา ผสมคำนามกับคำกริยาได้

```json
{
  "packs": [
    {
      "id": "street-food",
      "theme": "ของกินริมทาง",
      "words": ["ลูกชิ้นปิ้ง", "ปาท่องโก๋", "น้ำแข็งไส", "หมูปิ้ง", "ส้มตำ", "ต่อคิว", "เผ็ด", "ทอด", "ราดซอส", "รถเข็น", "ห่อกลับบ้าน", "เงินทอน", "ไม้เสียบ", "ถุงพลาสติก"]
    },
    {
      "id": "office",
      "theme": "ชีวิตในออฟฟิศ",
      "words": ["ประชุม", "เจ้านาย", "โอที", "ลาป่วย", "เงินเดือน", "ตอกบัตร", "ปริ้นเตอร์", "อีเมล", "เลื่อนขั้น", "ลาออก", "กาแฟ", "แอร์หนาว", "เดดไลน์", "สไลด์"]
    },
    {
      "id": "school",
      "theme": "โรงเรียน",
      "words": ["การบ้าน", "สอบ", "ครู", "ชุดนักเรียน", "โดดเรียน", "เกรด", "ห้องสมุด", "กระดานดำ", "พักเที่ยง", "ลอกข้อสอบ", "เข้าแถว", "รุ่นพี่", "สนามบอล", "กระเป๋านักเรียน"]
    },
    {
      "id": "travel",
      "theme": "เที่ยวทะเล",
      "words": ["ทราย", "คลื่น", "ครีมกันแดด", "ดำน้ำ", "เรือ", "ผิวไหม้", "ร่มชายหาด", "หอย", "พระอาทิตย์ตก", "ว่ายน้ำ", "รองเท้าแตะ", "ปลา", "เกลือ", "ถ่ายรูป"]
    },
    {
      "id": "home",
      "theme": "สิ่งของในบ้าน",
      "words": ["ตู้เย็น", "รีโมท", "ซักผ้า", "กวาดบ้าน", "เตียง", "หม้อหุงข้าว", "พัดลม", "ผ้าห่ม", "รองเท้า", "ล้างจาน", "ขยะ", "หลอดไฟ", "กุญแจ", "โซฟา"]
    },
    {
      "id": "hospital",
      "theme": "โรงพยาบาล",
      "words": ["หมอ", "พยาบาล", "เข็มฉีดยา", "ยา", "วัดไข้", "รอคิว", "เอกซเรย์", "แผล", "ผ่าตัด", "รถพยาบาล", "ปวดหัว", "นอนโรงพยาบาล", "ใบเสร็จ", "ผ้าพันแผล"]
    }
  ]
}
```

- [ ] **Step 2: เขียนเทสที่ยังแดง**

`server/core/packs.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { loadPacks, pickPack, dealWords } from './packs'
import { MAX_PLAYERS } from '../../constants'
import type { Pack } from './types'

describe('loadPacks', () => {
  it('โหลดได้อย่างน้อย 1 pack', () => {
    expect(loadPacks().length).toBeGreaterThan(0)
  })

  it('ทุก pack มีคำอย่างน้อยเท่าจำนวนคนสูงสุด', () => {
    for (const p of loadPacks()) {
      expect(p.words.length, `pack ${p.id} มีคำไม่พอ`).toBeGreaterThanOrEqual(MAX_PLAYERS)
    }
  })

  it('ทุก pack ไม่มีคำซ้ำกันภายในตัวเอง', () => {
    for (const p of loadPacks()) {
      expect(new Set(p.words).size, `pack ${p.id} มีคำซ้ำ`).toBe(p.words.length)
    }
  })

  it('id ของ pack ไม่ซ้ำกัน', () => {
    const ids = loadPacks().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

const fakePacks: Pack[] = [
  { id: 'a', theme: 'A', words: ['a1', 'a2', 'a3'] },
  { id: 'b', theme: 'B', words: ['b1', 'b2', 'b3'] },
]

describe('pickPack', () => {
  it('เลี่ยง pack ที่ใช้ไปแล้ว', () => {
    const r = pickPack(fakePacks, ['a'], () => 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.id).toBe('b')
  })

  it('ใช้ครบทุก pack แล้ววนกลับมาใช้ซ้ำได้', () => {
    const r = pickPack(fakePacks, ['a', 'b'], () => 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(['a', 'b']).toContain(r.value.id)
  })

  it('ไม่มี pack เลย ตอบ NO_PACK_AVAILABLE', () => {
    const r = pickPack([], [], () => 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NO_PACK_AVAILABLE')
  })
})

describe('dealWords', () => {
  it('ทุกคนได้คำคนละคำ ไม่ซ้ำกัน', () => {
    const ids = ['p1', 'p2', 'p3']
    const m = dealWords(fakePacks[0], ids)
    expect(m.size).toBe(3)
    expect(new Set(m.values()).size).toBe(3)
  })

  it('คำที่แจกมาจาก pack นั้นเท่านั้น', () => {
    const m = dealWords(fakePacks[0], ['p1', 'p2'])
    for (const w of m.values()) {
      expect(fakePacks[0].words).toContain(w)
    }
  })

  it('ทุก playerId ได้รับคำครบ', () => {
    const ids = ['x', 'y', 'z']
    const m = dealWords(fakePacks[0], ids)
    for (const id of ids) expect(m.get(id)).toBeTruthy()
  })

  it('โยน error ถ้าคำใน pack ไม่พอกับจำนวนคน', () => {
    expect(() => dealWords(fakePacks[0], ['p1', 'p2', 'p3', 'p4'])).toThrow()
  })
})
```

- [ ] **Step 3: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/packs.test.ts`
Expected: FAIL — หาโมดูล `./packs` ไม่เจอ

- [ ] **Step 4: เขียน implementation**

`server/core/packs.ts`:
```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MAX_PLAYERS } from '../../constants'
import { fail, ok, type Pack, type Result } from './types'

let cache: Pack[] | null = null

/**
 * อ่าน data/packs.json ครั้งเดียวแล้วจำไว้
 * ตรวจความถูกต้องตอนโหลด — pack ที่คำไม่พอทำให้เกมพังกลางคัน จึงต้องรู้ตั้งแต่ต้น
 */
export function loadPacks(): Pack[] {
  if (cache) return cache

  const path = fileURLToPath(new URL('../../data/packs.json', import.meta.url))
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { packs: Pack[] }

  for (const p of parsed.packs) {
    if (p.words.length < MAX_PLAYERS) {
      throw new Error(`pack "${p.id}" มี ${p.words.length} คำ ต้องมีอย่างน้อย ${MAX_PLAYERS}`)
    }
    if (new Set(p.words).size !== p.words.length) {
      throw new Error(`pack "${p.id}" มีคำซ้ำกันภายใน`)
    }
  }

  cache = parsed.packs
  return cache
}

export function pickPack(
  packs: Pack[],
  usedPackIds: string[],
  rng: () => number = Math.random,
): Result<Pack> {
  if (packs.length === 0) {
    return fail('NO_PACK_AVAILABLE', 'ไม่มีชุดคำให้เล่น')
  }

  const unused = packs.filter((p) => !usedPackIds.includes(p.id))
  // ใช้ครบทุก pack แล้ววนกลับมาใช้ซ้ำได้ — เกมยาวกว่าจำนวน pack ไม่ควรพัง
  const pool = unused.length > 0 ? unused : packs

  return ok(pool[Math.floor(rng() * pool.length)])
}

export function dealWords(
  pack: Pack,
  playerIds: string[],
  rng: () => number = Math.random,
): Map<string, string> {
  if (pack.words.length < playerIds.length) {
    throw new Error(`pack "${pack.id}" มีคำไม่พอสำหรับ ${playerIds.length} คน`)
  }

  const shuffled = shuffle(pack.words, rng)
  return new Map(playerIds.map((id, i) => [id, shuffled[i]]))
}

/** Fisher-Yates */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
```

- [ ] **Step 5: รันเทสให้เขียว**

Run: `npx vitest run server/core/packs.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add data/packs.json server/core/packs.ts server/core/packs.test.ts
git commit -m "feat: add word packs with pick and deal logic"
```

---

## Task 5: normalize คำไทยและการให้คะแนน

**Files:**
- Create: `server/core/scoring.ts`
- Test: `server/core/scoring.test.ts`

**Interfaces:**
- Consumes: `types.ts` — `Room`
- Produces:
  - `normalizeThai(s: string): string`
  - `isCorrectGuess(guess: string, answer: string): boolean`
  - `addScore(room: Room, playerId: string, delta: number): void`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

`server/core/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeThai, isCorrectGuess, addScore } from './scoring'
import type { Room } from './types'

describe('normalizeThai', () => {
  it('ตัดช่องว่างหัวท้ายและช่องว่างกลางคำ', () => {
    expect(normalizeThai('  ลูกชิ้น ปิ้ง  ')).toBe(normalizeThai('ลูกชิ้นปิ้ง'))
  })

  it('ตัดวรรณยุกต์ออก', () => {
    expect(normalizeThai('ก๋วยเตี๋ยว')).toBe('กวยเตียว')
    expect(normalizeThai('ส้มตำ')).toBe('สมตำ')
  })

  it('ไม่ตัดสระ — สระผิดถือว่าผิด', () => {
    expect(normalizeThai('พริก')).not.toBe(normalizeThai('พรก'))
  })

  it('ตัดการันต์ออก', () => {
    expect(normalizeThai('รีโมท')).toBe('รีโมท')
    expect(normalizeThai('สัตว์')).toBe('สัตว')
  })

  it('ตัวอักษรอังกฤษกลายเป็นตัวเล็ก', () => {
    expect(normalizeThai('OverTime')).toBe('overtime')
  })
})

describe('isCorrectGuess', () => {
  it('ตรงเป๊ะ ถือว่าถูก', () => {
    expect(isCorrectGuess('ปาท่องโก๋', 'ปาท่องโก๋')).toBe(true)
  })

  it('วรรณยุกต์ผิด ยังถือว่าถูก', () => {
    expect(isCorrectGuess('ปาทองโก', 'ปาท่องโก๋')).toBe(true)
  })

  it('มีช่องว่างเกิน ยังถือว่าถูก', () => {
    expect(isCorrectGuess(' ลูกชิ้น ปิ้ง ', 'ลูกชิ้นปิ้ง')).toBe(true)
  })

  it('ตัวสะกดผิด ถือว่าผิด', () => {
    expect(isCorrectGuess('ปาท่องโก๊ะ', 'ปาท่องโก๋')).toBe(false)
  })

  it('คำอื่นไปเลย ถือว่าผิด', () => {
    expect(isCorrectGuess('ส้มตำ', 'ปาท่องโก๋')).toBe(false)
  })

  it('คำว่างเปล่า ถือว่าผิด', () => {
    expect(isCorrectGuess('', 'ปาท่องโก๋')).toBe(false)
    expect(isCorrectGuess('   ', 'ปาท่องโก๋')).toBe(false)
  })
})

function roomWith(scores: Record<string, number>): Room {
  return {
    code: 'ABC234',
    hostId: 'p1',
    phase: 'PLAYING',
    totalRounds: 3,
    currentRound: 1,
    players: new Map(
      Object.entries(scores).map(([id, score]) => [
        id,
        { id, name: id, connected: true, ready: true, score, joinedAt: 0 },
      ]),
    ),
    round: null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  }
}

describe('addScore', () => {
  it('บวกคะแนนให้ผู้เล่น', () => {
    const room = roomWith({ p1: 2 })
    addScore(room, 'p1', 1)
    expect(room.players.get('p1')!.score).toBe(3)
  })

  it('ลบคะแนนได้ (ใช้ตอน undo)', () => {
    const room = roomWith({ p1: 2 })
    addScore(room, 'p1', -1)
    expect(room.players.get('p1')!.score).toBe(1)
  })

  it('คะแนนไม่ต่ำกว่าศูนย์', () => {
    const room = roomWith({ p1: 0 })
    addScore(room, 'p1', -1)
    expect(room.players.get('p1')!.score).toBe(0)
  })

  it('ผู้เล่นที่ไม่มีอยู่ ไม่ทำให้พัง', () => {
    const room = roomWith({ p1: 2 })
    expect(() => addScore(room, 'ghost', 1)).not.toThrow()
  })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/scoring.test.ts`
Expected: FAIL — หาโมดูล `./scoring` ไม่เจอ

- [ ] **Step 3: เขียน implementation**

`server/core/scoring.ts`:
```ts
import type { Room } from './types'

/** วรรณยุกต์ ไม้ไต่คู้ การันต์ (U+0E47–U+0E4E) — ไม่รวมสระ */
const THAI_TONE_MARKS = /[็-๎]/g

/**
 * ปรับคำให้เทียบกันได้ — ยอมให้พิมพ์วรรณยุกต์ผิดหรือเว้นวรรคเกิน
 * แต่ตัวสะกดกับสระต้องถูก เพราะคนที่รู้คำตัวเองอยู่แล้วควรพิมพ์ได้ถูก
 */
export function normalizeThai(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(THAI_TONE_MARKS, '')
    .normalize('NFC')
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  const g = normalizeThai(guess)
  if (g.length === 0) return false
  return g === normalizeThai(answer)
}

/** ปรับคะแนนสะสม ไม่ให้ติดลบ (undo ที่คืนเกินจริงไม่ควรทำให้คะแนนเพี้ยน) */
export function addScore(room: Room, playerId: string, delta: number): void {
  const p = room.players.get(playerId)
  if (!p) return
  p.score = Math.max(0, p.score + delta)
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run server/core/scoring.test.ts`
Expected: PASS ทั้งหมด

หมายเหตุ: เทส `normalizeThai('รีโมท')` คาดว่าได้ `'รีโมท'` เพราะคำนี้ไม่มีวรรณยุกต์อยู่แล้ว — เป็นการยืนยันว่าฟังก์ชันไม่ไปตัดอะไรเกินจำเป็น

- [ ] **Step 5: Commit**

```bash
git add server/core/scoring.ts server/core/scoring.test.ts
git commit -m "feat: add Thai word normalization and scoring"
```

---

## Task 6: maskFor — invariant หลักของเกม

**Files:**
- Create: `server/core/mask.ts`
- Test: `server/core/mask.test.ts`

**Interfaces:**
- Consumes: `types.ts` — `Room`, `MaskedRoomState`, `MaskedPlayer`
- Produces: `maskFor(room: Room, viewerId: string): MaskedRoomState`

นี่คือ task ที่สำคัญที่สุดของโปรเจกต์ ถ้าฟังก์ชันนี้ผิด เกมพังทั้งเกม — ผู้เล่นเห็นคำตัวเองก็ไม่มีอะไรให้เล่น

**กฎการเปิดคำ:**

| สถานการณ์ | ผู้ชมเห็นคำของตัวเอง | เห็นคำคนอื่น |
|---|---|---|
| `LOBBY` / `COUNTDOWN` | ไม่มีคำ (ยังไม่แจก) | ไม่มีคำ |
| `PLAYING` ยังไม่ตาย | **ไม่เห็น (null)** | เห็น |
| `PLAYING` ตายแล้ว | เห็น | เห็น |
| `ROUND_END` / `GAME_END` | เห็น | เห็น |

- [ ] **Step 1: เขียนเทสที่ยังแดง**

`server/core/mask.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { maskFor } from './mask'
import type { Phase, Room } from './types'

const IDS = ['p1', 'p2', 'p3', 'p4']
const WORDS: Record<string, string> = {
  p1: 'ลูกชิ้นปิ้ง',
  p2: 'ปาท่องโก๋',
  p3: 'ส้มตำ',
  p4: 'น้ำแข็งไส',
}

function makeRoom(opts: {
  phase: Phase
  dead?: string[]
  guessed?: string[]
  burned?: string[]
}): Room {
  const dead = new Set(opts.dead ?? [])
  const hasRound = opts.phase !== 'LOBBY' && opts.phase !== 'COUNTDOWN'

  return {
    code: 'ABC234',
    hostId: 'p1',
    phase: opts.phase,
    totalRounds: 3,
    currentRound: 1,
    players: new Map(
      IDS.map((id) => [
        id,
        { id, name: id.toUpperCase(), connected: true, ready: true, score: 0, joinedAt: 0 },
      ]),
    ),
    round: hasRound
      ? {
          packId: 'street-food',
          packTheme: 'ของกินริมทาง',
          gmId: 'p2',
          assignments: new Map(Object.entries(WORDS)),
          alive: new Set(IDS.filter((id) => !dead.has(id))),
          wordBurned: new Set([...dead, ...(opts.burned ?? [])]),
          deaths: [...dead].map((id) => ({ victimId: id, killerId: 'p1', at: 0 })),
          guesses: new Map(
            (opts.guessed ?? []).map((id) => [id, { text: WORDS[id], correct: true }]),
          ),
          startedAt: 0,
          endsAt: 999_999,
          endReason: opts.phase === 'ROUND_END' ? 'TIME' : null,
        }
      : null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: 0,
    lastActivityAt: 0,
  }
}

const wordOf = (room: Room, viewerId: string, targetId: string) =>
  maskFor(room, viewerId).players.find((p) => p.id === targetId)!.word

describe('maskFor — ไม่มีใครเห็นคำตัวเองระหว่างเล่น', () => {
  it('ทุกคนที่ยังไม่ตาย เห็นคำตัวเองเป็น null ตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const id of IDS) {
      expect(wordOf(room, id, id), `${id} ไม่ควรเห็นคำตัวเอง`).toBeNull()
    }
  })

  it('ทุกคนเห็นคำของคนอื่นครบตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const viewer of IDS) {
      for (const target of IDS) {
        if (viewer === target) continue
        expect(wordOf(room, viewer, target)).toBe(WORDS[target])
      }
    }
  })

  it('GM ก็ไม่เห็นคำตัวเอง', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    expect(wordOf(room, 'p2', 'p2')).toBeNull()
  })

  it('คนตายแล้วเห็นคำตัวเองได้', () => {
    const room = makeRoom({ phase: 'PLAYING', dead: ['p3'] })
    expect(wordOf(room, 'p3', 'p3')).toBe(WORDS.p3)
  })

  it('คนตายแล้วไม่ทำให้คนอื่นเห็นคำตัวเอง', () => {
    const room = makeRoom({ phase: 'PLAYING', dead: ['p3'] })
    expect(wordOf(room, 'p1', 'p1')).toBeNull()
  })
})

describe('maskFor — เปิดคำเมื่อจบรอบ', () => {
  it('ROUND_END เปิดคำทุกคนให้ทุกคน', () => {
    const room = makeRoom({ phase: 'ROUND_END' })
    for (const viewer of IDS) {
      for (const target of IDS) {
        expect(wordOf(room, viewer, target)).toBe(WORDS[target])
      }
    }
  })

  it('GAME_END เปิดคำทุกคน', () => {
    const room = makeRoom({ phase: 'GAME_END' })
    expect(wordOf(room, 'p1', 'p1')).toBe(WORDS.p1)
  })
})

describe('maskFor — ก่อนแจกคำ', () => {
  it('LOBBY ทุกคนไม่มีคำ', () => {
    const room = makeRoom({ phase: 'LOBBY' })
    for (const id of IDS) expect(wordOf(room, id, id)).toBeNull()
  })

  it('COUNTDOWN ทุกคนไม่มีคำ', () => {
    const room = makeRoom({ phase: 'COUNTDOWN' })
    for (const id of IDS) expect(wordOf(room, id, id)).toBeNull()
  })
})

describe('maskFor — คำต้องไม่หลุดใน payload ทั้งก้อน', () => {
  it('คำของผู้ชมไม่ปรากฏใน JSON ที่ส่งออกเลย ตอน PLAYING', () => {
    const room = makeRoom({ phase: 'PLAYING' })
    for (const id of IDS) {
      const json = JSON.stringify(maskFor(room, id))
      expect(json, `คำของ ${id} หลุดไปใน payload`).not.toContain(WORDS[id])
    }
  })
})

describe('maskFor — ธงสถานะ', () => {
  it('บอกว่าใครเป็น host และใครเป็น GM', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    expect(s.players.find((p) => p.id === 'p1')!.isHost).toBe(true)
    expect(s.players.find((p) => p.id === 'p2')!.isGm).toBe(true)
    expect(s.players.find((p) => p.id === 'p3')!.isGm).toBe(false)
  })

  it('บอกว่าใครยังไม่ตาย', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING', dead: ['p3'] }), 'p1')
    expect(s.players.find((p) => p.id === 'p3')!.isAlive).toBe(false)
    expect(s.players.find((p) => p.id === 'p1')!.isAlive).toBe(true)
  })

  it('canGuess เป็นจริงเฉพาะคนรอดที่ยังไม่ทาย ตอน ROUND_END', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', dead: ['p3'], guessed: ['p1'] }), 'p1')
    const by = (id: string) => s.players.find((p) => p.id === id)!
    expect(by('p1').canGuess).toBe(false) // ทายไปแล้ว
    expect(by('p2').canGuess).toBe(true)  // รอด ยังไม่ทาย
    expect(by('p3').canGuess).toBe(false) // ตายแล้ว
  })

  it('guessCorrect บอกผลการทาย และเป็น null เมื่อยังไม่ทาย', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', guessed: ['p1'] }), 'p1')
    expect(s.players.find((p) => p.id === 'p1')!.guessCorrect).toBe(true)
    expect(s.players.find((p) => p.id === 'p2')!.guessCorrect).toBeNull()
  })

  it('คนที่ติด wordBurned ทายไม่ได้แม้จะยังรอด', () => {
    const s = maskFor(makeRoom({ phase: 'ROUND_END', burned: ['p4'] }), 'p4')
    expect(s.players.find((p) => p.id === 'p4')!.canGuess).toBe(false)
  })

  it('canGuess เป็นเท็จทุกคนตอน PLAYING', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    for (const p of s.players) expect(p.canGuess).toBe(false)
  })

  it('เรียงผู้เล่นตามลำดับการเข้าห้อง', () => {
    const s = maskFor(makeRoom({ phase: 'PLAYING' }), 'p1')
    expect(s.players.map((p) => p.id)).toEqual(IDS)
  })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/mask.test.ts`
Expected: FAIL — หาโมดูล `./mask` ไม่เจอ

- [ ] **Step 3: เขียน implementation**

`server/core/mask.ts`:
```ts
import type { MaskedPlayer, MaskedRoomState, Room } from './types'

/**
 * ทางออกเดียวของ state ไปสู่ client
 * ห้าม emit `Room` ดิบไม่ว่ากรณีใด — คำของผู้เล่นจะหลุด
 */
export function maskFor(room: Room, viewerId: string): MaskedRoomState {
  const round = room.round
  const roundEnded = room.phase === 'ROUND_END' || room.phase === 'GAME_END'

  const players: MaskedPlayer[] = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => {
      const isAlive = round ? round.alive.has(p.id) : true
      const guess = round?.guesses.get(p.id) ?? null
      const hasGuessed = guess !== null
      const burned = round ? round.wordBurned.has(p.id) : false

      return {
        id: p.id,
        name: p.name,
        connected: p.connected,
        ready: p.ready,
        score: p.score,
        isHost: p.id === room.hostId,
        isGm: round ? p.id === round.gmId : false,
        isAlive,
        word: visibleWord(room, viewerId, p.id),
        hasGuessed,
        guessCorrect: guess?.correct ?? null,
        canGuess: room.phase === 'ROUND_END' && isAlive && !burned && !hasGuessed,
      }
    })

  return {
    code: room.code,
    phase: room.phase,
    viewerId,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    players,
    packTheme: roundEnded || room.phase === 'PLAYING' ? (round?.packTheme ?? null) : null,
    endsAt: room.phase === 'PLAYING' ? (round?.endsAt ?? null) : null,
    countdownEndsAt: room.countdownEndsAt,
    deaths: round?.deaths ?? [],
    endReason: round?.endReason ?? null,
    roundHistory: room.roundHistory,
  }
}

/** คืน null เมื่อผู้ชมยังไม่ควรเห็นคำนี้ — ไม่ใช่คืนคำแล้วให้ UI ซ่อน */
function visibleWord(room: Room, viewerId: string, targetId: string): string | null {
  const round = room.round
  if (!round) return null

  const word = round.assignments.get(targetId) ?? null
  if (word === null) return null

  // จบรอบแล้ว เปิดหมด
  if (room.phase === 'ROUND_END' || room.phase === 'GAME_END') return word

  // คำของคนอื่น เห็นได้เสมอระหว่างเล่น
  if (targetId !== viewerId) return word

  // คำของตัวเอง เห็นได้ต่อเมื่อตายไปแล้ว
  return round.alive.has(viewerId) ? null : word
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run server/core/mask.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add server/core/mask.ts server/core/mask.test.ts
git commit -m "feat: add maskFor to hide each player's own word"
```

---

## Task 7: game.ts — สร้างห้อง เข้าห้อง พร้อม เริ่มเกม

**Files:**
- Create: `server/core/game.ts`
- Test: `server/core/game.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `timing.ts` — `roundDurationMs`, `packs.ts` — `pickPack`, `dealWords`, `loadPacks`; `constants.ts`
- Produces:
  - `createRoom(code: string, hostName: string, totalRounds: number, hostId: string, now: number): Room`
  - `joinRoom(room: Room, name: string, playerId: string, now: number): Result<Player>`
  - `setReady(room: Room, playerId: string, ready: boolean): Result`
  - `startCountdown(room: Room, playerId: string, now: number): Result`
  - `beginRound(room: Room, now: number, rng?: () => number): Result`

Task 7 กับ 8 แยกกันเพราะเป็นครึ่งคนละครึ่งของ state machine — 7 คือ "ก่อนเล่น" 8 คือ "ระหว่างเล่นจนจบเกม" ทั้งคู่เขียนลงไฟล์ `game.ts` เดียวกัน แต่รีวิวและเทสแยกได้

**หมายเหตุเรื่อง `beginRound`:** ถูกเรียกจาก 3 ที่ — จบ countdown, กด "รอบต่อไป", และ "เล่นอีกรอบ" จึงแยกออกมาเป็นฟังก์ชันเดี่ยว ไม่ผูกกับ `startCountdown`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

`server/core/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createRoom, joinRoom, setReady, startCountdown, beginRound } from './game'
import { MAX_PLAYERS } from '../../constants'
import type { Room } from './types'

const NOW = 1_000_000

function roomWithPlayers(n: number, ready = true): Room {
  const room = createRoom('ABC234', 'P1', 3, 'p1', NOW)
  for (let i = 2; i <= n; i++) {
    joinRoom(room, `P${i}`, `p${i}`, NOW)
  }
  if (ready) {
    for (const id of room.players.keys()) setReady(room, id, true)
  }
  return room
}

describe('createRoom', () => {
  it('host เข้าห้องทันทีและเป็นเจ้าของห้อง', () => {
    const room = createRoom('ABC234', 'สมชาย', 5, 'p1', NOW)
    expect(room.hostId).toBe('p1')
    expect(room.players.size).toBe(1)
    expect(room.players.get('p1')!.name).toBe('สมชาย')
  })

  it('เริ่มที่ phase LOBBY รอบที่ 0', () => {
    const room = createRoom('ABC234', 'สมชาย', 5, 'p1', NOW)
    expect(room.phase).toBe('LOBBY')
    expect(room.currentRound).toBe(0)
    expect(room.round).toBeNull()
  })
})

describe('joinRoom', () => {
  it('คนใหม่เข้าห้องได้', () => {
    const room = roomWithPlayers(1)
    const r = joinRoom(room, 'มานี', 'p2', NOW)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
  })

  it('เข้าด้วย playerId เดิม คืนสถานะเดิม ไม่สร้างคนใหม่', () => {
    const room = roomWithPlayers(2)
    room.players.get('p2')!.score = 7
    room.players.get('p2')!.connected = false

    const r = joinRoom(room, 'ชื่ออื่น', 'p2', NOW + 100)
    expect(r.ok).toBe(true)
    expect(room.players.size).toBe(2)
    expect(room.players.get('p2')!.score).toBe(7)
    expect(room.players.get('p2')!.connected).toBe(true)
  })

  it('ห้องเต็มแล้วเข้าไม่ได้', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    const r = joinRoom(room, 'เกินมา', 'extra', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ROOM_FULL')
  })

  it('คนเดิมกลับเข้าห้องที่เต็มได้ (reconnect ไม่ถูกกันด้วยเพดาน)', () => {
    const room = roomWithPlayers(MAX_PLAYERS)
    room.players.get('p2')!.connected = false
    const r = joinRoom(room, 'P2', 'p2', NOW)
    expect(r.ok).toBe(true)
  })

  it('เข้าห้องระหว่างเกมกำลังเล่นไม่ได้', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    const r = joinRoom(room, 'สาย', 'late', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('setReady', () => {
  it('เปลี่ยนสถานะพร้อมได้', () => {
    const room = roomWithPlayers(3, false)
    setReady(room, 'p2', true)
    expect(room.players.get('p2')!.ready).toBe(true)
    setReady(room, 'p2', false)
    expect(room.players.get('p2')!.ready).toBe(false)
  })

  it('กดพร้อมได้เฉพาะตอน LOBBY', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    const r = setReady(room, 'p2', false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('startCountdown', () => {
  it('host เริ่มได้เมื่อคนครบและพร้อมหมด', () => {
    const room = roomWithPlayers(3)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('COUNTDOWN')
    expect(room.countdownEndsAt).toBe(NOW + 3_000)
  })

  it('คนที่ไม่ใช่ host เริ่มไม่ได้', () => {
    const room = roomWithPlayers(3)
    const r = startCountdown(room, 'p2', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('คนไม่ถึงขั้นต่ำ เริ่มไม่ได้', () => {
    const room = roomWithPlayers(2)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_ENOUGH_PLAYERS')
  })

  it('ยังพร้อมไม่ครบ เริ่มไม่ได้', () => {
    const room = roomWithPlayers(4)
    setReady(room, 'p3', false)
    const r = startCountdown(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_ALL_READY')
  })
})

describe('beginRound', () => {
  it('แจกคำให้ทุกคน คนละคำไม่ซ้ำ', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)

    const a = room.round!.assignments
    expect(a.size).toBe(4)
    expect(new Set(a.values()).size).toBe(4)
  })

  it('เข้า phase PLAYING และนับรอบขึ้น', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.phase).toBe('PLAYING')
    expect(room.currentRound).toBe(1)
  })

  it('ตั้งเวลาจบรอบตามจำนวนคน', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.round!.endsAt).toBe(NOW + 5 * 60_000)
  })

  it('ทุกคนเริ่มต้นด้วยสถานะยังไม่ตาย', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.round!.alive.size).toBe(4)
    expect(room.round!.wordBurned.size).toBe(0)
  })

  it('สุ่ม GM จากผู้เล่นในห้อง', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect([...room.players.keys()]).toContain(room.round!.gmId)
  })

  it('เลี่ยงสุ่ม GM ซ้ำคนเดิมจากรอบที่แล้ว', () => {
    const room = roomWithPlayers(4)
    room.lastGmId = 'p1'
    startCountdown(room, 'p1', NOW)
    // rng คืน 0 เสมอ = หยิบตัวแรกของ pool เสมอ
    // ถ้าไม่กรอง p1 ออก จะได้ p1 กลับมา
    beginRound(room, NOW, () => 0)
    expect(room.round!.gmId).not.toBe('p1')
  })

  it('บันทึก pack ที่ใช้ไปแล้ว', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    expect(room.usedPackIds).toContain(room.round!.packId)
  })

  it('รีเซ็ต ready ของทุกคนเมื่อรอบเริ่ม', () => {
    const room = roomWithPlayers(4)
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    for (const p of room.players.values()) expect(p.ready).toBe(false)
  })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/game.test.ts`
Expected: FAIL — หาโมดูล `./game` ไม่เจอ

- [ ] **Step 3: เขียนครึ่งแรกของ `server/core/game.ts`**

```ts
import { COUNTDOWN_MS, MAX_PLAYERS, MIN_PLAYERS } from '../../constants'
import { dealWords, loadPacks, pickPack } from './packs'
import { roundDurationMs } from './timing'
import { fail, ok, type Player, type Result, type Room } from './types'

export function createRoom(
  code: string,
  hostName: string,
  totalRounds: number,
  hostId: string,
  now: number,
): Room {
  return {
    code,
    hostId,
    phase: 'LOBBY',
    totalRounds,
    currentRound: 0,
    players: new Map([[hostId, newPlayer(hostId, hostName, now)]]),
    round: null,
    usedPackIds: [],
    lastGmId: null,
    roundHistory: [],
    countdownEndsAt: null,
    createdAt: now,
    lastActivityAt: now,
  }
}

/**
 * ใช้ทั้งตอนเข้าครั้งแรกและตอน reconnect
 * คนเดิมที่กลับมาต้องได้คะแนน คำ และบทบาทเดิมคืนครบ
 */
export function joinRoom(
  room: Room,
  name: string,
  playerId: string,
  now: number,
): Result<Player> {
  room.lastActivityAt = now

  const existing = room.players.get(playerId)
  if (existing) {
    existing.connected = true
    return ok(existing)
  }

  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เกมเริ่มไปแล้ว เข้าร่วมไม่ได้')
  }
  if (room.players.size >= MAX_PLAYERS) {
    return fail('ROOM_FULL', `ห้องเต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`)
  }

  const player = newPlayer(playerId, name, now)
  room.players.set(playerId, player)
  return ok(player)
}

export function setReady(room: Room, playerId: string, ready: boolean): Result {
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'กดพร้อมได้เฉพาะตอนรออยู่ในห้อง')
  }
  const p = room.players.get(playerId)
  if (!p) return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้')

  p.ready = ready
  return ok(undefined)
}

export function startCountdown(room: Room, playerId: string, now: number): Result {
  if (playerId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้')
  }
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เกมเริ่มไปแล้ว')
  }
  if (room.players.size < MIN_PLAYERS) {
    return fail('NOT_ENOUGH_PLAYERS', `ต้องมีอย่างน้อย ${MIN_PLAYERS} คน`)
  }
  if (![...room.players.values()].every((p) => p.ready)) {
    return fail('NOT_ALL_READY', 'ยังมีคนกดพร้อมไม่ครบ')
  }

  room.phase = 'COUNTDOWN'
  room.countdownEndsAt = now + COUNTDOWN_MS
  room.lastActivityAt = now
  return ok(undefined)
}

/**
 * เริ่มรอบใหม่ — สุ่ม pack สุ่ม GM แจกคำ ตั้งนาฬิกา
 * เรียกได้จาก 3 ที่: จบ countdown, กดรอบต่อไป, เล่นอีกรอบ
 */
export function beginRound(
  room: Room,
  now: number,
  rng: () => number = Math.random,
): Result {
  const packResult = pickPack(loadPacks(), room.usedPackIds, rng)
  if (!packResult.ok) return packResult

  const pack = packResult.value
  const playerIds = [...room.players.keys()]

  room.phase = 'PLAYING'
  room.currentRound += 1
  room.countdownEndsAt = null
  room.usedPackIds.push(pack.id)
  room.lastActivityAt = now

  for (const p of room.players.values()) p.ready = false

  room.round = {
    packId: pack.id,
    packTheme: pack.theme,
    gmId: pickGm(playerIds, room.lastGmId, rng),
    assignments: dealWords(pack, playerIds, rng),
    alive: new Set(playerIds),
    wordBurned: new Set(),
    deaths: [],
    guesses: new Map(),
    startedAt: now,
    endsAt: now + roundDurationMs(playerIds.length),
    endReason: null,
  }

  return ok(undefined)
}

function newPlayer(id: string, name: string, now: number): Player {
  return { id, name, connected: true, ready: false, score: 0, joinedAt: now }
}

/** เลี่ยงคนที่เพิ่งเป็น GM ถ้ายังมีคนอื่นให้เลือก */
function pickGm(playerIds: string[], lastGmId: string | null, rng: () => number): string {
  const pool = playerIds.filter((id) => id !== lastGmId)
  const from = pool.length > 0 ? pool : playerIds
  return from[Math.floor(rng() * from.length)]
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run server/core/game.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add server/core/game.ts server/core/game.test.ts
git commit -m "feat: add room lifecycle up to round start"
```

---

## Task 8: game.ts — ตาย undo จบรอบ ทายคำ รอบต่อไป

**Files:**
- Modify: `server/core/game.ts` (เพิ่มฟังก์ชันต่อท้าย)
- Modify: `server/core/game.test.ts` (เพิ่ม describe block ต่อท้าย)

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 7 + `scoring.ts` — `addScore`, `isCorrectGuess`
- Produces:
  - `recordKill(room: Room, gmId: string, victimId: string, killerId: string, now: number): Result<string>` — คืนคำที่เปิดของ victim
  - `undoKill(room: Room, gmId: string, deathIndex: number): Result`
  - `endRound(room: Room, reason: EndReason, now: number): Result`
  - `submitGuess(room: Room, playerId: string, text: string): Result<boolean>` — คืนว่าถูกหรือไม่
  - `nextRound(room: Room, hostId: string, now: number, rng?: () => number): Result`
  - `restartGame(room: Room, hostId: string, now: number): Result`

- [ ] **Step 1: เขียนเทสเพิ่มต่อท้าย `game.test.ts`**

เพิ่ม import ที่หัวไฟล์:
```ts
import {
  recordKill, undoKill, endRound, endRoundByGm, kickPlayer,
  submitGuess, nextRound, restartGame,
} from './game'
```

เพิ่ม helper และ describe ต่อท้ายไฟล์:
```ts
/** ห้องที่กำลังเล่นอยู่ พร้อมรู้ว่าใครเป็น GM */
function playingRoom(n = 4): { room: Room; gmId: string; others: string[] } {
  const room = roomWithPlayers(n)
  startCountdown(room, 'p1', NOW)
  beginRound(room, NOW, () => 0)
  const gmId = room.round!.gmId
  const others = [...room.players.keys()].filter((id) => id !== gmId)
  return { room, gmId, others }
}

describe('recordKill', () => {
  it('GM บันทึกคนตาย คนหลอกได้ 1 คะแนน', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    const r = recordKill(room, gmId, victim, killer, NOW)

    expect(r.ok).toBe(true)
    expect(room.players.get(killer)!.score).toBe(1)
    expect(room.players.get(victim)!.score).toBe(0)
  })

  it('คนตายออกจากรายชื่อคนรอด และติด wordBurned', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)

    expect(room.round!.alive.has(victim)).toBe(false)
    expect(room.round!.wordBurned.has(victim)).toBe(true)
  })

  it('คืนคำของคนตายเพื่อเปิดให้ดู', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    const r = recordKill(room, gmId, victim, killer, NOW)
    if (r.ok) expect(r.value).toBe(room.round!.assignments.get(victim))
  })

  it('คนที่ไม่ใช่ GM บันทึกไม่ได้', () => {
    const { room, others } = playingRoom()
    const r = recordKill(room, others[0], others[1], others[2], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('คนตายกับคนหลอกเป็นคนเดียวกันไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, others[0], others[0], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })

  it('ฆ่าคนที่ตายไปแล้วไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    const r = recordKill(room, gmId, victim, killer, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ALREADY_DEAD')
  })

  it('ฆ่าคนที่ไม่มีในห้องไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, 'ghost', others[0], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('PLAYER_NOT_FOUND')
  })

  it('GM ตายเองได้ ถ้าคนหลอกเป็นคนอื่น', () => {
    const { room, gmId, others } = playingRoom()
    const r = recordKill(room, gmId, gmId, others[0], NOW)
    expect(r.ok).toBe(true)
    expect(room.round!.alive.has(gmId)).toBe(false)
  })

  it('บันทึกไม่ได้ถ้าไม่ได้อยู่ใน phase PLAYING', () => {
    const { room, gmId, others } = playingRoom()
    endRound(room, 'GM', NOW)
    const r = recordKill(room, gmId, others[0], others[1], NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })

  it('เหลือคนรอดคนเดียว รอบจบเองด้วยเหตุผล LAST_MAN', () => {
    const { room, gmId, others } = playingRoom(4)
    const alive = [...room.round!.alive]
    // ฆ่าไป 3 คน เหลือ 1
    recordKill(room, gmId, alive[0], alive[3], NOW)
    recordKill(room, gmId, alive[1], alive[3], NOW)
    recordKill(room, gmId, alive[2], alive[3], NOW)

    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('LAST_MAN')
  })
})

describe('undoKill', () => {
  it('คืนสถานะรอดและหักคะแนนคนหลอกกลับ', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)

    const r = undoKill(room, gmId, 0)
    expect(r.ok).toBe(true)
    expect(room.round!.alive.has(victim)).toBe(true)
    expect(room.players.get(killer)!.score).toBe(0)
    expect(room.round!.deaths).toHaveLength(0)
  })

  it('victim ยังติด wordBurned หลัง undo เพราะเห็นคำไปแล้ว', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    undoKill(room, gmId, 0)

    expect(room.round!.wordBurned.has(victim)).toBe(true)
  })

  it('คนที่ไม่ใช่ GM undo ไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    const r = undoKill(room, others[0], 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('undo index ที่ไม่มีอยู่ ตอบ INVALID_TARGET', () => {
    const { room, gmId } = playingRoom()
    const r = undoKill(room, gmId, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })
})

describe('endRound', () => {
  it('เปลี่ยนเป็น ROUND_END พร้อมเหตุผล', () => {
    const { room } = playingRoom()
    endRound(room, 'TIME', NOW)
    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('TIME')
  })

  it('บันทึกรอบลงประวัติ', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRound(room, 'TIME', NOW)

    expect(room.roundHistory).toHaveLength(1)
    expect(room.roundHistory[0].round).toBe(1)
    expect(room.roundHistory[0].deaths).toHaveLength(1)
  })

  it('จำ GM ของรอบนี้ไว้เลี่ยงสุ่มซ้ำ', () => {
    const { room, gmId } = playingRoom()
    endRound(room, 'TIME', NOW)
    expect(room.lastGmId).toBe(gmId)
  })

  it('จบรอบซ้ำไม่มีผล', () => {
    const { room } = playingRoom()
    endRound(room, 'TIME', NOW)
    const r = endRound(room, 'GM', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
    expect(room.roundHistory).toHaveLength(1)
  })
})

describe('submitGuess', () => {
  it('ทายถูกได้ 1 คะแนน', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const word = room.round!.assignments.get(p)!
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, word)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(true)
    expect(room.players.get(p)!.score).toBe(1)
  })

  it('ทายผิดไม่ได้คะแนน', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, 'คำที่ไม่มีทางถูก')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(false)
    expect(room.players.get(p)!.score).toBe(0)
  })

  it('พิมพ์วรรณยุกต์ผิดยังถือว่าถูก', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const word = room.round!.assignments.get(p)!
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, p, word.replace(/[็-๎]/g, ''))
    if (r.ok) expect(r.value).toBe(true)
  })

  it('ทายซ้ำครั้งที่สองไม่ได้', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    endRound(room, 'TIME', NOW)
    submitGuess(room, p, 'ผิด')

    const r = submitGuess(room, p, room.round!.assignments.get(p)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ALREADY_GUESSED')
  })

  it('คนที่ตายไปแล้วทายไม่ได้', () => {
    const { room, gmId, others } = playingRoom()
    const [victim, killer] = others
    recordKill(room, gmId, victim, killer, NOW)
    endRound(room, 'TIME', NOW)

    const r = submitGuess(room, victim, room.round!.assignments.get(victim)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('CANNOT_GUESS')
  })

  it('ทายได้เฉพาะตอน ROUND_END', () => {
    const { room, others } = playingRoom()
    const p = others[0]
    const r = submitGuess(room, p, room.round!.assignments.get(p)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})

describe('nextRound', () => {
  it('host ไปรอบต่อไปได้ คะแนนสะสมไม่หาย', () => {
    const { room, gmId, others } = playingRoom()
    recordKill(room, gmId, others[0], others[1], NOW)
    endRound(room, 'TIME', NOW)

    const scoreBefore = room.players.get(others[1])!.score
    const r = nextRound(room, 'p1', NOW, () => 0)

    expect(r.ok).toBe(true)
    expect(room.phase).toBe('PLAYING')
    expect(room.currentRound).toBe(2)
    expect(room.players.get(others[1])!.score).toBe(scoreBefore)
  })

  it('คนที่ไม่ใช่ host ไปรอบต่อไปไม่ได้', () => {
    const { room, others } = playingRoom()
    endRound(room, 'TIME', NOW)
    const r = nextRound(room, others[0], NOW, () => 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('ครบจำนวนรอบแล้วเข้า GAME_END แทน', () => {
    const room = roomWithPlayers(4)
    room.totalRounds = 1
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    endRound(room, 'TIME', NOW)

    const r = nextRound(room, 'p1', NOW, () => 0)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('GAME_END')
  })
})

describe('restartGame', () => {
  it('คืนห้องกลับสู่ LOBBY และล้างคะแนน', () => {
    const room = roomWithPlayers(4)
    room.totalRounds = 1
    startCountdown(room, 'p1', NOW)
    beginRound(room, NOW, () => 0)
    endRound(room, 'TIME', NOW)
    nextRound(room, 'p1', NOW, () => 0)

    const r = restartGame(room, 'p1', NOW)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('LOBBY')
    expect(room.currentRound).toBe(0)
    expect(room.roundHistory).toHaveLength(0)
    expect(room.usedPackIds).toHaveLength(0)
    for (const p of room.players.values()) {
      expect(p.score).toBe(0)
      expect(p.ready).toBe(false)
    }
  })

  it('เล่นอีกรอบได้เฉพาะตอนจบเกม', () => {
    const { room } = playingRoom()
    const r = restartGame(room, 'p1', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run server/core/game.test.ts`
Expected: FAIL — `recordKill` ยังไม่ถูก export

- [ ] **Step 3: เขียนครึ่งหลังของ `game.ts` ต่อท้ายไฟล์เดิม**

เพิ่ม import ที่หัวไฟล์:
```ts
import { addScore, isCorrectGuess } from './scoring'
import type { EndReason, RoundSummary } from './types'
```

ต่อท้ายไฟล์:
```ts
/**
 * GM บันทึกว่าใครตายและใครเป็นคนหลอกสำเร็จ
 * คืนคำของคนตายเพื่อเปิดให้ทุกคนเห็น
 */
export function recordKill(
  room: Room,
  gmId: string,
  victimId: string,
  killerId: string,
  now: number,
): Result<string> {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'บันทึกได้เฉพาะตอนกำลังเล่น')
  }
  if (gmId !== round.gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }
  if (victimId === killerId) {
    return fail('INVALID_TARGET', 'คนตายกับคนหลอกต้องเป็นคนละคน')
  }
  if (!room.players.has(victimId) || !room.players.has(killerId)) {
    return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้ในห้อง')
  }
  if (!round.alive.has(victimId)) {
    return fail('ALREADY_DEAD', 'คนนี้ตายไปแล้ว')
  }

  round.alive.delete(victimId)
  round.wordBurned.add(victimId)
  round.deaths.push({ victimId, killerId, at: now })
  addScore(room, killerId, 1)
  room.lastActivityAt = now

  // เหลือคนรอดคนเดียว รอบจบทันที
  if (round.alive.size <= 1) {
    endRound(room, 'LAST_MAN', now)
  }

  return ok(round.assignments.get(victimId)!)
}

/**
 * ยกเลิกการบันทึกที่กดผิด
 * victim กลับมาเล่นต่อได้ แต่ยังติด wordBurned เพราะเห็นคำตัวเองไปแล้ว
 */
export function undoKill(room: Room, gmId: string, deathIndex: number): Result {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'ยกเลิกได้เฉพาะตอนกำลังเล่น')
  }
  if (gmId !== round.gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }

  const death = round.deaths[deathIndex]
  if (!death) return fail('INVALID_TARGET', 'ไม่พบรายการที่จะยกเลิก')

  round.deaths.splice(deathIndex, 1)
  round.alive.add(death.victimId)
  addScore(room, death.killerId, -1)
  // ไม่ลบออกจาก wordBurned โดยเจตนา — เห็นคำไปแล้วย้อนไม่ได้

  return ok(undefined)
}

export function endRound(room: Room, reason: EndReason, now: number): Result {
  const round = room.round
  if (room.phase !== 'PLAYING' || !round) {
    return fail('WRONG_PHASE', 'รอบนี้จบไปแล้ว')
  }

  round.endReason = reason
  room.phase = 'ROUND_END'
  room.lastGmId = round.gmId
  room.lastActivityAt = now
  room.roundHistory.push(summarize(room, round, reason))

  return ok(undefined)
}

/** ทายคำของตัวเองตอนจบรอบ ถูกได้ 1 คะแนน ส่งได้ครั้งเดียว */
/** เวอร์ชันที่ GM เรียกเอง — แยกจาก endRound เพราะ endRound ถูกเรียกจาก timer ที่ไม่มีตัวตน */
export function endRoundByGm(room: Room, gmId: string, now: number): Result {
  if (room.round?.gmId !== gmId) {
    return fail('NOT_GM', 'เฉพาะ Game Master เท่านั้น')
  }
  return endRound(room, 'GM', now)
}

/** host เตะคนออกจากห้อง ทำได้เฉพาะตอนอยู่ใน LOBBY */
export function kickPlayer(room: Room, hostId: string, targetId: string, now: number): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'LOBBY') {
    return fail('WRONG_PHASE', 'เตะคนได้เฉพาะตอนรออยู่ในห้อง')
  }
  if (targetId === hostId) {
    return fail('INVALID_TARGET', 'เตะตัวเองไม่ได้')
  }
  if (!room.players.delete(targetId)) {
    return fail('PLAYER_NOT_FOUND', 'ไม่พบผู้เล่นคนนี้ในห้อง')
  }

  room.lastActivityAt = now
  return ok(undefined)
}

export function submitGuess(room: Room, playerId: string, text: string): Result<boolean> {
  const round = room.round
  if (room.phase !== 'ROUND_END' || !round) {
    return fail('WRONG_PHASE', 'ทายคำได้เฉพาะตอนจบรอบ')
  }
  if (round.guesses.has(playerId)) {
    return fail('ALREADY_GUESSED', 'คุณส่งคำตอบไปแล้ว')
  }
  if (!round.alive.has(playerId) || round.wordBurned.has(playerId)) {
    return fail('CANNOT_GUESS', 'คุณเห็นคำของตัวเองไปแล้ว ทายไม่ได้')
  }

  const answer = round.assignments.get(playerId)
  if (!answer) return fail('PLAYER_NOT_FOUND', 'ไม่พบคำของคุณ')

  const correct = isCorrectGuess(text, answer)
  round.guesses.set(playerId, { text, correct })
  if (correct) addScore(room, playerId, 1)

  // อัปเดตประวัติรอบล่าสุดให้สะท้อนคนที่ทายถูก
  const last = room.roundHistory.at(-1)
  if (last && correct) last.correctGuessers.push(playerId)

  return ok(correct)
}

export function nextRound(
  room: Room,
  hostId: string,
  now: number,
  rng: () => number = Math.random,
): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'ROUND_END') {
    return fail('WRONG_PHASE', 'ยังไม่จบรอบ')
  }

  if (room.currentRound >= room.totalRounds) {
    room.phase = 'GAME_END'
    room.lastActivityAt = now
    return ok(undefined)
  }

  return beginRound(room, now, rng)
}

/** เล่นใหม่ด้วยคนกลุ่มเดิมในห้องเดิม */
export function restartGame(room: Room, hostId: string, now: number): Result {
  if (hostId !== room.hostId) {
    return fail('NOT_HOST', 'เฉพาะเจ้าของห้องเท่านั้น')
  }
  if (room.phase !== 'GAME_END') {
    return fail('WRONG_PHASE', 'เกมยังไม่จบ')
  }

  room.phase = 'LOBBY'
  room.currentRound = 0
  room.round = null
  room.roundHistory = []
  room.usedPackIds = []
  room.lastGmId = null
  room.countdownEndsAt = null
  room.lastActivityAt = now
  for (const p of room.players.values()) {
    p.score = 0
    p.ready = false
  }

  return ok(undefined)
}

function summarize(room: Room, round: Round, reason: EndReason): RoundSummary {
  return {
    round: room.currentRound,
    packTheme: round.packTheme,
    gmId: round.gmId,
    endReason: reason,
    deaths: [...round.deaths],
    words: Object.fromEntries(round.assignments),
    correctGuessers: [],
  }
}
```

เพิ่ม `Round` เข้าไปใน import type ที่หัวไฟล์ด้วย

- [ ] **Step 3b: เพิ่มเทสของ `endRoundByGm` และ `kickPlayer`**

ต่อท้าย `server/core/game.test.ts`:
```ts
describe('endRoundByGm', () => {
  it('คนที่ไม่ใช่ GM จบรอบไม่ได้', () => {
    const { room, others } = playingRoom()
    const r = endRoundByGm(room, others[0], 2_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_GM')
  })

  it('GM จบรอบได้ และ endReason เป็น GM', () => {
    const { room, gmId } = playingRoom()
    const r = endRoundByGm(room, gmId, 2_000)
    expect(r.ok).toBe(true)
    expect(room.phase).toBe('ROUND_END')
    expect(room.round!.endReason).toBe('GM')
  })
})

describe('kickPlayer', () => {
  it('host เตะคนอื่นออกได้ตอน LOBBY', () => {
    const room = roomWithPlayers(3)
    const target = [...room.players.keys()].find((id) => id !== room.hostId)!
    expect(kickPlayer(room, room.hostId, target, 1_000).ok).toBe(true)
    expect(room.players.has(target)).toBe(false)
  })

  it('คนที่ไม่ใช่ host เตะไม่ได้', () => {
    const room = roomWithPlayers(3)
    const ids = [...room.players.keys()]
    const notHost = ids.find((id) => id !== room.hostId)!
    const other = ids.find((id) => id !== room.hostId && id !== notHost)!
    const r = kickPlayer(room, notHost, other, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_HOST')
  })

  it('เตะตัวเองไม่ได้', () => {
    const room = roomWithPlayers(3)
    const r = kickPlayer(room, room.hostId, room.hostId, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_TARGET')
  })

  it('เตะระหว่างเล่นไม่ได้', () => {
    const { room, others } = playingRoom()
    const target = others[0]
    const r = kickPlayer(room, room.hostId, target, 1_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WRONG_PHASE')
  })
})
```

เทสชุดนี้ใช้ helper `roomWithPlayers(n)` และ `playingRoom()` ที่เขียนไว้แล้วในไฟล์เทสเดียวกัน (Task 7 Step 1 และ Task 8 Step 1) — `playingRoom()` คืน `{ room, gmId, others }` ไม่ใช่ `Room` ตรงๆ

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run server/core/game.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 5: รันเทสทั้งชุดกันของเก่าพัง**

Run: `npm test`
Expected: PASS ทุกไฟล์

- [ ] **Step 6: Commit**

```bash
git add server/core/game.ts server/core/game.test.ts
git commit -m "feat: add kill, undo, round end, guess, kick and next round"
```

---

## Task 9: room-store และ rate limit

**Files:**
- Create: `server/core/room-store.ts`
- Create: `server/core/rate-limit.ts`
- Test: `server/core/room-store.test.ts`
- Test: `server/core/rate-limit.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `game.ts` — `createRoom`, `constants.ts`
- Produces:
  - `class RoomStore` — `create(hostName, totalRounds, hostId, now): Result<Room>`, `get(code): Room | undefined`, `delete(code): void`, `sweep(now): number`, `size(): number`, `all(): Room[]`
  - `class RateLimiter` — `check(key, now): boolean`

`RoomStore` เป็นคลาสไม่ใช่ฟังก์ชันเดี่ยว เพราะต้องถือ `Map` ไว้ และเพราะจุดนี้คือที่เดียวที่จะเปลี่ยนไปใช้ Redis ในอนาคต — การรวมไว้หลังคลาสเดียวทำให้เปลี่ยนได้โดยไม่แตะ `game.ts`

- [ ] **Step 1: เขียนเทส rate-limit ที่ยังแดง**

`server/core/rate-limit.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('อนุญาตภายในโควตา', () => {
    const rl = new RateLimiter(3, 60_000)
    expect(rl.check('1.1.1.1', 0)).toBe(true)
    expect(rl.check('1.1.1.1', 1)).toBe(true)
    expect(rl.check('1.1.1.1', 2)).toBe(true)
  })

  it('ปฏิเสธเมื่อเกินโควตา', () => {
    const rl = new RateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) rl.check('1.1.1.1', i)
    expect(rl.check('1.1.1.1', 4)).toBe(false)
  })

  it('โควตาคืนเมื่อพ้นช่วงเวลา', () => {
    const rl = new RateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) rl.check('1.1.1.1', i)
    expect(rl.check('1.1.1.1', 61_000)).toBe(true)
  })

  it('แต่ละ key นับแยกกัน', () => {
    const rl = new RateLimiter(1, 60_000)
    expect(rl.check('a', 0)).toBe(true)
    expect(rl.check('b', 0)).toBe(true)
    expect(rl.check('a', 0)).toBe(false)
  })
})
```

- [ ] **Step 2: รันให้แดง แล้วเขียน `rate-limit.ts`**

Run: `npx vitest run server/core/rate-limit.test.ts` → FAIL

```ts
/** นับจำนวนครั้งต่อ key ในช่วงเวลาแบบเลื่อน */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** คืน true ถ้าอนุญาต และนับครั้งนี้เข้าไปด้วย */
  check(key: string, now: number): boolean {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)

    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }

    recent.push(now)
    this.hits.set(key, recent)
    return true
  }
}
```

Run อีกครั้ง → PASS

- [ ] **Step 3: เขียนเทส room-store ที่ยังแดง**

`server/core/room-store.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RoomStore } from './room-store'
import {
  EMPTY_ROOM_TTL_MS, FINISHED_ROOM_TTL_MS, MAX_ROOMS,
  ROOM_CODE_LENGTH, STALE_LOBBY_TTL_MS,
} from '../../constants'

const NOW = 1_000_000

describe('RoomStore.create', () => {
  it('สร้างห้องพร้อมโค้ดความยาวตามที่กำหนด', () => {
    const store = new RoomStore()
    const r = store.create('สมชาย', 5, 'p1', NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.code).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('โค้ดห้องไม่ชนกันเลยใน 300 ห้อง', () => {
    const store = new RoomStore()
    const codes = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) codes.add(r.value.code)
      // ลบทิ้งเพื่อไม่ให้ชนเพดาน แต่ยังเก็บโค้ดไว้ตรวจ
      if (r.ok) store.delete(r.value.code)
    }
    expect(codes.size).toBe(300)
  })

  it('โค้ดไม่มีตัวอักษรที่อ่านสับสน (I O 0 1)', () => {
    const store = new RoomStore()
    for (let i = 0; i < 50; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) {
        expect(r.value.code).not.toMatch(/[IO01]/)
        store.delete(r.value.code)
      }
    }
  })

  it('เกินเพดานแล้วปฏิเสธด้วย SERVER_FULL', () => {
    const store = new RoomStore()
    for (let i = 0; i < MAX_ROOMS; i++) store.create('x', 3, `p${i}`, NOW)
    const r = store.create('เกิน', 3, 'extra', NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('SERVER_FULL')
  })

  it('sweep คืนที่ว่างก่อน แล้วสร้างได้', () => {
    const store = new RoomStore()
    for (let i = 0; i < MAX_ROOMS; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) for (const p of r.value.players.values()) p.connected = false
    }
    // เวลาผ่านไปนานพอให้ห้องร้างถูกกวาด
    const later = NOW + EMPTY_ROOM_TTL_MS + 1
    const r = store.create('คนใหม่', 3, 'fresh', later)
    expect(r.ok).toBe(true)
  })
})

describe('RoomStore.sweep', () => {
  function storeWith(mutate: (store: RoomStore, code: string) => void) {
    const store = new RoomStore()
    const r = store.create('x', 3, 'p1', NOW)
    if (!r.ok) throw new Error('สร้างห้องไม่สำเร็จ')
    mutate(store, r.value.code)
    return { store, code: r.value.code }
  }

  it('ลบห้องที่ไม่มีใครต่ออยู่นานเกิน TTL', () => {
    const { store, code } = storeWith((s, c) => {
      for (const p of s.get(c)!.players.values()) p.connected = false
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + EMPTY_ROOM_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ไม่ลบห้องที่ยังมีคนต่ออยู่ แม้จะนานแค่ไหน', () => {
    const { store, code } = storeWith(() => {})
    store.sweep(NOW + EMPTY_ROOM_TTL_MS * 100)
    expect(store.get(code)).toBeDefined()
  })

  it('ลบห้อง LOBBY ที่ไม่เคยเริ่มเกมนานเกิน TTL แม้ยังมีคนค้าง', () => {
    const { store, code } = storeWith(() => {})
    store.sweep(NOW + STALE_LOBBY_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ลบห้องที่จบเกมแล้วนานเกิน TTL', () => {
    const { store, code } = storeWith((s, c) => {
      s.get(c)!.phase = 'GAME_END'
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + FINISHED_ROOM_TTL_MS + 1)
    expect(store.get(code)).toBeUndefined()
  })

  it('ไม่ลบห้องที่กำลังเล่นอยู่', () => {
    const { store, code } = storeWith((s, c) => {
      s.get(c)!.phase = 'PLAYING'
      s.get(c)!.lastActivityAt = NOW
    })
    store.sweep(NOW + STALE_LOBBY_TTL_MS * 10)
    expect(store.get(code)).toBeDefined()
  })

  it('คืนจำนวนห้องที่ลบไป', () => {
    const store = new RoomStore()
    for (let i = 0; i < 3; i++) {
      const r = store.create('x', 3, `p${i}`, NOW)
      if (r.ok) for (const p of r.value.players.values()) p.connected = false
    }
    expect(store.sweep(NOW + EMPTY_ROOM_TTL_MS + 1)).toBe(3)
  })
})

describe('RoomStore.get', () => {
  it('หาห้องด้วยโค้ดได้ ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    const store = new RoomStore()
    const r = store.create('x', 3, 'p1', NOW)
    if (!r.ok) throw new Error('สร้างห้องไม่สำเร็จ')
    expect(store.get(r.value.code.toLowerCase())).toBeDefined()
  })

  it('โค้ดที่ไม่มีอยู่ คืน undefined', () => {
    expect(new RoomStore().get('ZZZZZZ')).toBeUndefined()
  })
})
```

- [ ] **Step 4: รันให้แดง**

Run: `npx vitest run server/core/room-store.test.ts`
Expected: FAIL — หาโมดูล `./room-store` ไม่เจอ

- [ ] **Step 5: เขียน `room-store.ts`**

```ts
import { customAlphabet } from 'nanoid'
import {
  EMPTY_ROOM_TTL_MS, FINISHED_ROOM_TTL_MS, MAX_ROOMS,
  ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, STALE_LOBBY_TTL_MS,
} from '../../constants'
import { createRoom } from './game'
import { fail, ok, type Result, type Room } from './types'

const genCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)

/**
 * ที่เก็บห้องทั้งหมดของเซิร์ฟเวอร์
 * นี่คือจุดเดียวที่ต้องแก้ถ้าย้ายไป Redis — game.ts ไม่รู้จักคลาสนี้
 */
export class RoomStore {
  private rooms = new Map<string, Room>()

  create(hostName: string, totalRounds: number, hostId: string, now: number): Result<Room> {
    // กวาดห้องร้างก่อนเสมอ เพื่อคืนที่ว่างก่อนจะปฏิเสธคนใหม่
    this.sweep(now)

    if (this.rooms.size >= MAX_ROOMS) {
      return fail('SERVER_FULL', 'เซิร์ฟเวอร์เต็ม ลองใหม่อีกครั้งในภายหลัง')
    }

    const room = createRoom(this.freshCode(), hostName, totalRounds, hostId, now)
    this.rooms.set(room.code, room)
    return ok(room)
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase())
  }

  size(): number {
    return this.rooms.size
  }

  all(): Room[] {
    return [...this.rooms.values()]
  }

  /** ลบห้องที่ไม่มีใครใช้แล้ว คืนจำนวนที่ลบ */
  sweep(now: number): number {
    let removed = 0
    for (const [code, room] of this.rooms) {
      if (this.isStale(room, now)) {
        this.rooms.delete(code)
        removed++
      }
    }
    return removed
  }

  private isStale(room: Room, now: number): boolean {
    const anyoneHere = [...room.players.values()].some((p) => p.connected)
    const idleFor = now - room.lastActivityAt

    if (!anyoneHere && idleFor > EMPTY_ROOM_TTL_MS) return true
    if (room.phase === 'LOBBY' && now - room.createdAt > STALE_LOBBY_TTL_MS) return true
    if (room.phase === 'GAME_END' && idleFor > FINISHED_ROOM_TTL_MS) return true

    return false
  }

  private freshCode(): string {
    let code = genCode()
    while (this.rooms.has(code)) code = genCode()
    return code
  }
}
```

- [ ] **Step 6: รันเทสให้เขียว**

Run: `npx vitest run server/core/room-store.test.ts server/core/rate-limit.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add server/core/room-store.ts server/core/rate-limit.ts server/core/room-store.test.ts server/core/rate-limit.test.ts
git commit -m "feat: add room store with sweeper and rate limiter"
```

---

## Task 10: zod schemas และ socket handlers

**Files:**
- Create: `server/schemas.ts`
- Create: `server/socket-handlers.ts`
- Test: `server/socket-handlers.test.ts`

**Interfaces:**
- Consumes: ทุกอย่างใน `server/core/`
- Produces:
  - `registerHandlers(io: Server, store: RoomStore, deps?: Deps): void`
  - `type Deps = { now?: () => number; rng?: () => number }`

**หลักการของชั้นนี้:** ไม่มีกติกาเกมอยู่ในไฟล์นี้เลย หน้าที่มีสามอย่าง — validate payload, เรียก core, กระจายผลลัพธ์ ถ้าเจอ `if` ที่ตัดสินใจเรื่องกติกาในไฟล์นี้ แปลว่ามันควรอยู่ใน `game.ts`

**การจัดการ timer:** `setTimeout` สำหรับจบรอบและจบ countdown เก็บไว้ใน `Map<roomCode, NodeJS.Timeout>` ต้อง clear ทุกครั้งที่รอบจบด้วยเหตุอื่น ไม่งั้น timer เก่าจะยิงทับรอบใหม่

- [ ] **Step 1: เขียน `server/schemas.ts`**

```ts
import { z } from 'zod'
import {
  MAX_GUESS_LENGTH, MAX_NAME_LENGTH, MAX_ROUNDS,
  MIN_ROUNDS, ROOM_CODE_LENGTH,
} from '../constants'

const playerName = z.string().trim().min(1, 'กรุณากรอกชื่อ').max(MAX_NAME_LENGTH)
const playerId = z.string().min(1).max(64)

export const createRoomSchema = z.object({
  name: playerName,
  totalRounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  playerId: playerId.optional(),
})

export const joinRoomSchema = z.object({
  code: z.string().trim().length(ROOM_CODE_LENGTH),
  name: playerName,
  playerId: playerId.optional(),
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
```

- [ ] **Step 2: เขียนเทส integration ที่ยังแดง**

`server/socket-handlers.test.ts`:
```ts
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
    /** รอจนกว่า state จะเข้าเงื่อนไข */
    async until(
      pred: (s: MaskedRoomState) => boolean,
      ms = 8000,
    ): Promise<MaskedRoomState> {
      const deadline = Date.now() + ms
      while (Date.now() < deadline) {
        if (latest && pred(latest)) return latest
        await new Promise((r) => setTimeout(r, 25))
      }
      throw new Error('รอ state ตามเงื่อนไขไม่ทัน')
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

    const playing = once<MaskedRoomState>(host.socket, 'round:started', 8000)
    host.socket.emit('game:start')
    const started = await playing

    // หา socket ของคนที่ไม่ใช่ GM
    const sockets = [
      { s: host.socket, id: host.state.viewerId },
      { s: g1.socket, id: g1.state.viewerId },
      { s: g2.socket, id: g2.state.viewerId },
    ]
    const gm = started.players.find((p) => p.isGm)!
    const notGm = sockets.find((x) => x.id !== gm.id)!
    const victim = sockets.find((x) => x.id !== gm.id && x.id !== notGm.id)!

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

    for (const s of [host.socket, g1.socket, g2.socket]) {
      s.emit('player:ready', { ready: true })
    }
    await new Promise((r) => setTimeout(r, 100))

    const all = [host.socket, g1.socket, g2.socket].map((s) =>
      once<MaskedRoomState>(s, 'round:started', 8000),
    )
    host.socket.emit('game:start')
    const states = await Promise.all(all)

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
    back.emit('room:join', { code: host.state.code, name: 'มานี', playerId: originalId })
    const st = await p

    expect(st.viewerId).toBe(originalId)
    expect(st.players).toHaveLength(2)
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
```

เส้นทาง "หมดเวลา" ไม่ทำเป็น integration test เพราะรอบสั้นที่สุดคือ 5 นาทีจริง และการปลอม timer ทำให้ socket.io ไม่เสถียร — ครอบด้วย unit test ของ `endRound(room, 'TIME')` ใน Task 8 กับการตรวจด้วยมือใน Task 17 แทน

- [ ] **Step 3: รันให้แดง**

Run: `npx vitest run server/socket-handlers.test.ts`
Expected: FAIL — หาโมดูล `./socket-handlers` ไม่เจอ

หมายเหตุ: `vitest.config.ts` มี `include: ['server/**/*.test.ts']` อยู่แล้ว จึงครอบไฟล์นี้โดยไม่ต้องแก้อะไร

- [ ] **Step 4: เขียน `server/socket-handlers.ts`**

```ts
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

  /** ส่ง state ให้ทุกคนในห้อง โดยแต่ละคนได้มุมมองของตัวเอง */
  function broadcast(room: Room): void {
    for (const socket of io.of('/').sockets.values()) {
      const data = socket.data as SocketData
      if (data.roomCode !== room.code || !data.playerId) continue
      socket.emit('state:sync', maskFor(room, data.playerId))
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

    io.to(room.code).emit('round:started', {
      round: room.currentRound,
      gmId: room.round!.gmId,
      packTheme: room.round!.packTheme,
      endsAt: room.round!.endsAt,
    })
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

      io.to(ctx.room.code).emit('round:started', {
        round: ctx.room.currentRound,
        gmId: ctx.room.round!.gmId,
        packTheme: ctx.room.round!.packTheme,
        endsAt: ctx.room.round!.endsAt,
      })
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
```

- [ ] **Step 5: รันเทสให้เขียว**

Run: `npx vitest run server/socket-handlers.test.ts`
Expected: PASS ทั้งหมด

ถ้าเทส `การตรวจสิทธิ์ > คนที่ไม่ใช่ GM` ค้าง ให้ตรวจว่า `broadcast()` ส่งถึงทุก socket ในห้องจริง — เทสนี้พึ่ง `round:started` ที่ยิงหลัง countdown 3 วินาที จึงตั้ง timeout ไว้ 8 วินาที

- [ ] **Step 6: รันเทสทั้งชุด**

Run: `npm test`
Expected: PASS ทุกไฟล์

- [ ] **Step 7: Commit**

```bash
git add server/schemas.ts server/socket-handlers.ts server/socket-handlers.test.ts
git commit -m "feat: add socket handlers with zod validation"
```

---

## Task 11: custom server

**Files:**
- Create: `server/index.ts`

**Interfaces:**
- Consumes: `socket-handlers.ts` — `registerHandlers`, `room-store.ts` — `RoomStore`
- Produces: กระบวนการที่รันเว็บได้จริงด้วย `npm run dev`

- [ ] **Step 1: เขียน `server/index.ts`**

```ts
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
```

- [ ] **Step 2: ตรวจว่า server เปิดได้จริง**

```bash
npm run dev
```
Expected: เห็น `พร้อมใช้งานที่ http://localhost:3000` และเปิดหน้าเว็บได้ (ยังเป็น placeholder)
กด Ctrl+C ปิด

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: add custom server with Socket.IO"
```

---

## Task 12: socket client และ hook ของห้อง

**Files:**
- Create: `src/lib/socket-client.ts`
- Create: `src/lib/use-countdown.ts`
- Create: `src/lib/use-room.ts`

**Interfaces:**
- Consumes: `server/core/types.ts` — `MaskedRoomState`, `ErrorCode`
- Produces:
  - `getSocket(): Socket` — singleton
  - `getPlayerId(): string` (สร้างและจำใน localStorage ให้เอง), `getPlayerName(): string`, `savePlayerName(name: string): void`
  - `useCountdown(target: number | null): number` — วินาทีที่เหลือ
  - `useRoom(): RoomApi` — object ที่หน้าจอทุกหน้าใช้

```ts
type RoomApi = {
  state: MaskedRoomState | null
  error: { code: ErrorCode; message: string } | null
  clearError(): void
  connected: boolean
  me: MaskedPlayer | null
  isHost: boolean
  isGm: boolean
  createRoom(name: string, totalRounds: number): void
  joinRoom(code: string, name: string): void
  setReady(ready: boolean): void
  kick(targetId: string): void
  startGame(): void
  kill(victimId: string, killerId: string): void
  undoKill(deathIndex: number): void
  endRound(): void
  guess(text: string): void
  nextRound(): void
  restart(): void
  leave(): void
}
```

**ทำไมรวมทุก action ไว้ hook เดียว:** component ไม่ควรรู้ชื่อ event ของ socket เลย ถ้าโปรโตคอลเปลี่ยน แก้ที่นี่ที่เดียว และการมี state ก้อนเดียวทำให้ไม่มีทางที่สองส่วนของจอจะเห็น state คนละเวอร์ชัน

- [ ] **Step 1: เขียน `src/lib/socket-client.ts`**

```ts
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
```

- [ ] **Step 2: เขียน `src/lib/use-countdown.ts`**

```ts
'use client'

import { useEffect, useState } from 'react'

/**
 * นับถอยหลังจาก timestamp ปลายทาง
 * server ไม่ส่ง tick รายวินาที — client คำนวณเองจาก endsAt
 */
export function useCountdown(target: number | null): number {
  const [remaining, setRemaining] = useState(() => secondsLeft(target))

  useEffect(() => {
    if (target === null) {
      setRemaining(0)
      return
    }

    setRemaining(secondsLeft(target))
    const id = setInterval(() => setRemaining(secondsLeft(target)), 250)
    return () => clearInterval(id)
  }, [target])

  return remaining
}

function secondsLeft(target: number | null): number {
  if (target === null) return 0
  return Math.max(0, Math.ceil((target - Date.now()) / 1000))
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
```

`setInterval` ตั้งไว้ 250ms ไม่ใช่ 1000ms เพราะถ้าเท่ากับ 1 วินาทีพอดี เลขบนจอจะกระตุกข้ามวินาทีเวลา timer ถูกเลื่อน

- [ ] **Step 3: เขียน `src/lib/use-room.ts`**

```ts
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
```

- [ ] **Step 4: ตรวจ typecheck**

Run: `npm run typecheck`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat: add socket client and room hook"
```

---

## Task 13: หน้า Home

**Files:**
- Modify: `src/app/page.tsx` (แทนที่ placeholder ทั้งไฟล์)

**Interfaces:**
- Consumes: `use-room.ts` — `useRoom`, `socket-client.ts` — `getPlayerName`
- Produces: หน้าแรกที่สร้างห้องและเข้าห้องได้จริง

**พฤติกรรมที่ต้องได้:** เมื่อสร้างหรือเข้าห้องสำเร็จ `state:sync` จะมาถึง แล้วหน้านี้ `router.push` ไป `/room/<code>` เอง — ไม่ต้องรอ callback จาก server

- [ ] **Step 1: เขียน `src/app/page.tsx`**

```tsx
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
```

`useSearchParams` ต้องอยู่ใต้ `<Suspense>` ใน Next App Router — Step 2 จัดการให้

- [ ] **Step 2: ห่อด้วย Suspense ใน `src/app/layout.tsx`**

แก้ `<body>` ให้เป็น:
```tsx
<body>
  <Suspense fallback={null}>{children}</Suspense>
</body>
```
พร้อมเพิ่ม `import { Suspense } from 'react'` ที่หัวไฟล์

- [ ] **Step 3: ตรวจด้วยตา**

```bash
npm run dev
```
เปิด `http://localhost:3000` ที่ความกว้าง 390px
ตรวจ: กรอกชื่อแล้วปุ่ม "สร้างห้อง" กดได้ · กดแล้วเด้งไป `/room/<code>` (หน้ายังว่างเพราะยังไม่ทำ) · refresh กลับมาหน้าแรก ชื่อยังอยู่

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add home page"
```

---

## Task 14: หน้าห้องและ Lobby

**Files:**
- Create: `src/app/room/[code]/page.tsx`
- Create: `src/app/_components/Lobby.tsx`
- Create: `src/app/_components/Countdown.tsx`

**Interfaces:**
- Consumes: `use-room.ts` — `useRoom`, `RoomApi`, `use-countdown.ts` — `useCountdown`
- Produces:
  - `<Lobby api={api} />`, `<Countdown api={api} />` — ทั้งสองรับ prop เดียวชื่อ `api: RoomApi`

ทุก component ในหน้าห้องรับ `api: RoomApi` ก้อนเดียวเหมือนกันหมด ไม่มีตัวไหนรับ prop แยกย่อย — เพิ่ม field ใน state แล้วไม่ต้องไล่แก้ signature ทุกไฟล์

- [ ] **Step 1: เขียน `src/app/room/[code]/page.tsx`**

```tsx
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
  useEffect(() => {
    if (!api.connected || api.state || joinSent.current) return
    const name = getPlayerName()
    if (!name) {
      router.replace(`/?code=${code}`)
      return
    }
    joinSent.current = true
    api.joinRoom(code, name)
  }, [api, code, router])

  // หลุดแล้วต่อกลับมา ต้องยอมให้ join ใหม่ได้อีกครั้ง
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
```

ทุก phase อยู่ URL เดียว — สลับด้วย `switch` ไม่ใช่ `router.push` จึงไม่มีจังหวะที่ URL กับ state ไม่ตรงกัน

- [ ] **Step 2: เขียน `src/app/_components/Lobby.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MIN_PLAYERS } from '../../../constants'
import type { RoomApi } from '../../lib/use-room'

export function Lobby({ api }: { api: RoomApi }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const state = api.state!

  const everyoneReady = state.players.every((p) => p.ready)
  const enoughPlayers = state.players.length >= MIN_PLAYERS
  const canStart = api.isHost && everyoneReady && enoughPlayers

  async function copyInvite() {
    const url = `${window.location.origin}/?code=${state.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // เบราว์เซอร์บางตัวบล็อก clipboard — ให้ผู้ใช้ก๊อปจาก address bar เอง
      window.prompt('คัดลอกลิงก์นี้', url)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <div className="rounded-2xl bg-slate-800 p-4 text-center">
        <div className="text-sm text-slate-400">โค้ดห้อง</div>
        <div className="text-5xl font-bold tracking-[0.3em] text-sky-400">{state.code}</div>
        <button
          type="button"
          onClick={copyInvite}
          className="mt-3 w-full rounded-xl bg-slate-700 p-3 font-bold"
        >
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์เชิญ'}
        </button>
      </div>

      <div className="text-sm text-slate-400">
        ผู้เล่น {state.players.length} คน · {state.totalRounds} รอบ
      </div>

      {state.players.map((p) => (
        <div
          key={p.id}
          className={`flex items-center justify-between rounded-2xl bg-slate-800 p-4 ${
            p.connected ? '' : 'opacity-50'
          }`}
        >
          <span className="text-lg">
            {p.name}
            {p.id === state.viewerId && <span className="text-slate-400"> (คุณ)</span>}
            {p.isHost && (
              <span className="ml-2 rounded-full bg-sky-400 px-2 py-0.5 text-xs text-slate-900">
                host
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className={p.ready ? 'text-green-400' : 'text-slate-500'}>
              {!p.connected ? 'หลุด' : p.ready ? 'พร้อม' : 'ยังไม่พร้อม'}
            </span>
            {api.isHost && p.id !== state.viewerId && (
              <button
                type="button"
                onClick={() => api.kick(p.id)}
                aria-label={`เชิญ ${p.name} ออกจากห้อง`}
                className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-red-300"
              >
                เตะ
              </button>
            )}
          </span>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button
          type="button"
          onClick={() => api.setReady(!api.me?.ready)}
          className={`rounded-xl p-4 text-lg font-bold ${
            api.me?.ready ? 'bg-slate-700' : 'bg-green-400 text-slate-900'
          }`}
        >
          {api.me?.ready ? 'ยกเลิกพร้อม' : 'พร้อม'}
        </button>

        {api.isHost && (
          <>
            <button
              type="button"
              disabled={!canStart}
              onClick={api.startGame}
              className="rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900 disabled:opacity-40"
            >
              เริ่มเกม
            </button>
            {!canStart && (
              <p className="text-center text-sm text-slate-500">
                {!enoughPlayers
                  ? `ต้องมีอย่างน้อย ${MIN_PLAYERS} คน`
                  : 'รอให้ทุกคนกดพร้อมก่อน'}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => {
            api.leave()
            router.replace('/')
          }}
          className="p-3 text-sm text-slate-500"
        >
          ออกจากห้อง
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: เขียน `src/app/_components/Countdown.tsx`**

```tsx
'use client'

import { useCountdown } from '../../lib/use-countdown'
import type { RoomApi } from '../../lib/use-room'

export function Countdown({ api }: { api: RoomApi }) {
  const seconds = useCountdown(api.state!.countdownEndsAt)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="text-[8rem] font-bold leading-none text-sky-400">
        {seconds > 0 ? seconds : 'เริ่ม!'}
      </div>
      <div className="text-slate-400">กำลังแจกคำ...</div>
    </main>
  )
}
```

- [ ] **Step 4: หยุดตรงนี้ยังรันไม่ได้**

`page.tsx` import `Playing`, `RoundEnd`, `Summary` ที่ยังไม่มี — typecheck จะฟ้อง เป็นเรื่องปกติ Task 15 กับ 16 จะเติมให้ครบ อย่าเพิ่ง commit

- [ ] **Step 5: ทำ Task 15 และ 16 ให้จบก่อน แล้วค่อย commit รวมกัน**

---

## Task 15: หน้า Playing และเครื่องมือ GM

**Files:**
- Create: `src/app/_components/PlayerCard.tsx`
- Create: `src/app/_components/GmToolbar.tsx`
- Create: `src/app/_components/Playing.tsx`

**Interfaces:**
- Consumes: `use-room.ts` — `RoomApi`, `MaskedPlayer`, `use-countdown.ts` — `useCountdown`, `formatClock`
- Produces: `<PlayerCard player isMe />`, `<GmToolbar api />`, `<Playing api />`

**invariant ของหน้านี้:** การ์ดของตัวเองแสดง `? ? ?` เพราะ `player.word === null` จริงๆ ไม่ใช่เพราะ CSS ซ่อน — ถ้าวันไหน server หลุดคำมา หน้านี้จะโชว์ทันที ซึ่งถูกแล้ว เพราะบั๊กต้องเห็น ไม่ใช่ถูกกลบ

- [ ] **Step 1: เขียน `src/app/_components/PlayerCard.tsx`**

```tsx
import type { MaskedPlayer } from '../../lib/use-room'

export function PlayerCard({
  player,
  isMe,
  onClick,
  selected,
}: {
  player: MaskedPlayer
  isMe: boolean
  onClick?: () => void
  selected?: boolean
}) {
  const dead = !player.isAlive
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full rounded-2xl p-4 text-left',
        dead ? 'bg-slate-900 opacity-55' : 'bg-slate-800',
        isMe ? 'ring-2 ring-sky-400' : '',
        selected ? 'ring-2 ring-red-400' : '',
      ].join(' ')}
    >
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <span>
          {player.name}
          {isMe && ' (คุณ)'}
        </span>
        {player.isGm && (
          <span className="rounded-full bg-sky-400 px-2 py-0.5 text-xs text-slate-900">GM</span>
        )}
        {dead && (
          <span className="rounded-full bg-red-400 px-2 py-0.5 text-xs text-slate-900">
            ตายแล้ว
          </span>
        )}
        {!player.connected && <span className="text-xs">หลุด</span>}
      </div>

      {player.word === null ? (
        <div className="text-3xl font-bold tracking-[0.3em] text-slate-600">? ? ?</div>
      ) : (
        <div className="text-3xl font-bold">{player.word}</div>
      )}
    </Tag>
  )
}
```

- [ ] **Step 2: เขียน `src/app/_components/GmToolbar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { RoomApi } from '../../lib/use-room'

type Step = 'idle' | 'pickVictim' | 'pickKiller'

export function GmToolbar({ api }: { api: RoomApi }) {
  const state = api.state!
  const [step, setStep] = useState<Step>('idle')
  const [victimId, setVictimId] = useState<string | null>(null)

  const alive = state.players.filter((p) => p.isAlive)
  const victim = state.players.find((p) => p.id === victimId) ?? null

  function reset() {
    setStep('idle')
    setVictimId(null)
  }

  function confirmKiller(killerId: string) {
    if (victimId) api.kill(victimId, killerId)
    reset()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t-2 border-sky-400 bg-slate-800 p-3">
      {step === 'idle' && (
        <>
          <div className="mb-2 text-sm text-slate-400">คุณเป็น Game Master</div>
          <button
            type="button"
            onClick={() => setStep('pickVictim')}
            className="mb-2 w-full rounded-xl bg-red-400 p-4 text-lg font-bold text-slate-900"
          >
            บันทึกคนตาย
          </button>
          {state.deaths.length > 0 && (
            <button
              type="button"
              onClick={() => api.undoKill(state.deaths.length - 1)}
              className="mb-2 w-full rounded-xl bg-slate-700 p-3"
            >
              เลิกทำครั้งล่าสุด
            </button>
          )}
          <button
            type="button"
            onClick={api.endRound}
            className="w-full rounded-xl bg-slate-700 p-3"
          >
            จบรอบนี้
          </button>
        </>
      )}

      {step === 'pickVictim' && (
        <>
          <div className="mb-2 text-sm text-slate-400">ใครพูดคำตัวเอง?</div>
          <div className="mb-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">
            {alive.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setVictimId(p.id)
                  setStep('pickKiller')
                }}
                className="rounded-xl bg-slate-700 p-3 font-bold"
              >
                {p.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={reset} className="w-full rounded-xl bg-slate-900 p-3">
            ยกเลิก
          </button>
        </>
      )}

      {step === 'pickKiller' && (
        <>
          <div className="mb-2 text-sm text-slate-400">ใครหลอก {victim?.name} ได้?</div>
          <div className="mb-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">
            {state.players
              .filter((p) => p.id !== victimId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => confirmKiller(p.id)}
                  className="rounded-xl bg-slate-700 p-3 font-bold"
                >
                  {p.name}
                </button>
              ))}
          </div>
          <button type="button" onClick={reset} className="w-full rounded-xl bg-slate-900 p-3">
            ยกเลิก
          </button>
        </>
      )}
    </div>
  )
}
```

คนหลอกเลือกได้จากทุกคนที่ไม่ใช่เหยื่อ รวมคนที่ตายแล้ว — คนตายยังคุยอยู่ในวงและหลอกคนอื่นต่อได้

- [ ] **Step 3: เขียน `src/app/_components/Playing.tsx`**

```tsx
'use client'

import { formatClock, useCountdown } from '../../lib/use-countdown'
import type { RoomApi } from '../../lib/use-room'
import { GmToolbar } from './GmToolbar'
import { PlayerCard } from './PlayerCard'

export function Playing({ api }: { api: RoomApi }) {
  const state = api.state!
  const remaining = useCountdown(state.endsAt)

  const others = state.players.filter((p) => p.id !== state.viewerId)
  const me = api.me

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4 pb-56">
      <div className="flex justify-between text-sm text-slate-400">
        <span>
          รอบ {state.currentRound}/{state.totalRounds}
        </span>
        <span>หมวด: {state.packTheme}</span>
      </div>

      <div
        className={`text-center text-5xl font-bold tabular-nums ${
          remaining <= 30 ? 'text-red-400' : 'text-slate-100'
        }`}
      >
        {formatClock(remaining)}
      </div>

      {me && <PlayerCard player={me} isMe />}

      {me && !me.isAlive && (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-sm text-slate-400">
          คุณตายแล้ว — คำของคุณเปิดให้เห็นด้านบน คุยกับเพื่อนต่อเพื่อหลอกคนอื่นได้
        </p>
      )}

      <div className="mt-2 text-sm text-slate-400">คำของคนอื่น</div>
      {others.map((p) => (
        <PlayerCard key={p.id} player={p} isMe={false} />
      ))}

      {api.isGm && <GmToolbar api={api} />}
    </main>
  )
}
```

- [ ] **Step 4: ยังไม่ commit — ต่อ Task 16**

---

## Task 16: หน้า RoundEnd และ Summary

**Files:**
- Create: `src/app/_components/RoundEnd.tsx`
- Create: `src/app/_components/Summary.tsx`

**Interfaces:**
- Consumes: `use-room.ts` — `RoomApi`
- Produces: `<RoundEnd api />`, `<Summary api />`

- [ ] **Step 1: เขียน `src/app/_components/RoundEnd.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MAX_GUESS_LENGTH } from '../../../constants'
import type { RoomApi } from '../../lib/use-room'
import { PlayerCard } from './PlayerCard'

const END_REASON_TEXT: Record<string, string> = {
  TIME: 'หมดเวลา',
  LAST_MAN: 'เหลือคนรอดคนสุดท้าย',
  GM: 'Game Master จบรอบ',
}

export function RoundEnd({ api }: { api: RoomApi }) {
  const state = api.state!
  const [text, setText] = useState('')
  const me = api.me
  const isLastRound = state.currentRound >= state.totalRounds

  const standings = [...state.players].sort((a, b) => b.score - a.score)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <h2 className="text-xl font-bold">
        จบรอบ {state.currentRound} — {END_REASON_TEXT[state.endReason ?? ''] ?? ''}
      </h2>

      {me?.canGuess && (
        <div className="rounded-2xl bg-slate-800 p-4 ring-2 ring-sky-400">
          <div className="mb-2 text-sm text-slate-400">คำของคุณคืออะไร?</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_GUESS_LENGTH}
            placeholder="พิมพ์คำที่คิดว่าใช่"
            className="mb-2 w-full rounded-xl bg-slate-900 p-3 text-lg outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="button"
            disabled={text.trim().length === 0}
            onClick={() => api.guess(text.trim())}
            className="w-full rounded-xl bg-sky-400 p-3 font-bold text-slate-900 disabled:opacity-40"
          >
            ส่งคำตอบ
          </button>
          <p className="mt-2 text-xs text-slate-500">ส่งได้ครั้งเดียว วรรณยุกต์ผิดได้ ตัวสะกดต้องถูก</p>
        </div>
      )}

      {me?.hasGuessed && (
        <p
          className={`rounded-xl p-3 text-center font-bold ${
            me.guessCorrect ? 'bg-green-950 text-green-300' : 'bg-red-950 text-red-300'
          }`}
        >
          {me.guessCorrect ? 'ทายถูก! ได้ 1 คะแนน' : 'ทายผิด ไม่ได้คะแนนรอบนี้'}
        </p>
      )}

      {me && !me.isAlive && (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-slate-400">
          คุณตายในรอบนี้ จึงไม่มีสิทธิ์ทายคำ
        </p>
      )}

      <div className="mt-2 text-sm text-slate-400">เฉลยคำทุกคน</div>
      {state.players.map((p) => (
        <PlayerCard key={p.id} player={p} isMe={p.id === state.viewerId} />
      ))}

      <div className="mt-2 text-sm text-slate-400">คะแนนสะสม</div>
      <table className="w-full">
        <tbody>
          {standings.map((p) => (
            <tr key={p.id} className="border-b border-slate-700">
              <td className="py-2">{p.name}</td>
              <td className="py-2 text-right text-lg font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {api.isHost && (
        <button
          type="button"
          onClick={api.nextRound}
          className="mt-4 rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900"
        >
          {isLastRound ? 'ดูสรุปผล' : 'รอบต่อไป'}
        </button>
      )}
      {!api.isHost && (
        <p className="mt-4 text-center text-slate-500">รอ host กดไปต่อ</p>
      )}
    </main>
  )
}
```

- [ ] **Step 2: เขียน `src/app/_components/Summary.tsx`**

```tsx
'use client'

import type { RoomApi } from '../../lib/use-room'

const MEDALS = ['🥇', '🥈', '🥉']

export function Summary({ api }: { api: RoomApi }) {
  const state = api.state!
  const standings = [...state.players].sort((a, b) => b.score - a.score)
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <h1 className="mt-4 text-center text-3xl font-bold">จบเกม</h1>

      {standings[0] && (
        <div className="rounded-2xl bg-slate-800 p-6 text-center ring-2 ring-sky-400">
          <div className="text-5xl">🥇</div>
          <div className="text-2xl font-bold">{standings[0].name}</div>
          <div className="text-slate-400">{standings[0].score} คะแนน</div>
        </div>
      )}

      <table className="w-full">
        <tbody>
          {standings.map((p, i) => (
            <tr key={p.id} className="border-b border-slate-700">
              <td className="w-10 py-2">{MEDALS[i] ?? i + 1}</td>
              <td className="py-2">
                {p.name}
                {p.id === state.viewerId && <span className="text-slate-400"> (คุณ)</span>}
              </td>
              <td className="py-2 text-right text-lg font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-sm text-slate-400">ประวัติรายรอบ</div>
      {state.roundHistory.map((r) => (
        <div key={r.round} className="rounded-2xl bg-slate-800 p-4">
          <div className="mb-2 text-sm text-slate-400">
            รอบ {r.round} — หมวด: {r.packTheme} · GM: {nameOf(r.gmId)}
          </div>
          {r.deaths.map((d, i) => (
            <div key={i}>
              {nameOf(d.killerId)} หลอก {nameOf(d.victimId)} สำเร็จ
            </div>
          ))}
          {r.correctGuessers.map((id) => (
            <div key={id}>{nameOf(id)} ทายคำตัวเองถูก</div>
          ))}
          {r.deaths.length === 0 && r.correctGuessers.length === 0 && (
            <div className="text-slate-500">ไม่มีใครได้คะแนนในรอบนี้</div>
          )}
        </div>
      ))}

      {api.isHost && (
        <button
          type="button"
          onClick={api.restart}
          className="mt-4 rounded-xl bg-sky-400 p-4 text-lg font-bold text-slate-900"
        >
          เล่นอีกรอบ (ห้องเดิม)
        </button>
      )}
    </main>
  )
}
```

- [ ] **Step 3: ตรวจ typecheck ทั้งโปรเจกต์**

Run: `npm run typecheck`
Expected: ไม่มี error — ตอนนี้ `page.tsx` มี component ครบทุกตัวที่ import แล้ว

- [ ] **Step 4: Commit UI ทั้งชุด**

```bash
git add src/app
git commit -m "feat: add room UI for every phase"
```

---

## Task 17: เล่นจริงครบวงจร

**Files:** ไม่สร้างไฟล์ใหม่ — เป็น task ตรวจรับ

**Interfaces:**
- Consumes: ทุกอย่างที่สร้างมา
- Produces: ความมั่นใจว่าเกมเล่นได้จริงจากต้นจนจบ

- [ ] **Step 1: รันเทสทั้งหมด**

```bash
npm test && npm run typecheck && npm run build
```
Expected: ผ่านทั้งสามคำสั่ง

- [ ] **Step 2: เล่นจริงด้วย 4 แท็บ**

```bash
npm run dev
```

เปิด 4 หน้าต่างเบราว์เซอร์ — **ต้องเป็นคนละ browser profile หรือ incognito แยกกัน** เพราะ `playerId` เก็บใน localStorage ต่อ origin ถ้าใช้แท็บธรรมดาในโปรไฟล์เดียวกัน ทั้งสี่จะเป็นคนเดียวกัน

- [ ] **Step 3: ไล่ checklist ตรวจรับ**

ทำตามลำดับ ทุกข้อต้องผ่าน:

1. คนที่ 1 สร้างห้อง 3 รอบ → ได้โค้ด 6 ตัว
2. คัดลอกลิงก์เชิญ → คนที่ 2-4 เปิดลิงก์ กรอกชื่อ เข้าห้องได้
3. ทุกคนกดพร้อม → ปุ่ม "เริ่มเกม" ของ host กดได้ (คนอื่นไม่มีปุ่มนี้)
4. เริ่มเกม → นับถอยหลัง 3-2-1 → เข้าหน้าเล่น
5. **ตรวจข้อสำคัญที่สุด:** ทุกจอเห็นการ์ดตัวเองเป็น `? ? ?` และเห็นคำของอีก 3 คน
6. เปิด DevTools → Network → WS → ดู frame ของ `state:sync` **ยืนยันว่าคำของตัวเองไม่อยู่ใน payload เลย**
7. เวลาถอยหลังตรงกันทุกจอ (4 คน → 5 นาที)
8. คนที่เป็น GM เห็นแถบเครื่องมือล่างจอ คนอื่นไม่เห็น
9. GM บันทึกคนตาย 1 คน → จอคนนั้นเปิดคำตัวเอง การ์ดจาง มีป้าย "ตายแล้ว" ทุกจอ
10. คนหลอกได้ +1 (ดูตอนจบรอบ)
11. GM กด "เลิกทำครั้งล่าสุด" → คนนั้นกลับมา alive แต่ยังเห็นคำตัวเอง (`wordBurned`)
12. GM กด "จบรอบนี้" → ทุกจอเข้าหน้า ROUND_END พร้อมกัน
13. คนที่รอดและไม่ติด `wordBurned` เห็นช่องทายคำ · คนที่ตายหรือ burned ไม่เห็น
14. ทายถูก (พิมพ์วรรณยุกต์ผิดก็ต้องผ่าน) → คะแนน +1
15. host กด "รอบต่อไป" → GM คนใหม่ (ไม่ใช่คนเดิม) หมวดคำใหม่
16. เล่นครบ 3 รอบ → เข้าหน้าสรุป มีอันดับ เหรียญ และประวัติรายรอบครบทุกรอบ
17. host กด "เล่นอีกรอบ" → กลับ LOBBY คะแนนเป็น 0 ทุกคน
18. ระหว่างเล่น ปิดแท็บหนึ่งแล้วเปิดลิงก์ห้องใหม่ → กลับเข้าเป็นคนเดิม คะแนนและคำครบ
19. เปิดห้องที่สองพร้อมกันคนละกลุ่ม → สองห้องไม่กวนกัน

- [ ] **Step 4: บันทึกสิ่งที่เจอ**

ถ้าข้อไหนไม่ผ่าน ให้แก้แล้ววนกลับมาไล่ใหม่ตั้งแต่ข้อ 1 อย่าแก้ทีละข้อแล้วข้าม — บั๊กของ state machine มักโผล่จากลำดับ ไม่ใช่จากหน้าจอเดี่ยวๆ

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify full game flow"
```

---

## เสร็จแล้วได้อะไร

เว็บเกมคำต้องห้ามที่:
- แจกคำจาก 6 หมวด และ **ไม่มีทางที่ใครจะเห็นคำของตัวเอง** เพราะคำไม่เคยถูกส่งไปหาเจ้าตัว
- จับเวลาตามจำนวนคน สลับ GM ทุกรอบ นับคะแนนที่ server ฝ่ายเดียว
- รองรับหลายห้องพร้อมกัน มีเพดานและ sweeper กันโตไม่หยุด
- กลับเข้าห้องได้หลังเน็ตหลุดหรือ refresh
- มีเทสครอบกติกาทุกข้อ และ integration test ที่เปิด socket จริง

**สิ่งที่ยังไม่มีโดยตั้งใจ:** DB, auth, chat ในเว็บ, E2E test, และ deploy บน Vercel (custom server ต้องรันบน VPS/Railway/Fly.io)
