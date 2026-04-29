import { NextResponse } from 'next/server'
import { requireMealAccess } from '@/lib/authz'

export async function POST(req: Request) {
  const auth = await requireMealAccess()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const subscription = await req.json()
  if (
    typeof subscription?.endpoint !== 'string' ||
    typeof subscription?.keys?.p256dh !== 'string' ||
    typeof subscription?.keys?.auth !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await requireMealAccess()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { endpoint } = await req.json()
  if (typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'invalid endpoint' }, { status: 400 })
  }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
