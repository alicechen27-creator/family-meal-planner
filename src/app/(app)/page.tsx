import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekOverview from '@/components/member/WeekOverview'
import Link from 'next/link'
import { COMPONENT_CONFIG } from '@/lib/types'

export default async function MemberHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: weekPlan },
    { data: slots },
    { data: unratedSelections },
  ] = await Promise.all([
    supabase.from('week_plans').select('*').eq('status', 'open')
      .order('week_start', { ascending: false }).limit(1).maybeSingle(),
    // slots fetched separately after weekPlan
    Promise.resolve({ data: null }),
    // Unrated past selections (from closed weeks)
    supabase.from('meal_selections')
      .select(`
        id, selection_type, combination_id, recipe_id,
        starch_component:recipe_components!starch_component_id(name, type),
        meat_component:recipe_components!meat_component_id(name, type),
        veggie_component:recipe_components!veggie_component_id(name, type),
        sauce_component:recipe_components!sauce_component_id(name, type),
        recipe:recipes!recipe_id(title),
        combination_ratings(id),
        recipe_ratings(id),
        meal_slots!inner(slot_date, weekday, week_plans!inner(status))
      `)
      .eq('user_id', user.id)
      .eq('meal_slots.week_plans.status', 'closed')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const slotsData = weekPlan ? await supabase
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
    .order('slot_date') : { data: [] }

  // Filter to unrated only
  const pendingRatings = (unratedSelections ?? []).filter(s => {
    const hasComboRating = (s.combination_ratings as any[])?.length > 0
    const hasRecipeRating = (s.recipe_ratings as any[])?.length > 0
    return !hasComboRating && !hasRecipeRating
  })

  return (
    <div className="space-y-6">
      {/* Unrated selections banner */}
      {pendingRatings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">⭐ 為上週的餐點評分</h2>
          <div className="space-y-2">
            {pendingRatings.map(s => {
              const slot = (s.meal_slots as any)
              const label = buildSelectionLabel(s)
              return (
                <Link
                  key={s.id}
                  href={`/rate/${s.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100 hover:border-amber-300 transition-colors"
                >
                  <div>
                    <p className="text-xs text-gray-500">{slot?.weekday}・{slot?.slot_date}</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5 line-clamp-1">{label}</p>
                  </div>
                  <span className="text-amber-500 text-sm ml-2">評分 →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Week plan */}
      {!weekPlan ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">本週計畫尚未開放</h2>
          <p className="text-sm text-gray-400">等待管理員建立本週選餐計畫</p>
        </div>
      ) : (
        <WeekOverview
          weekPlan={weekPlan}
          slots={slotsData.data ?? []}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}

function buildSelectionLabel(s: any): string {
  if (s.selection_type === 'all_in_one') {
    return s.recipe?.title ?? '一鍋到底'
  }
  const parts: string[] = []
  for (const key of ['starch_component', 'meat_component', 'veggie_component', 'sauce_component']) {
    const comp = s[key]
    if (comp) {
      const config = COMPONENT_CONFIG[comp.type as keyof typeof COMPONENT_CONFIG]
      parts.push(`${config.emoji}${comp.name}`)
    }
  }
  return parts.join(' + ') || '自由組合'
}
