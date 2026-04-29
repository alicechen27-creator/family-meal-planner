import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { requireAdminMealAccess } from '@/lib/authz'

const client = new Anthropic()

export async function POST() {
  const auth = await requireAdminMealAccess()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  // Fetch home inventory, all recipes, and combination ratings
  const [{ data: inventory }, { data: recipes }, { data: combinationRatings }, { data: recipeRatings }] = await Promise.all([
    supabase.from('home_inventory').select('ingredient_name, quantity, unit'),
    supabase.from('recipes').select(`
      id, title, description, type, servings,
      recipe_components(type, name, recipe_component_ingredients(name)),
      recipe_ingredients(name)
    `),
    supabase.from('combination_ratings').select(`
      rating,
      meal_combinations(
        starch_component:recipe_components!starch_component_id(name),
        meat_component:recipe_components!meat_component_id(name),
        veggie_component:recipe_components!veggie_component_id(name),
        sauce_component:recipe_components!sauce_component_id(name)
      )
    `),
    supabase.from('recipe_ratings').select('recipe_id, rating'),
  ])

  const inventoryText = (inventory ?? [])
    .map(i => `${i.ingredient_name}${i.quantity ? ` (${i.quantity}${i.unit ?? ''})` : ''}`)
    .join('、') || '（無庫存資料）'

  const recipeSummaries = (recipes ?? []).map(r => {
    if (r.type === 'all_in_one') {
      const ings = (r.recipe_ingredients ?? []).map((i: { name: string }) => i.name).join('、')
      return `【${r.id}】${r.title}（一鍋到底，食材：${ings || '未記錄'}）`
    } else {
      const parts = (r.recipe_components ?? []).map((c: { name: string; recipe_component_ingredients: { name: string }[] }) => {
        const ings = c.recipe_component_ingredients.map((i: { name: string }) => i.name).join('、')
        return `${c.name}（${ings || '未記錄'}）`
      }).join(' + ')
      return `【${r.id}】${r.title}（分開組合：${parts || '未記錄'}）`
    }
  }).join('\n')

  // Build rating summaries
  type ComboEntry = { names: string; avgRating: number; count: number }
  const comboMap = new Map<string, { ratings: number[]; names: string }>()
  for (const cr of combinationRatings ?? []) {
    const combo = (cr as any).meal_combinations
    if (!combo) continue
    const parts = [combo.starch_component?.name, combo.meat_component?.name, combo.veggie_component?.name, combo.sauce_component?.name].filter(Boolean)
    const key = parts.join('+')
    if (!comboMap.has(key)) comboMap.set(key, { ratings: [], names: parts.join(' + ') })
    comboMap.get(key)!.ratings.push((cr as any).rating)
  }
  const combos: ComboEntry[] = Array.from(comboMap.values()).map(v => ({
    names: v.names,
    avgRating: v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length,
    count: v.ratings.length,
  })).sort((a, b) => b.avgRating - a.avgRating)

  const highRatedCombos = combos.filter(c => c.avgRating >= 4)
  const lowRatedCombos = combos.filter(c => c.avgRating <= 2)

  // Recipe ratings
  const recipeRatingMap = new Map<string, number[]>()
  for (const rr of recipeRatings ?? []) {
    const arr = recipeRatingMap.get(rr.recipe_id) ?? []
    arr.push(rr.rating)
    recipeRatingMap.set(rr.recipe_id, arr)
  }

  const ratingContext = [
    highRatedCombos.length > 0
      ? `高評分組合（家人喜歡）：\n${highRatedCombos.map(c => `- ${c.names}（評分 ${c.avgRating.toFixed(1)}，${c.count} 次）`).join('\n')}`
      : '',
    lowRatedCombos.length > 0
      ? `低評分組合（避免重複）：\n${lowRatedCombos.map(c => `- ${c.names}（評分 ${c.avgRating.toFixed(1)}，${c.count} 次）`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const prompt = `你是家庭晚餐規劃助手。根據家裡現有庫存和歷史評分，從食譜庫推薦 3-5 道適合本週的晚餐。

家裡現有庫存：
${inventoryText}

食譜庫（格式：【id】食譜名稱（說明））：
${recipeSummaries || '（食譜庫為空）'}

${ratingContext ? `歷史評分記錄：\n${ratingContext}\n\n` : ''}請推薦 3-5 道食譜，並說明為什麼適合（能消化庫存、營養均衡、符合口味偏好等）。優先考慮高評分的組合方向，避免低評分組合。

回傳格式（只回傳 JSON）：
[
  {
    "recipe_id": "uuid",
    "reason": "推薦理由（一句話）"
  }
]

只推薦食譜庫中有的食譜（必須使用 recipe_id）。若食譜庫為空，回傳空陣列 []。`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return NextResponse.json({ error: '推薦失敗' }, { status: 500 })

    const jsonStr = content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const recommendations = JSON.parse(jsonStr)

    // Enrich with recipe data
    const enriched = recommendations
      .map((rec: { recipe_id: string; reason: string }) => {
        const recipe = (recipes ?? []).find(r => r.id === rec.recipe_id)
        if (!recipe) return null
        return { ...rec, recipe }
      })
      .filter(Boolean)

    return NextResponse.json({ recommendations: enriched })
  } catch (err) {
    console.error('recommend-recipes error:', err)
    return NextResponse.json({ error: '推薦失敗' }, { status: 500 })
  }
}
