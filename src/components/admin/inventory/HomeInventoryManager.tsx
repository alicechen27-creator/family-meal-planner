'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HomeInventoryItem, IngredientCatalogEntry } from '@/lib/types'

interface Props {
  initialInventory: HomeInventoryItem[]
  catalog: IngredientCatalogEntry[]
}

export default function HomeInventoryManager({ initialInventory, catalog }: Props) {
  const [inventory, setInventory] = useState(initialInventory)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  function handleNameChange(value: string) {
    setName(value)
    if (value.trim().length > 0) {
      setSuggestions(
        catalog
          .map(c => c.name)
          .filter(n => n.toLowerCase().includes(value.toLowerCase()) && !inventory.some(i => i.ingredient_name === n))
          .slice(0, 5)
      )
    } else {
      setSuggestions([])
    }
  }

  async function handleAdd() {
    if (!name.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('home_inventory')
      .upsert({ ingredient_name: name.trim(), quantity: quantity || null, unit: unit || null, updated_at: new Date().toISOString() })
      .select().single()
    if (data) {
      setInventory(prev => {
        const existing = prev.findIndex(i => i.ingredient_name === data.ingredient_name)
        if (existing >= 0) { const arr = [...prev]; arr[existing] = data; return arr }
        return [data, ...prev]
      })
      setName(''); setQuantity(''); setUnit(''); setSuggestions([])
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    const supabase = createClient()
    await supabase.from('home_inventory').delete().eq('id', id)
    setInventory(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-medium text-gray-800 mb-3">新增庫存</h3>
        <div className="relative mb-2">
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="食材名稱"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setName(s); setSuggestions([]) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 text-gray-700">{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="數量"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="單位"
            className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          <button onClick={handleAdd} disabled={adding || !name.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
            新增
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {inventory.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">尚無庫存記錄</div>
        ) : inventory.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="font-medium text-gray-800 text-sm">{item.ingredient_name}</span>
              {(item.quantity || item.unit) && (
                <span className="text-xs text-gray-400 ml-2">{item.quantity} {item.unit}</span>
              )}
            </div>
            <button onClick={() => handleRemove(item.id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors">移除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
