'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RecipeWithComponents, ParsedComponent, ComponentType } from '@/lib/types'
import { COMPONENT_CONFIG, RECIPE_TYPE_CONFIG } from '@/lib/types'
import ComponentEditor from './ComponentEditor'
import PhotoUploader from './PhotoUploader'
import ChannelSelect from './ChannelSelect'

interface Props {
  recipe: RecipeWithComponents & { recipe_component_ingredients?: unknown[] }
}

export default function EditRecipeForm({ recipe: initialRecipe }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState(initialRecipe.title)
  const [description, setDescription] = useState(initialRecipe.description ?? '')
  const [type, setType] = useState(initialRecipe.type)
  const [servings, setServings] = useState(initialRecipe.servings)
  const [sourceUrl, setSourceUrl] = useState(initialRecipe.source_url ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialRecipe.photo_url)
  const [instructions, setInstructions] = useState(initialRecipe.instructions ?? '')

  const [components, setComponents] = useState<ParsedComponent[]>(
    (initialRecipe.recipe_components ?? []).map(c => ({
      type: c.type,
      name: c.name,
      instructions: (c as any).instructions ?? '',
      ingredients: (c.recipe_component_ingredients ?? []).map((i: { name: string; amount: string | null; unit: string | null; channel?: string | null }) => ({
        name: i.name,
        amount: i.amount ?? '',
        unit: i.unit ?? '',
        channel: i.channel ?? '',
      })),
    }))
  )

  const [ingredients, setIngredients] = useState(
    (initialRecipe.recipe_ingredients ?? []).map(i => ({
      name: i.name,
      amount: i.amount ?? '',
      unit: i.unit ?? '',
      channel: i.channel ?? '',
    }))
  )

  const usedTypes = new Set(components.map(c => c.type))
  const availableTypes = (['starch', 'meat', 'vegetable', 'sauce'] as ComponentType[])
    .filter(t => !usedTypes.has(t))

  async function handleSave() {
    if (!title.trim()) { setError('請填寫食譜名稱'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('recipes')
      .update({
        title,
        description: description || null,
        photo_url: photoUrl,
        type,
        servings,
        source_url: sourceUrl || null,
        instructions: instructions || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', initialRecipe.id)

    if (updateError) { setError('更新失敗：' + updateError.message); setSaving(false); return }

    if (type === 'split') {
      await supabase.from('recipe_components').delete().eq('recipe_id', initialRecipe.id)
      for (let i = 0; i < components.length; i++) {
        const comp = components[i]
        const { data: newComp } = await supabase
          .from('recipe_components')
          .insert({ recipe_id: initialRecipe.id, type: comp.type, name: comp.name, display_order: i, instructions: comp.instructions || null })
          .select().single()
        if (newComp && comp.ingredients.length > 0) {
          await supabase.from('recipe_component_ingredients').insert(
            comp.ingredients.map(ing => ({
              component_id: newComp.id,
              name: ing.name,
              amount: ing.amount || null,
              unit: ing.unit || null,
              channel: ing.channel || null,
            }))
          )
        }
      }
    } else {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', initialRecipe.id)
      if (ingredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          ingredients.map(ing => ({
            recipe_id: initialRecipe.id,
            name: ing.name,
            amount: ing.amount || null,
            unit: ing.unit || null,
            channel: ing.channel || null,
          }))
        )
      }
    }

    router.push('/admin/recipes')
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">基本資訊</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">食譜名稱 *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
            <div className="flex gap-2">
              {(['split', 'all_in_one'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${type === t ? 'border-orange-400 bg-orange-50 text-orange-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  {RECIPE_TYPE_CONFIG[t].emoji} {RECIPE_TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">人數</label>
            <input type="number" min={1} max={20} value={servings}
              onChange={e => setServings(parseInt(e.target.value) || 4)}
              className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">來源網址</label>
          <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">封面照片</label>
          <PhotoUploader currentUrl={photoUrl} onUpload={setPhotoUrl} />
        </div>
      </div>

      {type === 'split' && (
        <div className="space-y-3">
          {components.map((comp, i) => (
            <ComponentEditor key={i} component={comp}
              onChange={updated => {
                const c = [...components]; c[i] = updated; setComponents(c)
              }}
              onRemove={() => setComponents(components.filter((_, j) => j !== i))}
            />
          ))}
          {availableTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTypes.map(t => (
                <button key={t} onClick={() => setComponents([...components, { type: t, name: '', ingredients: [] }])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm ${COMPONENT_CONFIG[t].bg} ${COMPONENT_CONFIG[t].border} ${COMPONENT_CONFIG[t].color}`}>
                  + {COMPONENT_CONFIG[t].emoji} {COMPONENT_CONFIG[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {type === 'all_in_one' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">食材清單</h2>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <input value={ing.name}
                  onChange={e => { const arr = [...ingredients]; arr[i] = { ...arr[i], name: e.target.value }; setIngredients(arr) }}
                  placeholder="食材名稱"
                  className="flex-1 min-w-[80px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                <input value={ing.amount}
                  onChange={e => { const arr = [...ingredients]; arr[i] = { ...arr[i], amount: e.target.value }; setIngredients(arr) }}
                  placeholder="數量" className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                <input value={ing.unit}
                  onChange={e => { const arr = [...ingredients]; arr[i] = { ...arr[i], unit: e.target.value }; setIngredients(arr) }}
                  placeholder="單位" className="w-16 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                <ChannelSelect
                  value={ing.channel ?? ''}
                  onChange={v => { const arr = [...ingredients]; arr[i] = { ...arr[i], channel: v }; setIngredients(arr) }}
                  className="w-28 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 text-gray-600"
                />
                <button onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-2">✕</button>
              </div>
            ))}
            <button onClick={() => setIngredients([...ingredients, { name: '', amount: '', unit: '', channel: '' }])}
              className="text-sm text-orange-500 hover:text-orange-700">+ 新增食材</button>
          </div>
        </div>
      )}

      {/* Assembly instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">{type === 'split' ? '組合 / 擺盤步驟' : '烹調步驟'}</h2>
        {type === 'split' && <p className="text-xs text-gray-400 mb-3">描述如何將各組件組合上桌（各組件的個別做法請在上方填寫）</p>}
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="1. 先將食材備料...\n2. 熱鍋下油...\n3. ..."
          rows={6}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => router.back()}
          className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">取消</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </div>
    </div>
  )
}
