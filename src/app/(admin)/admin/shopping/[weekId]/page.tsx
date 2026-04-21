import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ShoppingListView from '@/components/admin/shopping/ShoppingListView'

export default async function ShoppingPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()

  const { data: weekPlan } = await supabase
    .from('week_plans')
    .select('*')
    .eq('id', weekId)
    .single()

  if (!weekPlan) notFound()

  const { data: items } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('week_plan_id', weekId)
    .order('channel_name')
    .order('ingredient_name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">採購清單</h1>
      <p className="text-sm text-gray-400 mb-6">{weekPlan.week_start} 起的一週</p>
      <ShoppingListView weekPlanId={weekId} initialItems={items ?? []} />
    </div>
  )
}
