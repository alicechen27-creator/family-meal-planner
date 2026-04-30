'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'

const TAB_ITEMS = [
  { href: '/', label: '本週', emoji: '📅', exact: true },
  { href: '/recipes', label: '食譜庫', emoji: '📖' },
  { href: '/my-history', label: '我的歷史', emoji: '📋' },
]

const HUB_URL = 'https://hub.leanalice.com/dashboard'

interface Props {
  profile: Profile | null
  isAdmin?: boolean
}

export default function MemberNav({ profile, isAdmin }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const hideBottomTabs = pathname.startsWith('/select/')

  return (
    <>
      <header className="sticky top-0 z-40 h-12 bg-white/90 backdrop-blur-sm border-b border-zinc-100 print:hidden">
        <div className="max-w-lg mx-auto px-4 h-full flex items-center justify-between">
          <a
            href={HUB_URL}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <span>🏠</span>
            <span>家庭總覽</span>
          </a>
          <span className="text-sm font-semibold text-zinc-700">🍽️ 週晚餐</span>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/admin" className="text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors">
                管理
              </Link>
            )}
            <Link
              href="/set-password"
              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              修改密碼
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              登出
            </button>
            {profile?.display_name && (
              <span className="sr-only">{profile.display_name}</span>
            )}
          </div>
        </div>
      </header>

      {!hideBottomTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 print:hidden">
          <div className="flex max-w-lg mx-auto">
            {TAB_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                  isActive(item.href, item.exact) ? 'text-orange-600' : 'text-gray-400'
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}
