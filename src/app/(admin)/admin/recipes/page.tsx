import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RecipeLibrary from '@/components/admin/recipes/RecipeLibrary'

export default async function RecipesPage() {
  const supabase = await createClient()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_components(id, type, name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">食譜庫</h1>
        <Link
          href="/admin/recipes/new"
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + 新增食譜
        </Link>
      </div>
      <RecipeLibrary initialRecipes={recipes ?? []} />
    </div>
  )
}
