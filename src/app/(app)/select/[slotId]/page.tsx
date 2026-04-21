import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import MealSelectionForm from '@/components/member/MealSelectionForm'

export default async function SelectPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: slot } = await supabase
    .from('meal_slots')
    .select('*, meal_selections(id, user_id)')
    .eq('id', slotId)
    .single()

  if (!slot || !slot.is_available) notFound()

  // Slot already taken
  if (slot.meal_selections?.length > 0) {
    redirect('/?taken=1')
  }

  // Check if this week has specific recipe restrictions
  const { data: weekRecipes } = await supabase
    .from('week_plan_recipes')
    .select('recipe_id')
    .eq('week_plan_id', slot.week_plan_id)

  const allowedIds = weekRecipes?.length ? weekRecipes.map(r => r.recipe_id) : null

  // Fetch split recipe components (filtered if week has restrictions)
  let componentQuery = supabase
    .from('recipe_components')
    .select('*, recipes!inner(id, title, photo_url, type, servings)')
    .order('name')
  if (allowedIds) componentQuery = componentQuery.in('recipe_id', allowedIds)
  const { data: components } = await componentQuery

  // Fetch all-in-one recipes (filtered if week has restrictions)
  let aioQuery = supabase
    .from('recipes')
    .select('*')
    .eq('type', 'all_in_one')
    .order('title')
  if (allowedIds) aioQuery = aioQuery.in('id', allowedIds)
  const { data: allInOneRecipes } = await aioQuery

  return (
    <MealSelectionForm
      slot={slot}
      components={components ?? []}
      allInOneRecipes={allInOneRecipes ?? []}
      userId={user.id}
    />
  )
}
