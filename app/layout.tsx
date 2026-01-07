import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GPON Network Simulator',
  description: 'GPON Network Simulator - Cisco Packet Tracer analog for GPON networks',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}

