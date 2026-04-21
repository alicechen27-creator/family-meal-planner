import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { COMPONENT_CONFIG, RECIPE_TYPE_CONFIG } from '@/lib/types'

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_components(
        id, type, name, instructions, display_order,
        recipe_component_ingredients(id, name, amount, unit)
      ),
      recipe_ingredients(id, name, amount, unit)
    `)
    .eq('id', id)
    .single()

  if (!recipe) notFound()

  const componentIds = (recipe.recipe_components ?? []).map((c: any) => c.id)

  const [{ data: recipeRatings }, { data: combos }] = await Promise.all([
    supabase.from('recipe_ratings').select('rating').eq('recipe_id', id),
    componentIds.length > 0
      ? supabase.from('meal_combinations')
          .select('combination_ratings(rating)')
          .or(
            ['starch', 'meat', 'veggie', 'sauce'].map(k =>
              `${k}_component_id.in.(${componentIds.join(',')})`
            ).join(',')
          )
      : Promise.resolve({ data: [] as any[] }),
  ])

  const allRatings = [
    ...(recipeRatings ?? []).map((r: any) => r.rating),
    ...(combos ?? []).flatMap((c: any) => (c.combination_ratings ?? []).map((r: any) => r.rating)),
  ]
  const avgRating = allRatings.length > 0
    ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length
    : null

  const sortedComponents = (recipe.recipe_components ?? [])
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/recipes" className="hover:text-gray-600 transition-colors">食譜庫</Link>
        <span>›</span>
        <span className="text-gray-600">{recipe.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {recipe.photo_url && (
          <div className="relative w-full h-48">
            <Image src={recipe.photo_url} alt={recipe.title} fill className="object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{recipe.title}</h1>
              {recipe.description && (
                <p className="text-sm text-gray-500 mt-1">{recipe.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {RECIPE_TYPE_CONFIG[recipe.type as 'split' | 'all_in_one']?.label}
              </span>
              {avgRating !== null && (
                <span className="text-sm text-amber-500 font-medium">
                  ⭐ {avgRating.toFixed(1)}
                  <span className="text-xs text-gray-300 ml-0.5">({allRatings.length})</span>
                </span>
              )}
              {recipe.servings && (
                <span className="text-xs text-gray-400">{recipe.servings} 人份</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Split recipe components */}
      {recipe.type === 'split' && sortedComponents.length > 0 && (
        <div className="space-y-3">
          {sortedComponents.map((comp: any) => {
            const config = COMPONENT_CONFIG[comp.type as keyof typeof COMPONENT_CONFIG]
            if (!config) return null
            return (
              <div key={comp.id} className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span>{config.emoji}</span>
                  <h3 className={`font-semibold text-sm ${config.color}`}>{comp.name}</h3>
                </div>

                {comp.recipe_component_ingredients?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {comp.recipe_component_ingredients.map((ing: any) => (
                      <span key={ing.id} className="text-xs bg-white/70 text-gray-600 px-2 py-1 rounded-lg">
                        {ing.name}{ing.amount ? ` ${ing.amount}${ing.unit ?? ''}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {comp.instructions && (
                  <div>
                    <p className={`text-xs font-medium mb-1 ${config.color}`}>烹調方式</p>
                    <p className="text-xs text-gray-600 whitespace-pre-line bg-white/60 rounded-xl px-3 py-2">
                      {comp.instructions}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

          {recipe.instructions && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">🍽️ 組合 / 擺盤步驟</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{recipe.instructions}</p>
            </div>
          )}
        </div>
      )}

      {/* All-in-one recipe */}
      {recipe.type === 'all_in_one' && (
        <div className="space-y-4">
          {recipe.recipe_ingredients?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">食材清單</h3>
              <div className="flex flex-wrap gap-1.5">
                {recipe.recipe_ingredients.map((ing: any) => (
                  <span key={ing.id} className="text-sm bg-gray-50 text-gray-600 px-3 py-1.5 rounded-xl border border-gray-100">
                    {ing.name}{ing.amount ? ` ${ing.amount}${ing.unit ?? ''}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recipe.instructions && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">烹調步驟</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{recipe.instructions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
