import { createClient } from '@/lib/supabase/server'
import InventoryTabs from '@/components/admin/inventory/InventoryTabs'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [{ data: catalog }, { data: inventory }] = await Promise.all([
    supabase.from('ingredient_catalog').select('*').order('name'),
    supabase.from('home_inventory').select('*').order('ingredient_name'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">食材庫存管理</h1>
      <InventoryTabs
        catalog={catalog ?? []}
        inventory={inventory ?? []}
      />
    </div>
  )
}
