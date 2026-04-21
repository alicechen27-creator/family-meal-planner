import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WeekManagementView from '@/components/admin/week/WeekManagementView'

export default async function WeekPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: weekPlan }, { data: slots }, { data: components }, { data: allInOneRecipes }, { data: allRecipes }, { data: selectedRecipes }] = await Promise.all([
    supabase.from('week_plans').select('*').eq('id', id).single(),
    supabase.from('meal_slots').select(`
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
    `).eq('week_plan_id', id).order('slot_date'),
    supabase.from('recipe_components').select('id, name, type, recipes(id, title)').order('type'),
    supabase.from('recipes').select('id, title').eq('type', 'all_in_one').order('title'),
    supabase.from('recipes').select('id, title, type, description').order('title'),
    supabase.from('week_plan_recipes').select('recipe_id').eq('week_plan_id', id),
  ])

  if (!weekPlan) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">週計畫管理</h1>
      <p className="text-sm text-gray-400 mb-6">{weekPlan.week_start} 起的一週</p>
      <WeekManagementView
        weekPlan={weekPlan}
        initialSlots={slots ?? []}
        availableComponents={components ?? []}
        allInOneRecipes={allInOneRecipes ?? []}
        allRecipes={allRecipes ?? []}
        initialSelectedRecipeIds={(selectedRecipes ?? []).map(r => r.recipe_id)}
      />
    </div>
  )
}
