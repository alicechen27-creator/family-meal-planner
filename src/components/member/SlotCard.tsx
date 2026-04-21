import type { MealSlotWithSelection } from '@/lib/types'
import { COMPONENT_CONFIG } from '@/lib/types'

interface SlotCardProps {
  slot: MealSlotWithSelection
  currentUserId: string
  onSelect: () => void
}

export default function SlotCard({ slot, currentUserId, onSelect }: SlotCardProps) {
  const selection = slot.meal_selections?.[0] ?? null
  const isMySelection = selection?.user_id === currentUserId
  const isClaimed = !!selection
  const isAvailable = slot.is_available

  function getMealSummary() {
    if (!selection) return null
    if (selection.selection_type === 'all_in_one') {
      return <span className="text-purple-700">🥘 {selection.recipe?.title}</span>
    }
    const parts = [
      selection.starch_component && <span key="s" className={COMPONENT_CONFIG.starch.color}>🍚 {selection.starch_component.name}</span>,
      selection.meat_component && <span key="m" className={COMPONENT_CONFIG.meat.color}>🥩 {selection.meat_component.name}</span>,
      selection.veggie_component && <span key="v" className={COMPONENT_CONFIG.vegetable.color}>🥦 {selection.veggie_component.name}</span>,
      selection.sauce_component && <span key="sc" className={COMPONENT_CONFIG.sauce.color}>🫙 {selection.sauce_component.name}</span>,
    ].filter(Boolean)
    return <div className="flex flex-wrap gap-x-2 gap-y-1">{parts}</div>
  }

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      !isAvailable
        ? 'bg-gray-50 border-gray-100 opacity-50'
        : isMySelection
        ? 'bg-orange-50 border-orange-200'
        : isClaimed
        ? 'bg-gray-50 border-gray-100'
        : 'bg-white border-gray-100 shadow-sm'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{slot.weekday}</span>
            <span className="text-xs text-gray-400">{slot.slot_date}</span>
            {isMySelection && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">我的選擇</span>
            )}
          </div>

          {!isAvailable && (
            <p className="text-xs text-gray-400">此日期不開放選擇</p>
          )}

          {isAvailable && isClaimed && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">{selection.profiles?.display_name}</p>
              <div className="text-sm">{getMealSummary()}</div>
            </div>
          )}

          {isAvailable && !isClaimed && (
            <p className="text-sm text-gray-400">尚未有人選擇</p>
          )}
        </div>

        {isAvailable && !isClaimed && (
          <button
            onClick={onSelect}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            選擇
          </button>
        )}
      </div>
    </div>
  )
}
