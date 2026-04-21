'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Recipe {
  id: string
  title: string
  type: 'split' | 'all_in_one'
  description: string | null
}

interface Props {
  weekPlanId: string
  allRecipes: Recipe[]
  initialSelectedIds: string[]
}

export default function RecipeSelector({ weekPlanId, allRecipes, initialSelectedIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds))
  const [aiHighlighted, setAiHighlighted] = useState<Set<string>>(new Set())
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({})
  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const splitRecipes = allRecipes.filter(r => r.type === 'split')
  const aioRecipes = allRecipes.filter(r => r.type === 'all_in_one')
  const isAllSelected = allRecipes.length > 0 && selected.size === 0

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  function toggleAll() {
    // If nothing selected (= all open), select all explicitly so user can narrow down
    // If something selected, clear to go back to "all open"
    if (selected.size === 0) {
      setSelected(new Set(allRecipes.map(r => r.id)))
    } else {
      setSelected(new Set())
    }
    setSaved(false)
  }

  async function fetchAI() {
    setLoadingAI(true)
    try {
      const res = await fetch('/api/recommend-recipes', { method: 'POST' })
      const json = await res.json()
      const recs: { recipe_id: string; reason: string }[] = json.recommendations ?? []
      const ids = new Set(recs.map(r => r.recipe_id))
      const reasons: Record<string, string> = {}
      recs.forEach(r => { reasons[r.recipe_id] = r.reason })
      setAiHighlighted(ids)
      setAiReasons(reasons)
      // Auto-check AI recommended
      setSelected(prev => new Set([...prev, ...ids]))
      setSaved(false)
    } catch {
      // silently fail
    } finally {
      setLoadingAI(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('week_plan_recipes').delete().eq('week_plan_id', weekPlanId)
    if (selected.size > 0) {
      await supabase.from('week_plan_recipes').insert(
        Array.from(selected).map(recipe_id => ({ week_plan_id: weekPlanId, recipe_id }))
      )
    }
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      {/* Status + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">
          {selected.size === 0
            ? '目前全部食譜皆開放（未限定）'
            : `已選 ${selected.size} / ${allRecipes.length} 道食譜`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={fetchAI}
            disabled={loadingAI}
            className="text-xs px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            {loadingAI ? 'AI 分析中...' : '✨ AI 建議'}
          </button>
          <button
            onClick={toggleAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {selected.size === 0 ? '全選（限定）' : '清除（全部開放）'}
          </button>
        </div>
      </div>

      {/* Split recipes */}
      {splitRecipes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">分開組合食譜</p>
          <div className="space-y-1.5">
            {splitRecipes.map(r => (
              <RecipeRow
                key={r.id}
                recipe={r}
                checked={selected.size === 0 || selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aiHighlighted={aiHighlighted.has(r.id)}
                aiReason={aiReasons[r.id]}
                dimmed={selected.size > 0 && !selected.has(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All-in-one recipes */}
      {aioRecipes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">一鍋到底食譜</p>
          <div className="space-y-1.5">
            {aioRecipes.map(r => (
              <RecipeRow
                key={r.id}
                recipe={r}
                checked={selected.size === 0 || selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aiHighlighted={aiHighlighted.has(r.id)}
                aiReason={aiReasons[r.id]}
                dimmed={selected.size > 0 && !selected.has(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 bg-orange-500 hover:bg-orange-600 text-white"
      >
        {saving ? '儲存中...' : saved ? '✓ 已儲存' : '儲存可選食譜設定'}
      </button>

      {selected.size === 0 && (
        <p className="text-xs text-center text-gray-400">
          未限定時，成員可從所有食譜中選擇
        </p>
      )}
    </div>
  )
}

function RecipeRow({
  recipe, checked, onChange, aiHighlighted, aiReason, dimmed,
}: {
  recipe: Recipe
  checked: boolean
  onChange: () => void
  aiHighlighted: boolean
  aiReason?: string
  dimmed: boolean
}) {
  return (
    <label className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
      dimmed ? 'opacity-40 bg-white border-gray-100' :
      aiHighlighted ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-gray-200'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-orange-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{recipe.title}</span>
          {aiHighlighted && (
            <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">✨ AI 推薦</span>
          )}
        </div>
        {aiReason && (
          <p className="text-xs text-orange-600 mt-0.5">{aiReason}</p>
        )}
        {recipe.description && !aiReason && (
          <p className="text-xs text-gray-400 truncate">{recipe.description}</p>
        )}
      </div>
    </label>
  )
}
