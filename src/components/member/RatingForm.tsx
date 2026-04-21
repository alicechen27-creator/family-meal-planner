'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  selectionId: string
  selectionType: 'split' | 'all_in_one'
  combinationId: string | null
  recipeId: string | null
  userId: string
  label: string
}

export default function RatingForm({ selectionId, selectionType, combinationId, recipeId, userId, label }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (rating === 0) { setError('請選擇評分'); return }
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    if (selectionType === 'split' && combinationId) {
      const { error: ratingError } = await supabase.from('combination_ratings').insert({
        combination_id: combinationId,
        meal_selection_id: selectionId,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
      })
      if (ratingError) {
        setError('評分失敗：' + ratingError.message)
        setSubmitting(false)
        return
      }
    } else if (selectionType === 'all_in_one' && recipeId) {
      const { error: ratingError } = await supabase.from('recipe_ratings').insert({
        recipe_id: recipeId,
        meal_selection_id: selectionId,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
      })
      if (ratingError) {
        setError('評分失敗：' + ratingError.message)
        setSubmitting(false)
        return
      }
    }

    router.push('/')
    router.refresh()
  }

  const displayRating = hovered || rating

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">為這餐評分</h2>
        <p className="text-sm text-gray-500">{label}</p>
      </div>

      {/* Star rating */}
      <div className="flex gap-3 justify-center">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="text-4xl transition-transform hover:scale-110 active:scale-95"
          >
            {star <= displayRating ? '⭐' : '☆'}
          </button>
        ))}
      </div>

      {rating > 0 && (
        <p className="text-center text-sm text-gray-500">
          {['', '很難吃', '還好', '普通', '好吃', '超好吃！'][rating]}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">留言（選填）</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="這個組合怎麼樣？有什麼建議嗎？"
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
        >
          {submitting ? '送出中...' : '送出評分'}
        </button>
      </div>
    </div>
  )
}
