'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ParsedRecipe, ParsedComponent, ComponentType } from '@/lib/types'
import { COMPONENT_CONFIG, RECIPE_TYPE_CONFIG } from '@/lib/types'
import ComponentEditor from './ComponentEditor'
import PhotoUploader from './PhotoUploader'
import ChannelSelect from './ChannelSelect'

type InputTab = 'text' | 'url' | 'image'
type FormPhase = 'input' | 'review' | 'saving'

const EMPTY_RECIPE: ParsedRecipe = {
  title: '',
  description: '',
  type: 'split',
  servings: 4,
  instructions: '',
  components: [],
  ingredients: [],
}

export default function AddRecipeForm() {
  const router = useRouter()
  const [inputTab, setInputTab] = useState<InputTab>('url')
  const [phase, setPhase] = useState<FormPhase>('input')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [saveError, setSaveError] = useState('')

  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [recipe, setRecipe] = useState<ParsedRecipe>(EMPTY_RECIPE)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  async function handleParse() {
    setParsing(true)
    setParseError('')
    const fd = new FormData()

    if (inputTab === 'text' && textInput.trim()) {
      fd.append('type', 'text')
      fd.append('text', textInput)
    } else if (inputTab === 'url' && urlInput.trim()) {
      fd.append('type', 'url')
      fd.append('url', urlInput)
    } else if (inputTab === 'image' && imageFile) {
      fd.append('type', 'image')
      fd.append('image', imageFile)
    } else {
      setParseError('請輸入內容')
      setParsing(false)
      return
    }

    try {
      const res = await fetch('/api/parse-recipe', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.error) { setParseError(json.error); return }
      setRecipe(json.recipe as ParsedRecipe)
      setPhase('review')
    } catch {
      setParseError('解析失敗，請手動輸入')
    } finally {
      setParsing(false)
    }
  }

  function handleManualEntry() {
    setRecipe(EMPTY_RECIPE)
    setPhase('review')
  }

  function updateComponent(index: number, updated: ParsedComponent) {
    setRecipe(r => {
      const components = [...r.components]
      components[index] = updated
      return { ...r, components }
    })
  }

  function addComponent(type: ComponentType) {
    setRecipe(r => ({
      ...r,
      components: [...r.components, { type, name: '', ingredients: [] }]
    }))
  }

  function removeComponent(index: number) {
    setRecipe(r => ({
      ...r,
      components: r.components.filter((_, i) => i !== index)
    }))
  }

  async function handleSave() {
    if (!recipe.title.trim()) { setSaveError('請填寫食譜名稱'); return }
    setPhase('saving')
    setSaveError('')

    const supabase = createClient()

    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        title: recipe.title,
        description: recipe.description || null,
        photo_url: photoUrl,
        type: recipe.type,
        servings: recipe.servings,
        source_url: recipe.source_url || null,
        instructions: recipe.instructions || null,
      })
      .select()
      .single()

    if (recipeError || !newRecipe) {
      setSaveError('儲存失敗：' + recipeError?.message)
      setPhase('review')
      return
    }

    if (recipe.type === 'split') {
      for (let i = 0; i < recipe.components.length; i++) {
        const comp = recipe.components[i]
        const { data: newComp, error: compError } = await supabase
          .from('recipe_components')
          .insert({ recipe_id: newRecipe.id, type: comp.type, name: comp.name, display_order: i, instructions: comp.instructions || null })
          .select()
          .single()

        if (compError || !newComp) continue

        if (comp.ingredients.length > 0) {
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
      if (recipe.ingredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          recipe.ingredients.map(ing => ({
            recipe_id: newRecipe.id,
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

  // ── Input phase ──────────────────────────────────────────
  if (phase === 'input') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex gap-2 mb-6">
          {(['url', 'text', 'image'] as InputTab[]).map(t => (
            <button
              key={t}
              onClick={() => setInputTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                inputTab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'url' ? '🔗 網址' : t === 'text' ? '📝 文字' : '📷 照片'}
            </button>
          ))}
        </div>

        {inputTab === 'url' && (
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/recipe"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        )}
        {inputTab === 'text' && (
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="貼上食譜文字..."
            rows={8}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
        )}
        {inputTab === 'image' && (
          <input
            type="file"
            accept="image/*"
            onChange={e => setImageFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-orange-50 file:text-orange-700"
          />
        )}

        {parseError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{parseError}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleParse}
            disabled={parsing}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {parsing ? 'AI 解析中...' : '✨ AI 自動填入'}
          </button>
          <button
            onClick={handleManualEntry}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
          >
            手動輸入
          </button>
        </div>
      </div>
    )
  }

  // ── Review phase ──────────────────────────────────────────
  const usedTypes = new Set(recipe.components.map(c => c.type))
  const availableTypes = (['starch', 'meat', 'vegetable', 'sauce'] as ComponentType[])
    .filter(t => !usedTypes.has(t))

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">基本資訊</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">食譜名稱 *</label>
          <input
            value={recipe.title}
            onChange={e => setRecipe(r => ({ ...r, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <input
            value={recipe.description}
            onChange={e => setRecipe(r => ({ ...r, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
            <div className="flex gap-2">
              {(['split', 'all_in_one'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setRecipe(r => ({ ...r, type: t, components: [], ingredients: [] }))}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                    recipe.type === t
                      ? 'border-orange-400 bg-orange-50 text-orange-700 font-medium'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {RECIPE_TYPE_CONFIG[t].emoji} {RECIPE_TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">人數</label>
            <input
              type="number"
              min={1}
              max={20}
              value={recipe.servings}
              onChange={e => setRecipe(r => ({ ...r, servings: parseInt(e.target.value) || 4 }))}
              className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">食譜來源網址</label>
          <input
            value={recipe.source_url ?? ''}
            onChange={e => setRecipe(r => ({ ...r, source_url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">封面照片</label>
          <PhotoUploader currentUrl={photoUrl} onUpload={setPhotoUrl} />
        </div>
      </div>

      {/* Split: components */}
      {recipe.type === 'split' && (
        <div className="space-y-3">
          {recipe.components.map((comp, i) => (
            <ComponentEditor
              key={i}
              component={comp}
              onChange={updated => updateComponent(i, updated)}
              onRemove={() => removeComponent(i)}
            />
          ))}
          {availableTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTypes.map(t => (
                <button
                  key={t}
                  onClick={() => addComponent(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm ${COMPONENT_CONFIG[t].bg} ${COMPONENT_CONFIG[t].border} ${COMPONENT_CONFIG[t].color}`}
                >
                  + {COMPONENT_CONFIG[t].emoji} {COMPONENT_CONFIG[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All-in-one: ingredients */}
      {recipe.type === 'all_in_one' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">食材清單</h2>
          <div className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <input
                  value={ing.name}
                  onChange={e => {
                    const ingredients = [...recipe.ingredients]
                    ingredients[i] = { ...ingredients[i], name: e.target.value }
                    setRecipe(r => ({ ...r, ingredients }))
                  }}
                  placeholder="食材名稱"
                  className="flex-1 min-w-[80px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <input
                  value={ing.amount}
                  onChange={e => {
                    const ingredients = [...recipe.ingredients]
                    ingredients[i] = { ...ingredients[i], amount: e.target.value }
                    setRecipe(r => ({ ...r, ingredients }))
                  }}
                  placeholder="數量"
                  className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <input
                  value={ing.unit}
                  onChange={e => {
                    const ingredients = [...recipe.ingredients]
                    ingredients[i] = { ...ingredients[i], unit: e.target.value }
                    setRecipe(r => ({ ...r, ingredients }))
                  }}
                  placeholder="單位"
                  className="w-16 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <ChannelSelect
                  value={ing.channel ?? ''}
                  onChange={v => {
                    const ingredients = [...recipe.ingredients]
                    ingredients[i] = { ...ingredients[i], channel: v }
                    setRecipe(r => ({ ...r, ingredients }))
                  }}
                  className="w-28 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 text-gray-600"
                />
                <button
                  onClick={() => setRecipe(r => ({ ...r, ingredients: r.ingredients.filter((_, j) => j !== i) }))}
                  className="text-red-400 hover:text-red-600 px-2"
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => setRecipe(r => ({ ...r, ingredients: [...r.ingredients, { name: '', amount: '', unit: '', channel: '' }] }))}
              className="text-sm text-orange-500 hover:text-orange-700 mt-1"
            >
              + 新增食材
            </button>
          </div>
        </div>
      )}

      {/* Assembly instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">{recipe.type === 'split' ? '組合 / 擺盤步驟' : '烹調步驟'}</h2>
        {recipe.type === 'split' && <p className="text-xs text-gray-400 mb-3">描述如何將各組件組合上桌（各組件的個別做法請在上方填寫）</p>}
        <textarea
          value={recipe.instructions ?? ''}
          onChange={e => setRecipe(r => ({ ...r, instructions: e.target.value }))}
          placeholder="1. 先將食材備料...\n2. 熱鍋下油...\n3. ..."
          rows={6}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
        />
      </div>

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{saveError}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setPhase('input')}
          className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          重新解析
        </button>
        <button
          onClick={handleSave}
          disabled={phase === 'saving'}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
        >
          {phase === 'saving' ? '儲存中...' : '儲存食譜'}
        </button>
      </div>
    </div>
  )
}
