# ---- deps: ติดตั้งครบทั้ง dev เพื่อใช้ build ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: next build ต้องใช้ tailwind/typescript ที่อยู่ใน devDependencies ----
FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime: เอาเฉพาะ dependencies ที่รันจริง ----
FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run ส่ง PORT มาเอง ค่านี้ไว้ใช้ตอนรันด้วย docker run เปล่าๆ
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# server/index.ts รันผ่าน tsx จึงต้องมี source ของ server ติดไปด้วย ไม่ใช่แค่ .next
COPY --from=build /app/.next ./.next
COPY next.config.ts tsconfig.json constants.ts ./
COPY server ./server
COPY src ./src
# packs.ts อ่านไฟล์นี้ตอน runtime ด้วย readFileSync ไม่ได้ถูก bundle เข้า .next
COPY data ./data

# ไม่รันด้วย root — image ของ node มี user นี้มาให้แล้ว
USER node
EXPOSE 8080
CMD ["npm", "start"]
