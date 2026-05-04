export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@cookiemore.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  const { name, is_soldout } = await req.json()

  const title = is_soldout ? '🔴 품절 알림' : '🟢 판매 재개 알림'
  const body = is_soldout
    ? `${name} 품절 처리됐습니다.`
    : `${name} 판매 재개됐습니다.`

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const results = await Promise.allSettled(
    subs.map((row) => {
      const sub = JSON.parse(row.subscription)
      return webpush.sendNotification(sub, JSON.stringify({ title, body }))
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sent })
}
