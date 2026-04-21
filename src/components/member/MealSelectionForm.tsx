'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MealSlot, ComponentType, Recipe } from '@/lib/types'
import { COMPONENT_CONFIG } from '@/lib/types'
import Image from 'next/image'

interface ComponentWithRecipe {
  id: string
  recipe_id: string
  type: ComponentType
  name: string
  display_order: number
  recipes: { id: string; title: string; photo_url: string | null; type: string; servings: number }
}

interface CombinationInfo {
  id: string
  times_eaten: number
  avg_rating: number | null
  is_new: boolean
}

interface Props {
  slot: MealSlot
  components: ComponentWithRecipe[]
  allInOneRecipes: Recipe[]
  userId: string
}

type SelectionMode = 'split' | 'all_in_one'

export default function MealSelectionForm({ slot, components, allInOneRecipes, userId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<SelectionMode>('split')
  const [selected, setSelected] = useState<Partial<Record<ComponentType, string>>>({})
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [combinationInfo, setCombinationInfo] = useState<CombinationInfo | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const componentsByType = {
    starch: components.filter(c => c.type === 'starch'),
    meat: components.filter(c => c.type === 'meat'),
    vegetable: components.filter(c => c.type === 'vegetable'),
    sauce: components.filter(c => c.type === 'sauce'),
  }

  const hasSplitComponents = Object.values(componentsByType).some(arr => arr.length > 0)
  const hasAllInOne = allInOneRecipes.length > 0

  const hasAnySelected = mode === 'split'
    ? (selected.starch || selected.meat || selected.vegetable)
    : !!selectedRecipeId

  async function handlePreview() {
    setError('')
    if (mode === 'split') {
      if (!selected.starch && !selected.meat && !selected.vegetable) {
        setError('請至少選擇一項（主食、肉或蔬菜）')
        return
      }

      // Look up combination info before confirming
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('meal_combinations')
        .select('id, times_eaten, combination_ratings(rating)')
        .match({
          starch_component_id: selected.starch ?? null,
          meat_component_id: selected.meat ?? null,
          veggie_component_id: selected.vegetable ?? null,
          sauce_component_id: selected.sauce ?? null,
        })
        .maybeSingle()

      if (existing) {
        const ratings = (existing.combination_ratings as { rating: number }[]) ?? []
        const avg = ratings.length > 0
          ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
          : null
        setCombinationInfo({ id: existing.id, times_eaten: existing.times_eaten, avg_rating: avg, is_new: false })
      } else {
        setCombinationInfo({ id: '', times_eaten: 0, avg_rating: null, is_new: true })
      }
      setPreviewMode(true)
    } else {
      if (!selectedRecipeId) { setError('請選擇一道一鍋到底料理'); return }
      setPreviewMode(true)
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    const supabase = createClient()

    let combinationId: string | null = null

    if (mode === 'split') {
      const { data } = await supabase.rpc('get_or_create_combination', {
        p_starch: selected.starch ?? null,
        p_meat: selected.meat ?? null,
        p_veggie: selected.vegetable ?? null,
        p_sauce: selected.sauce ?? null,
      })
      combinationId = data as string | null
    }

    const { error: insertError } = await supabase.from('meal_selections').insert({
      meal_slot_id: slot.id,
      user_id: userId,
      selection_type: mode,
      starch_component_id: mode === 'split' ? (selected.starch ?? null) : null,
      meat_component_id: mode === 'split' ? (selected.meat ?? null) : null,
      veggie_component_id: mode === 'split' ? (selected.vegetable ?? null) : null,
      sauce_component_id: mode === 'split' ? (selected.sauce ?? null) : null,
      recipe_id: mode === 'all_in_one' ? selectedRecipeId : null,
      combination_id: combinationId,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('這天剛被其他人選走了，請選擇其他天')
        setTimeout(() => router.push('/'), 2000)
      } else {
        setError('送出失敗：' + insertError.message)
      }
      setSubmitting(false)
      setPreviewMode(false)
      return
    }

    router.push('/')
  }

  // ── Preview confirmation screen ──────────────────────────────
  if (previewMode) {
    const selectedComponents = (Object.entries(selected) as [ComponentType, string][])
      .filter(([, id]) => id)
      .map(([type, id]) => {
        const comp = components.find(c => c.id === id)
        return { type, comp }
      })

    const selectedRecipe = allInOneRecipes.find(r => r.id === selectedRecipeId)

    return (
      <div className="pb-32">
        <button onClick={() => setPreviewMode(false)} className="text-sm text-gray-400 mb-4">← 返回修改</button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">確認你的選擇</h1>
        <p className="text-sm text-gray-400 mb-5">{slot.weekday}・{slot.slot_date}</p>

        {mode === 'split' ? (
          <div className="space-y-2 mb-5">
            {selectedComponents.map(({ type, comp }) => {
              const config = COMPONENT_CONFIG[type]
              return (
                <div key={type} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${config.bg} ${config.border}`}>
                  <span className="text-lg">{config.emoji}</span>
                  <div>
                    <p className={`text-sm font-medium ${config.color}`}>{comp?.name}</p>
                    <p className="text-xs text-gray-400">{comp?.recipes?.title}</p>
                  </div>
                </div>
              )
            })}
            {!selected.sauce && (
              <p className="text-xs text-gray-400 pl-2">醬料：未選</p>
            )}
          </div>
        ) : (
          <div className="mb-5 px-4 py-3 rounded-2xl border border-gray-200 bg-white flex items-center gap-3">
            <span className="text-2xl">🥘</span>
            <p className="font-medium text-gray-800">{selectedRecipe?.title}</p>
          </div>
        )}

        {/* Combination info */}
        {mode === 'split' && combinationInfo && (
          <div className={`rounded-2xl p-4 mb-5 border ${combinationInfo.is_new ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
            {combinationInfo.is_new ? (
              <div className="flex items-center gap-2">
                <span className="text-lg">🆕</span>
                <div>
                  <p className="text-sm font-semibold text-orange-700">全新組合！</p>
                  <p className="text-xs text-orange-500">這個搭配從來沒有被做過，期待你的評分</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    這個組合已被做過 {combinationInfo.times_eaten} 次
                  </p>
                  <p className="text-xs text-gray-500">
                    {combinationInfo.avg_rating
                      ? `平均評分 ${'⭐'.repeat(Math.round(combinationInfo.avg_rating))} ${combinationInfo.avg_rating.toFixed(1)}`
                      : '尚無評分記錄'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-inset-bottom">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {submitting ? '送出中...' : '確認送出'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Selection screen ──────────────────────────────────────────
  return (
    <div className="pb-32">
      <div className="mb-5">
        <button onClick={() => router.back()} className="text-sm text-gray-400 mb-2">← 返回</button>
        <h1 className="text-xl font-bold text-gray-900">選擇 {slot.weekday} 的晚餐</h1>
        <p className="text-sm text-gray-400">{slot.slot_date}</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        {hasSplitComponents && (
          <button onClick={() => { setMode('split'); setSelected({}) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${mode === 'split' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            🍱 分開組合
          </button>
        )}
        {hasAllInOne && (
          <button onClick={() => { setMode('all_in_one'); setSelectedRecipeId(null) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${mode === 'all_in_one' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            🥘 一鍋到底
          </button>
        )}
      </div>

      {/* Split mode */}
      {mode === 'split' && (
        <div className="space-y-4">
          {(Object.entries(componentsByType) as [ComponentType, ComponentWithRecipe[]][])
            .filter(([, items]) => items.length > 0)
            .map(([type, items]) => {
              const config = COMPONENT_CONFIG[type]
              return (
                <div key={type} className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}>
                  <h3 className={`text-sm font-semibold ${config.color} mb-3`}>
                    {config.emoji} {config.label}
                    <span className="text-xs font-normal ml-1 opacity-70">
                      {type === 'sauce' ? '（選配）' : '（可選）'}
                    </span>
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
                    {items.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => setSelected(s => ({ ...s, [type]: s[type] === comp.id ? undefined : comp.id }))}
                        className={`flex-shrink-0 snap-start w-28 rounded-xl border-2 p-2 text-left transition-all ${
                          selected[type] === comp.id
                            ? 'border-orange-400 bg-white shadow-md'
                            : 'border-transparent bg-white/70 hover:bg-white'
                        }`}
                      >
                        {comp.recipes?.photo_url ? (
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-1.5">
                            <Image src={comp.recipes.photo_url} alt={comp.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center mb-1.5">
                            <span className="text-2xl">{config.emoji}</span>
                          </div>
                        )}
                        <p className="text-xs font-medium text-gray-800 leading-tight">{comp.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{comp.recipes?.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* All-in-one mode */}
      {mode === 'all_in_one' && (
        <div className="space-y-2">
          {allInOneRecipes.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(r => r === recipe.id ? null : recipe.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                selectedRecipeId === recipe.id
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              {recipe.photo_url ? (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={recipe.photo_url} alt={recipe.title} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🥘</span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{recipe.title}</p>
                {recipe.description && <p className="text-sm text-gray-400 mt-0.5">{recipe.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}

      {/* Sticky next button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handlePreview}
            disabled={!hasAnySelected}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            下一步：確認選擇
          </button>
        </div>
      </div>
    </div>
  )
}
