import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditRecipeForm from '@/components/admin/recipes/EditRecipeForm'

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select(`*, recipe_components(*, recipe_component_ingredients(*)), recipe_ingredients(*)`)
    .eq('id', id)
    .single()

  if (!recipe) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">編輯食譜</h1>
      <EditRecipeForm recipe={recipe} />
    </div>
  )
}
