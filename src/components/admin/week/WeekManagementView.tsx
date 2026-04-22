'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { WeekPlan, MealSlotWithSelection } from '@/lib/types'
import { COMPONENT_CONFIG } from '@/lib/types'
import Link from 'next/link'
import RecipeSelector from './RecipeSelector'

interface AvailableComponent {
  id: string
  name: string
  type: string
  recipes: { id: string; title: string } | { id: string; title: string }[] | null
}

interface Props {
  weekPlan: WeekPlan
  initialSlots: MealSlotWithSelection[]
  availableComponents: AvailableComponent[]
  allInOneRecipes: { id: string; title: string }[]
  allRecipes: { id: string; title: string; type: 'split' | 'all_in_one'; description: string | null }[]
  initialSelectedRecipeIds: string[]
}

export default function WeekManagementView({ weekPlan, initialSlots, availableComponents, allInOneRecipes, allRecipes, initialSelectedRecipeIds }: Props) {
  const [slots, setSlots] = useState(initialSlots)
  const [closing, setClosing] = useState(false)
  const [allFilledNotified, setAllFilledNotified] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showRecipeSelector, setShowRecipeSelector] = useState(false)
  const router = useRouter()

  const availableSlots = slots.filter(s => s.is_available)
  const filledSlots = availableSlots.filter(s => !!s.meal_selections)
  const allFilled = availableSlots.length > 0 && filledSlots.length >= availableSlots.length

  const refreshSlots = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('meal_slots')
      .select(`
        *,
        meal_selections(
          *,
          profiles(id, display_name),
          starch_component:recipe_components!starch_component_id(id, name, type),
          meat_component:recipe_components!meat_component_id(id, name, type),
          veggie_component:recipe_components!veggie_component_id(id, name, type),
          sauce_component:recipe_components!sauce_component_id(id, name, type),
          recipe:recipes!recipe_id(id, title, type)
        )
      `)
      .eq('week_plan_id', weekPlan.id)
      .order('slot_date')
    if (data) setSlots(data as MealSlotWithSelection[])
  }, [weekPlan.id])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-week-${weekPlan.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_selections' }, () => {
        refreshSlots()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [weekPlan.id, refreshSlots])

  useEffect(() => {
    if (allFilled && !allFilledNotified) {
      setAllFilledNotified(true)
    }
  }, [allFilled, allFilledNotified])

  async function handleDeleteSelection(selectionId: string) {
    const supabase = createClient()
    await supabase.from('meal_selections').delete().eq('id', selectionId)
    refreshSlots()
  }

  async function handleCloseWeek() {
    setClosing(true)
    const res = await fetch('/api/generate-shopping-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekPlanId: weekPlan.id }),
    })
    if (res.ok) {
      router.push(`/admin/shopping/${weekPlan.id}`)
    } else {
      setClosing(false)
      alert('關閉失敗，請再試一次')
    }
  }

  function getMealSummary(selection: NonNullable<MealSlotWithSelection['meal_selections']>) {
    if (selection.selection_type === 'all_in_one') {
      return <span className="text-purple-700">🥘 {selection.recipe?.title}</span>
    }
    const parts = [
      selection.starch_component && `🍚 ${selection.starch_component.name}`,
      selection.meat_component && `🥩 ${selection.meat_component.name}`,
      selection.veggie_component && `🥦 ${selection.veggie_component.name}`,
      selection.sauce_component && `🫙 ${selection.sauce_component.name}`,
    ].filter(Boolean).join(' + ')
    return <span className="text-gray-700">{parts}</span>
  }

  if (weekPlan.status === 'closed') {
    return (
      <div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 text-center">
          <p className="text-green-700 font-medium">本週計畫已關閉</p>
          <Link href={`/admin/shopping/${weekPlan.id}`} className="text-green-600 text-sm underline mt-1 block">
            查看採購清單 →
          </Link>
        </div>
        <SlotList slots={slots} getMealSummary={getMealSummary} onDeleteSelection={handleDeleteSelection} readOnly />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">選擇進度</span>
          <span className="text-sm text-gray-500">{filledSlots.length} / {availableSlots.length} 天</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all"
            style={{ width: `${availableSlots.length > 0 ? (filledSlots.length / availableSlots.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {allFilled && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-orange-800 font-semibold mb-1">🎉 所有名額已被選滿！</p>
          <p className="text-sm text-orange-600">可以關閉本週計畫並產生採購清單</p>
        </div>
      )}

      {/* Recipe selector */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <button
          onClick={() => setShowRecipeSelector(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <span>設定本週可選食譜</span>
            {initialSelectedRecipeIds.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                已限定 {initialSelectedRecipeIds.length} 道
              </span>
            )}
          </div>
          <span className="text-gray-400 text-xs">{showRecipeSelector ? '▲ 收起' : '▼ 展開'}</span>
        </button>
        {showRecipeSelector && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <RecipeSelector
              weekPlanId={weekPlan.id}
              allRecipes={allRecipes}
              initialSelectedIds={initialSelectedRecipeIds}
            />
          </div>
        )}
      </div>

      {/* Available options panel */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <button
          onClick={() => setShowOptions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        >
          <span>可選項目</span>
          <span className="text-gray-400 text-xs">{showOptions ? '▲ 收起' : '▼ 展開'}</span>
        </button>
        {showOptions && (
          <AvailableOptions components={availableComponents} allInOneRecipes={allInOneRecipes} />
        )}
      </div>

      <SlotList slots={slots} getMealSummary={getMealSummary} onDeleteSelection={handleDeleteSelection} />

      <button
        onClick={handleCloseWeek}
        disabled={closing}
        className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
      >
        {closing ? '產生採購清單中...' : '關閉本週並產生採購清單'}
      </button>
    </div>
  )
}

const COMP_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  starch:    { label: '主食', emoji: '🍚', color: 'text-yellow-700' },
  meat:      { label: '肉類', emoji: '🥩', color: 'text-red-700' },
  vegetable: { label: '蔬菜', emoji: '🥦', color: 'text-green-700' },
  sauce:     { label: '醬料', emoji: '🫙', color: 'text-orange-700' },
}

function AvailableOptions({ components, allInOneRecipes }: {
  components: AvailableComponent[]
  allInOneRecipes: { id: string; title: string }[]
}) {
  const grouped = components.reduce<Record<string, AvailableComponent[]>>((acc, c) => {
    acc[c.type] = acc[c.type] ?? []
    acc[c.type].push(c)
    return acc
  }, {})

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
      {Object.entries(COMP_TYPE_CONFIG).map(([type, cfg]) => {
        const items = grouped[type]
        if (!items?.length) return null
        return (
          <div key={type}>
            <p className={`text-xs font-semibold mb-1.5 ${cfg.color}`}>{cfg.emoji} {cfg.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map(c => (
                <span key={c.id} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                  {c.name}
                  {(() => {
                    const r = Array.isArray(c.recipes) ? c.recipes[0] : c.recipes
                    return r?.title ? <span className="text-gray-400 ml-1">（{r.title}）</span> : null
                  })()}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      {allInOneRecipes.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5 text-purple-700">🥘 一鍋到底</p>
          <div className="flex flex-wrap gap-1.5">
            {allInOneRecipes.map(r => (
              <span key={r.id} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                {r.title}
              </span>
            ))}
          </div>
        </div>
      )}
      {components.length === 0 && allInOneRecipes.length === 0 && (
        <p className="text-xs text-gray-400">食譜庫尚無可選項目</p>
      )}
    </div>
  )
}

function SlotList({ slots, getMealSummary, onDeleteSelection, readOnly }: {
  slots: MealSlotWithSelection[]
  getMealSummary: (s: NonNullable<MealSlotWithSelection['meal_selections']>) => React.ReactNode
  onDeleteSelection: (id: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="space-y-2">
      {slots.map(slot => {
        const selection = slot.meal_selections
        return (
          <div key={slot.id} className={`bg-white rounded-2xl border p-4 ${!slot.is_available ? 'opacity-40' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{slot.weekday}</span>
                <span className="text-xs text-gray-400">{slot.slot_date}</span>
                {!slot.is_available && <span className="text-xs text-gray-400">（不開放）</span>}
              </div>
              <div className="flex items-center gap-2">
                {slot.is_available && !selection && !readOnly && (
                  <Link
                    href={`/select/${slot.id}`}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg transition-colors"
                  >
                    選擇
                  </Link>
                )}
                {selection && !readOnly && (
                  <button onClick={() => onDeleteSelection(selection.id)}
                    className="text-xs text-red-400 hover:text-red-600">重置</button>
                )}
              </div>
            </div>
            {selection ? (
              <div>
                <span className="text-xs font-medium text-orange-600">{selection.profiles?.display_name}</span>
                <div className="text-sm mt-0.5">{getMealSummary(selection)}</div>
              </div>
            ) : (
              slot.is_available && <p className="text-sm text-gray-300">尚未選擇</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
