'use client'

import type { ParsedComponent } from '@/lib/types'
import { COMPONENT_CONFIG } from '@/lib/types'
import ChannelSelect from './ChannelSelect'

interface Props {
  component: ParsedComponent
  onChange: (updated: ParsedComponent) => void
  onRemove: () => void
}

export default function ComponentEditor({ component, onChange, onRemove }: Props) {
  const config = COMPONENT_CONFIG[component.type]

  function updateIngredient(index: number, field: keyof typeof component.ingredients[0], value: string) {
    const ingredients = [...component.ingredients]
    ingredients[index] = { ...ingredients[index], [field]: value }
    onChange({ ...component, ingredients })
  }

  function addIngredient() {
    onChange({ ...component, ingredients: [...component.ingredients, { name: '', amount: '', unit: '', channel: '' }] })
  }

  function removeIngredient(index: number) {
    onChange({ ...component, ingredients: component.ingredients.filter((_, i) => i !== index) })
  }

  return (
    <div className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{config.emoji}</span>
          <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-sm">移除</button>
      </div>

      <div className="mb-3">
        <input
          value={component.name}
          onChange={e => onChange({ ...component, name: e.target.value })}
          placeholder={`${config.label}名稱，例如：${component.type === 'starch' ? '白飯' : component.type === 'meat' ? '紅燒豬肉' : component.type === 'vegetable' ? '炒青江菜' : '蒜蓉醬'}`}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      <div className="space-y-2 mb-3">
        {component.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2 flex-wrap">
            <input
              value={ing.name}
              onChange={e => updateIngredient(i, 'name', e.target.value)}
              placeholder="食材名稱"
              className="flex-1 min-w-[80px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <input
              value={ing.amount}
              onChange={e => updateIngredient(i, 'amount', e.target.value)}
              placeholder="數量"
              className="w-16 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <input
              value={ing.unit}
              onChange={e => updateIngredient(i, 'unit', e.target.value)}
              placeholder="單位"
              className="w-14 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <ChannelSelect
              value={ing.channel ?? ''}
              onChange={v => updateIngredient(i, 'channel', v)}
            />
            <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400 px-1">✕</button>
          </div>
        ))}
        <button
          onClick={addIngredient}
          className={`text-xs ${config.color} hover:underline`}
        >
          + 新增食材
        </button>
      </div>

      {/* 組件烹調步驟 */}
      <div>
        <label className={`block text-xs font-medium mb-1 ${config.color}`}>烹調方式（此組件）</label>
        <textarea
          value={component.instructions ?? ''}
          onChange={e => onChange({ ...component, instructions: e.target.value })}
          placeholder={`例如：\n1. 先醃製 30 分鐘\n2. 中火煎至兩面金黃`}
          rows={3}
          className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
        />
      </div>
    </div>
  )
}
