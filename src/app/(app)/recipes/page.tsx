import { createClient } from '@/lib/supabase/server'
import RecipeListView from '@/components/member/RecipeListView'

export default async function RecipesPage() {
  const supabase = await createClient()

  const [
    { data: recipes },
    { data: allInOneRatings },
    { data: comboRatings },
  ] = await Promise.all([
    supabase.from('recipes')
      .select('id, title, type, description, photo_url, servings, recipe_components(id, type, name)')
      .order('title'),
    supabase.from('recipe_ratings').select('recipe_id, rating'),
    supabase.from('combination_ratings').select(`
      rating,
      meal_combinations!combination_id(
        starch:recipe_components!starch_component_id(recipe_id),
        meat:recipe_components!meat_component_id(recipe_id),
        veggie:recipe_components!veggie_component_id(recipe_id),
        sauce:recipe_components!sauce_component_id(recipe_id)
      )
    `),
  ])

  // Build ratingsMap: recipe_id → { avg, count }
  const ratingAccum: Record<string, number[]> = {}

  for (const r of allInOneRatings ?? []) {
    if (!ratingAccum[r.recipe_id]) ratingAccum[r.recipe_id] = []
    ratingAccum[r.recipe_id].push(r.rating)
  }

  for (const cr of comboRatings ?? []) {
    const combo = (cr as any).meal_combinations
    const seen = new Set<string>()
    for (const key of ['starch', 'meat', 'veggie', 'sauce']) {
      const rid = combo?.[key]?.recipe_id
      if (rid && !seen.has(rid)) {
        seen.add(rid)
        if (!ratingAccum[rid]) ratingAccum[rid] = []
        ratingAccum[rid].push(cr.rating)
      }
    }
  }

  const ratingsMap: Record<string, { avg: number; count: number }> = {}
  for (const [rid, ratings] of Object.entries(ratingAccum)) {
    ratingsMap[rid] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">食譜庫</h1>
      <RecipeListView recipes={recipes ?? []} ratingsMap={ratingsMap} />
    </div>
  )
}
