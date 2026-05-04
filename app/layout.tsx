import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '쿠키앤모어 재고현황',
  description: '쿠키앤모어 제품 품절 현황 실시간 확인',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
