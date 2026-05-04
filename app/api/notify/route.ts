import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, is_soldout } = await req.json()
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_NOTIFY_CHANNEL

  if (!token || !channel) {
    return NextResponse.json({ ok: false, error: 'not configured' })
  }

  const text = is_soldout
    ? `🔴 *품절 처리*: ${name}`
    : `🟢 *판매 재개*: ${name}`

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  })

  return NextResponse.json({ ok: true })
}
