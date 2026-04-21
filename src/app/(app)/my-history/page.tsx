import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { COMPONENT_CONFIG } from '@/lib/types'

export default async function MyHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: selections } = await supabase
    .from('meal_selections')
    .select(`
      id, selection_type, created_at,
      starch_component:recipe_components!starch_component_id(name, type),
      meat_component:recipe_components!meat_component_id(name, type),
      veggie_component:recipe_components!veggie_component_id(name, type),
      sauce_component:recipe_components!sauce_component_id(name, type),
      recipe:recipes!recipe_id(title),
      combination_ratings(rating),
      recipe_ratings(rating),
      meal_slots!inner(
        slot_date, weekday,
        week_plans!inner(id, week_start, status)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Group by week plan
  type WeekGroup = {
    weekPlan: { id: string; week_start: string; status: string }
    selections: any[]
  }
  const weekOrder: string[] = []
  const weekMap: Record<string, WeekGroup> = {}

  for (const sel of selections ?? []) {
    const slot = sel.meal_slots as any
    const weekPlan = slot?.week_plans
    if (!weekPlan) continue
    if (!weekMap[weekPlan.id]) {
      weekMap[weekPlan.id] = { weekPlan, selections: [] }
      weekOrder.push(weekPlan.id)
    }
    weekMap[weekPlan.id].selections.push(sel)
  }

  const weekGroups = weekOrder.map(id => weekMap[id])

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">我的選餐歷史</h1>

      {weekGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <p>還沒有選餐記錄</p>
        </div>
      ) : weekGroups.map(({ weekPlan, selections: sels }) => (
        <div key={weekPlan.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-800">{weekPlan.week_start} 起</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                weekPlan.status === 'closed'
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-green-100 text-green-600'
              }`}>
                {weekPlan.status === 'closed' ? '已關閉' : '進行中'}
              </span>
            </div>
            <span className="text-xs text-gray-400">{sels.length} 餐</span>
          </div>

          <ul className="divide-y divide-gray-50">
            {sels
              .sort((a: any, b: any) => {
                const dateA = (a.meal_slots as any)?.slot_date ?? ''
                const dateB = (b.meal_slots as any)?.slot_date ?? ''
                return dateA.localeCompare(dateB)
              })
              .map((sel: any) => {
                const slot = sel.meal_slots as any
                const rating = sel.combination_ratings?.[0]?.rating ?? sel.recipe_ratings?.[0]?.rating
                const label = buildLabel(sel)

                return (
                  <li key={sel.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">{slot?.weekday}・{slot?.slot_date}</p>
                      <p className="text-sm text-gray-800 leading-snug">{label}</p>
                    </div>
                    {rating ? (
                      <span className="text-sm text-amber-500 flex-shrink-0 mt-0.5">
                        {'⭐'.repeat(rating)}
                      </span>
                    ) : weekPlan.status === 'closed' ? (
                      <span className="text-xs text-gray-300 flex-shrink-0 mt-1">未評分</span>
                    ) : null}
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function buildLabel(sel: any): string {
  if (sel.selection_type === 'all_in_one') {
    return sel.recipe?.title ?? '一鍋到底'
  }
  const parts: string[] = []
  for (const key of ['starch_component', 'meat_component', 'veggie_component', 'sauce_component']) {
    const comp = sel[key]
    if (comp) {
      const config = COMPONENT_CONFIG[comp.type as keyof typeof COMPONENT_CONFIG]
      parts.push(`${config?.emoji ?? ''}${comp.name}`)
    }
  }
  return parts.join(' + ') || '自由組合'
}
