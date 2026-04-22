'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      // 新 flow: session 已由 /auth/confirm 建好
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
        return
      }

      // 舊 flow fallback: URL hash 帶 access_token（for 尚未過期的舊邀請）
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            setReady(true)
            return
          }
        }
      }

      setError('無效或已過期的連結，請聯絡管理員重新寄送邀請')
    }
    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('兩次密碼不一致')
      return
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('設定失敗：' + error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-900">設定密碼</h1>
          <p className="text-gray-500 mt-1 text-sm">家庭週晚餐規劃</p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm text-center">
            {error}
          </div>
        ) : !ready ? (
          <div className="text-center text-gray-400 text-sm">驗證中...</div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                placeholder="至少 6 個字元"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">確認密碼</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                placeholder="再輸入一次"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading ? '儲存中...' : '儲存密碼'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
