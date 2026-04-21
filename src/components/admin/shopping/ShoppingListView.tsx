'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ShoppingListItem } from '@/lib/types'

interface Props {
  weekPlanId: string
  initialItems: ShoppingListItem[]
}

const DEFAULT_CHANNEL = '其他'

export default function ShoppingListView({ weekPlanId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems)

  async function toggleItem(id: string, checked: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_checked: checked } : i))
    const supabase = createClient()
    await supabase.from('shopping_list_items').update({ is_checked: checked }).eq('id', id)
  }

  // Group by channel
  const grouped = items.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const ch = item.channel_name ?? DEFAULT_CHANNEL
    if (!acc[ch]) acc[ch] = []
    acc[ch].push(item)
    return acc
  }, {})

  const channelOrder = ['家裡常備', 'Costco', '超市', '傳統市場', '其他']
  const sortedChannels = [
    ...channelOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !channelOrder.includes(c)),
  ]

  const totalCount = items.length
  const checkedCount = items.filter(i => i.is_checked).length

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Summary bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">採購進度</p>
          <p className="text-xs text-gray-400 mt-0.5">{checkedCount} / {totalCount} 項</p>
        </div>
        <button
          onClick={handlePrint}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors print:hidden"
        >
          列印
        </button>
      </div>

      {totalCount === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🛒</p>
          <p className="text-sm">沒有需要採購的食材</p>
          <p className="text-xs mt-1">（所有食材都已在家裡庫存中）</p>
        </div>
      )}

      {sortedChannels.map(channel => {
        const channelItems = grouped[channel]
        const allChecked = channelItems.every(i => i.is_checked)
        return (
          <div key={channel} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className={`px-4 py-2.5 border-b border-gray-100 flex items-center justify-between ${allChecked ? 'bg-gray-50' : 'bg-white'}`}>
              <h3 className={`text-sm font-semibold ${allChecked ? 'text-gray-400' : 'text-gray-800'}`}>
                {channel}
              </h3>
              <span className="text-xs text-gray-400">
                {channelItems.filter(i => i.is_checked).length}/{channelItems.length}
              </span>
            </div>
            <ul className="divide-y divide-gray-50">
              {channelItems.map(item => (
                <li key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${item.is_checked ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={e => toggleItem(item.id, e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-500 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${item.is_checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.ingredient_name}
                      {item.is_staple && <span className="ml-1 text-xs text-blue-500">（常備）</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(item.total_amount || item.unit) && (
                        <span className="text-xs text-gray-400">
                          {[item.total_amount, item.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {item.for_recipe_title && (
                        <span className="text-xs text-gray-300">• {item.for_recipe_title}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
