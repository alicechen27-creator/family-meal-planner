'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { IngredientCatalogEntry } from '@/lib/types'
import { CHANNEL_PRESETS } from '@/components/admin/recipes/ChannelSelect'

interface Props {
  initialCatalog: IngredientCatalogEntry[]
}

export default function CatalogManager({ initialCatalog }: Props) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('')
  const [isStaple, setIsStaple] = useState(false)
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('ingredient_catalog')
      .upsert({ name: name.trim(), default_channel: channel || null, is_staple: isStaple })
      .select().single()
    if (data) {
      setCatalog(prev => {
        const idx = prev.findIndex(c => c.name === data.name)
        if (idx >= 0) { const arr = [...prev]; arr[idx] = data; return arr }
        return [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      })
      setName(''); setChannel(''); setIsStaple(false)
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('ingredient_catalog').delete().eq('id', id)
    setCatalog(prev => prev.filter(c => c.id !== id))
  }

  async function toggleStaple(item: IngredientCatalogEntry) {
    const supabase = createClient()
    await supabase.from('ingredient_catalog').update({ is_staple: !item.is_staple }).eq('id', item.id)
    setCatalog(prev => prev.map(c => c.id === item.id ? { ...c, is_staple: !c.is_staple } : c))
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-medium text-gray-800 mb-3">新增食材</h3>
        <div className="flex gap-2 mb-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="食材名稱"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="">建議渠道</option>
            {CHANNEL_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={isStaple} onChange={e => setIsStaple(e.target.checked)}
              className="w-4 h-4 accent-orange-500" />
            家裡常備食材
          </label>
          <button onClick={handleAdd} disabled={adding || !name.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl">新增</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {catalog.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">尚無食材記錄</div>
        ) : catalog.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {item.is_staple && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">常備</span>}
              <span className="text-sm font-medium text-gray-800">{item.name}</span>
              {item.default_channel && (
                <span className="text-xs text-gray-400">{item.default_channel}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleStaple(item)}
                className="text-xs text-gray-400 hover:text-green-600 transition-colors">
                {item.is_staple ? '取消常備' : '設為常備'}
              </button>
              <button onClick={() => handleDelete(item.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors">刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
