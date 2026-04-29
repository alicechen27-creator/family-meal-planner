import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireAdminMealAccess() {
  return requireMealAccess({ admin: true })
}

export async function requireMealAccess(options: { admin?: boolean } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, app_access')
    .eq('id', user.id)
    .single()

  const appAccess = (profile?.app_access ?? []) as string[]
  if (!appAccess.includes('meal_planner') || (options.admin && profile?.role !== 'admin')) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, supabase, user, profile }
}

export function safeInternalUrl(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/'
}
