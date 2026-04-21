import AddRecipeForm from '@/components/admin/recipes/AddRecipeForm'

export default async function NewRecipePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新增食譜</h1>
      <AddRecipeForm />
    </div>
  )
}
