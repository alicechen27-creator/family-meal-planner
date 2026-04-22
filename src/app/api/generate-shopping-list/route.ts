import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { weekPlanId } = await req.json()
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Fetch all slots with selections and their ingredients
  const { data: slots, error: slotsError } = await supabase
    .from('meal_slots')
    .select(`
      slot_date,
      meal_selections(
        selection_type,
        starch_component:recipe_components!starch_component_id(
          name,
          recipe_component_ingredients(name, amount, unit, channel)
        ),
        meat_component:recipe_components!meat_component_id(
          name,
          recipe_component_ingredients(name, amount, unit, channel)
        ),
        veggie_component:recipe_components!veggie_component_id(
          name,
          recipe_component_ingredients(name, amount, unit, channel)
        ),
        sauce_component:recipe_components!sauce_component_id(
          name,
          recipe_component_ingredients(name, amount, unit, channel)
        ),
        recipe:recipes!recipe_id(
          title,
          recipe_ingredients(name, amount, unit, channel)
        )
      )
    `)
    .eq('week_plan_id', weekPlanId)

  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 })

  // Fetch home inventory to cross-reference
  const { data: inventory } = await supabase
    .from('home_inventory')
    .select('ingredient_name')

  const inventoryNames = new Set((inventory ?? []).map(i => i.ingredient_name.toLowerCase().trim()))

  // Fetch ingredient catalog for channel/staple info
  const { data: catalog } = await supabase
    .from('ingredient_catalog')
    .select('name, default_channel, is_staple')

  const catalogMap = new Map(
    (catalog ?? []).map(c => [c.name.toLowerCase().trim(), c])
  )

  // Aggregate ingredients from all selections
  // key: ingredientName -> { name, amounts, unit, channel, is_staple, for_recipe_title, for_date }
  type AggregatedItem = {
    ingredient_name: string
    amounts: string[]
    unit: string | null
    channel_name: string | null
    is_staple: boolean
    for_recipe_title: string | null
    for_date: string | null
  }
  const itemMap = new Map<string, AggregatedItem>()

  function addIngredients(
    ingredients: { name: string; amount: string | null; unit: string | null; channel?: string | null }[],
    recipeName: string | null,
    slotDate: string
  ) {
    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim()
      const catalogEntry = catalogMap.get(key)
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!
        if (ing.amount) existing.amounts.push(ing.amount)
      } else {
        itemMap.set(key, {
          ingredient_name: ing.name,
          amounts: ing.amount ? [ing.amount] : [],
          unit: ing.unit ?? null,
          channel_name: ing.channel || catalogEntry?.default_channel || null,
          is_staple: catalogEntry?.is_staple ?? false,
          for_recipe_title: recipeName,
          for_date: slotDate,
        })
      }
    }
  }

  for (const slot of slots ?? []) {
    const selection = slot.meal_selections as any
    if (!selection) continue

    if (selection.selection_type === 'all_in_one') {
      const ingredients = selection.recipe?.recipe_ingredients ?? []
      addIngredients(ingredients, selection.recipe?.title ?? null, slot.slot_date)
    } else {
      for (const key of ['starch_component', 'meat_component', 'veggie_component', 'sauce_component'] as const) {
        const comp = selection[key]
        if (!comp) continue
        addIngredients(comp.recipe_component_ingredients ?? [], comp.name, slot.slot_date)
      }
    }
  }

  // Filter out items already in home inventory (non-staple items)
  const itemsToInsert = Array.from(itemMap.values())
    .filter(item => !inventoryNames.has(item.ingredient_name.toLowerCase().trim()))
    .map(item => ({
      week_plan_id: weekPlanId,
      ingredient_name: item.ingredient_name,
      total_amount: item.amounts.length > 0 ? item.amounts.join(' + ') : null,
      unit: item.unit,
      channel_name: item.channel_name,
      is_staple: item.is_staple,
      for_recipe_title: item.for_recipe_title,
      for_date: item.for_date,
      is_checked: false,
    }))

  // Delete any previous shopping list items for this week (idempotent)
  await supabase.from('shopping_list_items').delete().eq('week_plan_id', weekPlanId)

  if (itemsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('shopping_list_items').insert(itemsToInsert)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Close the week
  const { error: closeError } = await supabase
    .from('week_plans')
    .update({ status: 'closed' })
    .eq('id', weekPlanId)

  if (closeError) return NextResponse.json({ error: closeError.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: itemsToInsert.length })
}
