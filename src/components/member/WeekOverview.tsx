'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { WeekPlan, MealSlotWithSelection } from '@/lib/types'
import SlotCard from './SlotCard'

interface WeekOverviewProps {
  weekPlan: WeekPlan
  slots: MealSlotWithSelection[]
  currentUserId: string
}

export default function WeekOverview({ weekPlan, slots: initialSlots, currentUserId }: WeekOverviewProps) {
  const [slots, setSlots] = useState(initialSlots)
  const router = useRouter()

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
    const slotIds = slots.map(s => s.id)

    const channel = supabase
      .channel(`week-${weekPlan.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_selections',
      }, () => {
        refreshSlots()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [weekPlan.id, slots, refreshSlots])

  const weekStartDate = new Date(weekPlan.week_start + 'T00:00:00')
  const weekLabel = weekStartDate.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">本週晚餐選擇</h1>
        <p className="text-sm text-gray-400 mt-1">{weekLabel} 起的一週</p>
      </div>

      <div className="space-y-3">
        {slots.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            currentUserId={currentUserId}
            onSelect={() => router.push(`/select/${slot.id}`)}
            onCancel={async () => {
              const selection = slot.meal_selections
              if (!selection) return
              if (!confirm(`確定要取消 ${slot.weekday} 的選擇嗎？`)) return
              const supabase = createClient()
              const { error } = await supabase
                .from('meal_selections')
                .delete()
                .eq('id', selection.id)
              if (error) {
                alert('取消失敗：' + error.message)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}
