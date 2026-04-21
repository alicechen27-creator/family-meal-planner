'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Recipe } from '@/lib/types'
import Image from 'next/image'

interface Recommendation {
  recipe_id: string
  reason: string
  recipe: Recipe
}

export default function RecommendView() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function handleRecommend() {
    setLoading(true)
    setError('')
    setRecommendations(null)
    setSelected(new Set())

    const res = await fetch('/api/recommend-recipes', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? '推薦失敗')
    } else if (data.recommendations.length === 0) {
      setError('食譜庫為空，請先新增食譜')
    } else {
      setRecommendations(data.recommendations)
      setSelected(new Set(data.recommendations.map((r: Recommendation) => r.recipe_id)))
    }
    setLoading(false)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreateWeek() {
    router.push('/admin/week/new')
  }

  return (
    <div className="space-y-4">
      {/* Inventory reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-0.5">AI 會根據家裡庫存推薦食譜</p>
        <p className="text-blue-500 text-xs">先到「食材庫存」更新庫存，推薦結果會更準確</p>
      </div>

      <button
        onClick={handleRecommend}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            AI 分析中...
          </>
        ) : '✨ 取得 AI 推薦'}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <>
          <p className="text-sm text-gray-500 text-center">
            已選 {selected.size} / {recommendations.length} 道，建立本週計畫時可參考
          </p>

          <div className="space-y-3">
            {recommendations.map(rec => (
              <button
                key={rec.recipe_id}
                onClick={() => toggleSelect(rec.recipe_id)}
                className={`w-full flex items-start gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                  selected.has(rec.recipe_id)
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-100 bg-white opacity-60'
                }`}
              >
                {rec.recipe.photo_url ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <Image src={rec.recipe.photo_url} alt={rec.recipe.title} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-2xl">
                    {rec.recipe.type === 'all_in_one' ? '🥘' : '🍱'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{rec.recipe.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      rec.recipe.type === 'all_in_one'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {rec.recipe.type === 'all_in_one' ? '一鍋到底' : '分開組合'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{rec.reason}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  selected.has(rec.recipe_id) ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                }`}>
                  {selected.has(rec.recipe_id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleCreateWeek}
            disabled={creating || selected.size === 0}
            className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {creating ? '建立中...' : '前往建立本週計畫'}
          </button>
        </>
      )}
    </div>
  )
}
