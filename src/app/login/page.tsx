'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // 偵測 URL hash 中的 token（invite / magic link）
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.substring(1))

    const errorCode = params.get('error_code')
    if (errorCode === 'otp_expired') {
      setError('邀請連結已過期，請聯絡管理員重新寄送邀請信。')
      return
    }
    if (params.get('error')) {
      setError('連結無效，請重新索取邀請。')
      return
    }

    // 有 access_token 且是 invite → 導到設定密碼頁
    const accessToken = params.get('access_token')
    const type = params.get('type')
    if (accessToken && type === 'invite') {
      router.replace('/set-password' + hash)
    }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('信箱尚未完成驗證，請點擊邀請信內的連結啟用帳號後再登入')
      } else if (error.message.includes('Invalid login credentials')) {
        setError('帳號或密碼錯誤，請再試一次')
      } else {
        setError('登入失敗：' + error.message)
      }
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-900">家庭週晚餐規劃</h1>
          <p className="text-gray-500 mt-1 text-sm">一起選這週吃什麼</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">信箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          還沒有帳號？{' '}
          <a href="/signup" className="text-orange-500 hover:underline">建立帳號</a>
        </p>
      </div>
    </div>
  )
}
