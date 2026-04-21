import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { COMPONENT_CONFIG } from '@/lib/types'
import RatingForm from '@/components/member/RatingForm'

export default async function RatePage({ params }: { params: Promise<{ selectionId: string }> }) {
  const { selectionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: selection } = await supabase
    .from('meal_selections')
    .select(`
      id, selection_type, combination_id, recipe_id, user_id,
      starch_component:recipe_components!starch_component_id(name, type),
      meat_component:recipe_components!meat_component_id(name, type),
      veggie_component:recipe_components!veggie_component_id(name, type),
      sauce_component:recipe_components!sauce_component_id(name, type),
      recipe:recipes!recipe_id(title),
      combination_ratings(id),
      recipe_ratings(id)
    `)
    .eq('id', selectionId)
    .eq('user_id', user.id)
    .single()

  if (!selection) notFound()

  // Already rated
  const alreadyRated = (selection.combination_ratings as any[])?.length > 0 ||
                       (selection.recipe_ratings as any[])?.length > 0
  if (alreadyRated) redirect('/')

  // Build label
  let label = ''
  if (selection.selection_type === 'split') {
    const parts: string[] = []
    for (const key of ['starch_component', 'meat_component', 'veggie_component', 'sauce_component'] as const) {
      const comp = (selection as any)[key]
      if (comp) {
        const config = COMPONENT_CONFIG[comp.type as keyof typeof COMPONENT_CONFIG]
        parts.push(`${config.emoji} ${comp.name}`)
      }
    }
    label = parts.join('  ')
  } else {
    label = (selection.recipe as any)?.title ?? '一鍋到底料理'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">為這餐評分</h1>
      <RatingForm
        selectionId={selection.id}
        selectionType={selection.selection_type as 'split' | 'all_in_one'}
        combinationId={selection.combination_id}
        recipeId={selection.recipe_id}
        userId={user.id}
        label={label}
      />
    </div>
  )
}
