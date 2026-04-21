import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createClient()

  const { data: weeks } = await supabase
    .from('week_plans')
    .select(`
      id, week_start, status,
      meal_slots(
        id, is_available,
        meal_selections(
          id, selection_type,
          starch_component:recipe_components!starch_component_id(name),
          meat_component:recipe_components!meat_component_id(name),
          veggie_component:recipe_components!veggie_component_id(name),
          recipe:recipes!recipe_id(title),
          profiles(display_name)
        )
      )
    `)
    .order('week_start', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">歷史記錄</h1>

      {(!weeks || weeks.length === 0) ? (
        <div className="text-center py-16 text-gray-400">還沒有週計畫記錄</div>
      ) : (
        <div className="space-y-4">
          {weeks.map(week => {
            const availableSlots = (week.meal_slots ?? []).filter((s: any) => s.is_available)
            const filledSlots = availableSlots.filter((s: any) => s.meal_selections?.length > 0)
            const isClosed = week.status === 'closed'

            return (
              <div key={week.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{week.week_start} 起的一週</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        已選 {filledSlots.length} / {availableSlots.length} 天
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${isClosed ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      {isClosed ? '已關閉' : '進行中'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {isClosed && (
                      <Link
                        href={`/admin/shopping/${week.id}`}
                        className="text-xs text-orange-500 hover:text-orange-700 px-3 py-1.5 border border-orange-200 rounded-lg transition-colors"
                      >
                        採購清單
                      </Link>
                    )}
                    <Link
                      href={`/admin/week/${week.id}`}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg transition-colors"
                    >
                      詳情
                    </Link>
                  </div>
                </div>

                {/* Slot summary */}
                {filledSlots.length > 0 && (
                  <div className="p-4 space-y-2">
                    {availableSlots.map((slot: any) => {
                      const sel = slot.meal_selections?.[0]
                      if (!sel) return null
                      const label = sel.selection_type === 'all_in_one'
                        ? `🥘 ${sel.recipe?.title ?? '—'}`
                        : [sel.starch_component?.name, sel.meat_component?.name, sel.veggie_component?.name]
                            .filter(Boolean).join(' + ') || '—'
                      return (
                        <div key={slot.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 text-xs w-16 flex-shrink-0">
                            {sel.profiles?.display_name}
                          </span>
                          <span className="text-gray-700 flex-1 truncate">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
