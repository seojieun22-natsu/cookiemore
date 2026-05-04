export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import crypto from 'crypto'

async function sendSms(text: string, recipients: string[]) {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const from = process.env.SMS_FROM

  if (!apiKey || !apiSecret || !from || recipients.length === 0) return

  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`

  await Promise.allSettled(
    recipients.map((to) =>
      fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ message: { to, from, text } }),
      })
    )
  )
}

export async function POST(req: NextRequest) {
  const { names, is_soldout, silent } = await req.json()

  if (silent) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 수신자 목록 가져오기 (DB 우선, 없으면 env fallback)
  const { data: recipientRows } = await supabase.from('sms_recipients').select('phone')
  const dbRecipients = recipientRows?.map((r) => r.phone) ?? []
  const envRecipients = (process.env.SMS_TO ?? '').split(',').map((n) => n.trim()).filter(Boolean)
  const recipients = dbRecipients.length > 0 ? dbRecipients : envRecipients

  const nameList = Array.isArray(names) ? names : [names]
  const isSpecial = nameList.length === 1 && (nameList[0].startsWith('[쿠키앤모어] ⚠️') || nameList[0].startsWith('[쿠키앤모어] 🚨'))

  let smsText: string
  if (isSpecial) {
    smsText = nameList[0]
  } else if (is_soldout) {
    smsText = nameList.length === 1
      ? `[쿠키앤모어] 품절: ${nameList[0]}`
      : `[쿠키앤모어] 품절 (${nameList.length}종)\n${nameList.map((n) => `• ${n.replace('쿠키앤모어 ', '')}`).join('\n')}`
  } else {
    smsText = nameList.length === 1
      ? `[쿠키앤모어] 판매재개: ${nameList[0]}`
      : `[쿠키앤모어] 판매재개 (${nameList.length}종)\n${nameList.map((n) => `• ${n.replace('쿠키앤모어 ', '')}`).join('\n')}`
  }

  await sendSms(smsText, recipients)

  // Web Push
  try {
    webpush.setVapidDetails('mailto:admin@cookiemore.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (subs && subs.length > 0) {
      const title = is_soldout ? '🔴 품절 알림' : '🟢 판매 재개 알림'
      await Promise.allSettled(
        subs.map((row) => webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ title, body: smsText })))
      )
    }
  } catch {}

  return NextResponse.json({ ok: true })
}
