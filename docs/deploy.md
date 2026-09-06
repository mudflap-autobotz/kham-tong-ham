# Deploy

## ทำไม Vercel ไม่ได้

เกมนี้ใช้ Socket.IO บน custom server (`server/index.ts`) และเก็บห้องไว้ใน `Map` ในหน่วยความจำของ process
Vercel รันเป็น serverless — ไม่มี process ค้าง ไม่มี WebSocket ยาว และแต่ละ request ไปคนละ instance
ผลที่เห็นตอนลอง deploy คือ `wss://.../api/socket/` ตอบ **308** เพราะบน Vercel ไม่มี route นั้นอยู่จริง
`next build` ที่ Vercel รันให้ ไม่เคยแตะ `server/index.ts` เลย

ถ้าจะอยู่บน serverless จริงๆ ต้องรื้อสองอย่างพร้อมกัน: ย้าย realtime ไป managed service (Pusher/Ably)
และย้ายห้องออกจาก memory ไป store ภายนอก — นั่นคือโปรเจกต์คนละตัว ไม่ใช่การตั้งค่า

## Google Cloud Run

Cloud Run รัน container ยาวและรองรับ WebSocket จึงใช้ได้ แต่ต้องตั้งค่าให้ตรงกับข้อจำกัดของ in-memory state

### ข้อบังคับ — ตั้งผิดแล้วห้องหายกลางเกม

| ค่า | ต้องตั้ง | เหตุผล |
|---|---|---|
| `--max-instances` | **1** | ห้องอยู่ใน memory ของ instance เดียว สองก้อนขึ้นไปคนละคนเข้าคนละห้อง หากันไม่เจอ |
| `--min-instances` | **1** | scale-to-zero = process ตาย = ทุกห้องหาย ต้องมีก้อนค้างไว้เสมอ |
| `--timeout` | **3600** | ค่า default 300 วิ ตัด WebSocket ทิ้งกลางเกม รอบยาวสุด 15 นาที เผื่อไว้ 1 ชั่วโมง |
| `--concurrency` | 80 (ค่า default) | ผู้เล่นทุกคนต้องอยู่ instance เดียวกัน อย่าลดจนถูกบังคับ scale out |
| `--session-affinity` | ไม่จำเป็น | มี instance เดียวอยู่แล้ว ตั้งไว้ก็ไม่เสียหาย |

`--min-instances=1` แปลว่ามีค่าใช้จ่ายตลอดเวลาแม้ไม่มีคนเล่น — เป็นราคาที่ต้องจ่ายของ in-memory state

### คำสั่ง

```bash
PROJECT=$(gcloud config get-value project)
REGION=asia-southeast1        # สิงคโปร์ ใกล้ไทยที่สุด

gcloud run deploy kham-tong-ham \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --timeout 3600 \
  --memory 512Mi \
  --cpu 1
```

`--source .` ให้ Cloud Build สร้าง image จาก `Dockerfile` ในโปรเจกต์นี้ ไม่ต้องมี Docker บนเครื่อง
ครั้งแรกจะถูกถามให้เปิด Cloud Build API และสร้าง Artifact Registry repo — ตอบ yes

### ตรวจหลัง deploy

```bash
URL=$(gcloud run services describe kham-tong-ham --region "$REGION" --format='value(status.url)')
curl -s "$URL/api/socket/?EIO=4&transport=polling" | head -c 80
```

ต้องได้ JSON ขึ้นต้นด้วย `0{"sid":"..."` ถ้าได้ 308 หรือ 404 แปลว่า container ไม่ได้รัน `server/index.ts`

### ข้อจำกัดที่ยังอยู่

- **Deploy ใหม่ = ทุกห้องหาย** Cloud Run เปลี่ยน revision คือขึ้น container ใหม่ ไม่มีการย้าย state
  deploy ตอนไม่มีคนเล่นเท่านั้น
- **Rate limit ใช้ IP จาก socket** ซึ่งหลัง proxy ของ Cloud Run จะเป็น IP ของ proxy ไม่ใช่ของผู้เล่น
  เพดาน 3 ห้อง/นาที จึงกลายเป็นเพดานรวมทั้งระบบ ถ้าเป็นปัญหาค่อยอ่าน `X-Forwarded-For`

## ทางเลือกอื่น

Railway / Fly.io / Docker บน VPS ใช้ `Dockerfile` เดียวกันนี้ได้ทันที
ข้อบังคับ instance เดียวยังใช้เหมือนกันทุกที่ — อย่าเปิด autoscaling
