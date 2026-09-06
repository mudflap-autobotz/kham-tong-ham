import './globals.css'
import { Suspense } from 'react'
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
      <body>
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
