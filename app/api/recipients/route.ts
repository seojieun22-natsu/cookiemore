export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const { data } = await getSupabase().from('sms_recipients').select('*').order('id')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { label, phone } = await req.json()
  const { data, error } = await getSupabase()
    .from('sms_recipients')
    .insert({ label, phone })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
