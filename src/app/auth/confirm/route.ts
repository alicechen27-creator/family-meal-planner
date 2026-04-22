import type { EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  // Railway 等反向代理後面，request.url 的 host 是內部 localhost:3000。
  // 改用 x-forwarded-host/proto 組出對外公開的 origin，redirect 才不會
  // 跳回 localhost。
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    const err = encodeURIComponent(error.message)
    return NextResponse.redirect(new URL(`/login?error=${err}`, origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
