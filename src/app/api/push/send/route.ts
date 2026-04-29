import webpush from 'web-push'
import { NextResponse } from 'next/server'
import { requireAdminMealAccess, safeInternalUrl } from '@/lib/authz'

export async function POST(req: Request) {
  const auth = await requireAdminMealAccess()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@meal-planner.app'

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const { title, body, url } = await req.json()
  if (typeof title !== 'string' || typeof body !== 'string' || title.length > 80 || body.length > 240) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .neq('user_id', user.id) // Don't notify the admin who just acted

  const payload = JSON.stringify({ title, body, url: safeInternalUrl(url), tag: 'week-plan' })
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
