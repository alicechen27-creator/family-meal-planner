import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: weekPlan } = await supabase
    .from('week_plans')
    .select('*, meal_slots(id, is_available, meal_selections(id))')
    .eq('status', 'open')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: closedWeek } = await supabase
    .from('week_plans')
    .select('id, week_start')
    .eq('status', 'closed')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: recipeCount } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })

  const slots = weekPlan?.meal_slots ?? []
  const availableSlots = slots.filter((s: { is_available: boolean }) => s.is_available)
  const filledSlots = availableSlots.filter((s: { meal_selections: { id: string } | null }) => !!s.meal_selections)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">管理後台</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-3xl mb-1">📖</div>
          <div className="text-2xl font-bold text-gray-900">{recipeCount ?? 0}</div>
          <div className="text-sm text-gray-500">食譜數量</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-3xl mb-1">📅</div>
          <div className="text-2xl font-bold text-gray-900">
            {weekPlan ? `${filledSlots.length}/${availableSlots.length}` : '—'}
          </div>
          <div className="text-sm text-gray-500">本週已選／總名額</div>
        </div>
      </div>

      <div className="space-y-3">
        {weekPlan ? (
          <Link
            href={`/admin/week/${weekPlan.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">本週計畫</div>
              <div className="text-sm text-gray-500">{weekPlan.week_start} 起</div>
            </div>
            <span className="text-orange-500">查看 →</span>
          </Link>
        ) : (
          <Link
            href="/admin/week/new"
            className="flex items-center justify-between bg-orange-50 rounded-2xl border border-orange-200 p-4 hover:bg-orange-100 transition-colors"
          >
            <div>
              <div className="font-medium text-orange-800">尚未建立本週計畫</div>
              <div className="text-sm text-orange-600">點擊建立</div>
            </div>
            <span className="text-orange-500">＋</span>
          </Link>
        )}

        <Link
          href="/admin/recipes/new"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 transition-colors"
        >
          <div className="font-medium text-gray-900">新增食譜</div>
          <span className="text-orange-500">→</span>
        </Link>

        <Link
          href="/admin/recipes"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 transition-colors"
        >
          <div className="font-medium text-gray-900">食譜庫</div>
          <span className="text-orange-500">→</span>
        </Link>

        {closedWeek && (
          <Link
            href={`/admin/shopping/${closedWeek.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">採購清單</div>
              <div className="text-sm text-gray-500">{closedWeek.week_start} 起</div>
            </div>
            <span className="text-orange-500">→</span>
          </Link>
        )}
      </div>
    </div>
  )
}
