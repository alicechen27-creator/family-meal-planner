'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/admin', label: '總覽', emoji: '📊', exact: true },
  { href: '/admin/recipes', label: '食譜庫', emoji: '📖' },
  { href: '/admin/cook', label: '本週食譜', emoji: '👨‍🍳' },
  { href: '/admin/week/new', label: '建立本週', emoji: '📅' },
  { href: '/admin/inventory', label: '食材庫存', emoji: '🧺' },
  { href: '/admin/recommend', label: 'AI 推薦', emoji: '✨' },
  { href: '/admin/history', label: '歷史記錄', emoji: '📋' },
  { href: '/', label: '成員視角', emoji: '👤', exact: true },
]

export default function AdminNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 flex-col z-40">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🍽️</span>
            <span className="font-bold text-gray-800">管理後台</span>
          </div>
          <span className="text-xs text-gray-400">{profile?.display_name}</span>
        </div>
        <div className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive(item.href, item.exact)
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.emoji}</span>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <Link
            href="/set-password"
            className="block w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            修改密碼
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            登出
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className="font-semibold text-gray-800">管理後台</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/set-password" className="text-xs text-gray-400">修改密碼</Link>
            <button onClick={handleLogout} className="text-xs text-gray-400">登出</button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100">
        <div className="flex">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive(item.href, item.exact)
                  ? 'text-orange-600'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
