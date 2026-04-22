import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { weekPlanId } = await req.json()
  if (!weekPlanId) return NextResponse.json({ error: 'weekPlanId required' }, { status: 400 })

  // Server-side verification: only proceed if the week is actually full.
  // Uses service role to bypass RLS for admin push_subscriptions lookup.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { count: availableCount } = await admin
    .from('meal_slots')
    .select('id', { count: 'exact', head: true })
    .eq('week_plan_id', weekPlanId)
    .eq('is_available', true)

  const { data: filledSlots } = await admin
    .from('meal_selections')
    .select('meal_slot_id, meal_slots!inner(week_plan_id, is_available)')
    .eq('meal_slots.week_plan_id', weekPlanId)
    .eq('meal_slots.is_available', true)

  const filledCount = filledSlots?.length ?? 0
  if (!availableCount || filledCount < availableCount) {
    return NextResponse.json({ sent: 0, reason: 'week not full' })
  }

  // Idempotency: mark week_plan as already-notified so duplicate triggers don't re-send.
  const { data: marked } = await admin
    .from('week_plans')
    .update({ notified_full_at: new Date().toISOString() })
    .eq('id', weekPlanId)
    .is('notified_full_at', null)
    .select('id')
    .maybeSingle()

  if (!marked) {
    return NextResponse.json({ sent: 0, reason: 'already notified' })
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@meal-planner.app'
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
  const adminIds = (admins ?? []).map(a => a.id)
  if (adminIds.length === 0) return NextResponse.json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', adminIds)

  const payload = JSON.stringify({
    title: '本週選餐已全部完成',
    body: '成員已選完所有日期，可以開始準備採購清單。',
    url: '/admin',
    tag: 'week-full',
  })

  const results = await Promise.allSettled(
    (subs ?? []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
