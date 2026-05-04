export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import crypto from 'crypto'

async function sendSms(text: string) {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const from = process.env.SMS_FROM
  const to = process.env.SMS_TO

  if (!apiKey || !apiSecret || !from || !to) return

  const recipients = to.split(',').map((n) => n.trim()).filter(Boolean)
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')

  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`

  await Promise.allSettled(
    recipients.map((recipient) =>
      fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ message: { to: recipient, from, text } }),
      })
    )
  )
}

export async function POST(req: NextRequest) {
  const { name, is_soldout, silent } = await req.json()

  // silent=true이면 SMS 발송 안 함 (전체 판매재개 등)
  const isSpecialAlert = name.startsWith('[쿠키앤모어] ⚠️') || name.startsWith('[쿠키앤모어] 🚨')
  const title = isSpecialAlert ? name : (is_soldout ? '🔴 품절 알림' : '🟢 판매 재개 알림')
  const body = isSpecialAlert ? name : (is_soldout ? `[쿠키앤모어] 품절: ${name}` : `[쿠키앤모어] 판매재개: ${name}`)

  if (!silent) {
    await sendSms(isSpecialAlert ? name : body)
  }

  // Web Push 발송 (구독자 있을 경우)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    webpush.setVapidDetails(
      'mailto:admin@cookiemore.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (subs && subs.length > 0) {
      await Promise.allSettled(
        subs.map((row) =>
          webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ title, body }))
        )
      )
    }
  } catch {}

  return NextResponse.json({ ok: true })
}
