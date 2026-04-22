import { createClient } from '@/lib/supabase/server'
import { COMPONENT_CONFIG } from '@/lib/types'
import CloseWeekButton from '@/components/admin/cook/CloseWeekButton'
import Link from 'next/link'

export default async function CookPage() {
  const supabase = await createClient()

  const { data: weekPlan } = await supabase
    .from('week_plans')
    .select('*')
    .eq('status', 'open')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!weekPlan) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">本週食譜</h1>
        <div className="text-center py-16 text-gray-400">目前沒有開放中的週計畫</div>
      </div>
    )
  }

  const { data: slots } = await supabase
    .from('meal_slots')
    .select(`
      slot_date,
      weekday,
      meal_selections(
        selection_type,
        starch_component:recipe_components!starch_component_id(
          name, type, instructions,
          recipe_component_ingredients(name, amount, unit),
          recipes(title, instructions)
        ),
        meat_component:recipe_components!meat_component_id(
          name, type, instructions,
          recipe_component_ingredients(name, amount, unit),
          recipes(title, instructions)
        ),
        veggie_component:recipe_components!veggie_component_id(
          name, type, instructions,
          recipe_component_ingredients(name, amount, unit),
          recipes(title, instructions)
        ),
        sauce_component:recipe_components!sauce_component_id(
          name, type, instructions,
          recipe_component_ingredients(name, amount, unit),
          recipes(title, instructions)
        ),
        recipe:recipes!recipe_id(id, title, description, instructions, recipe_ingredients(name, amount, unit))
      )
    `)
    .eq('week_plan_id', weekPlan.id)
    .order('slot_date')

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">本週食譜</h1>
        <Link
          href={`/admin/week/${weekPlan.id}`}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          管理本週 →
        </Link>
      </div>
      <p className="text-sm text-gray-400 mb-6">{weekPlan.week_start} 這週的烹調清單</p>

      <div className="space-y-6">
        {(slots ?? []).map(slot => {
          const selection = slot.meal_selections as any
          const isToday = slot.slot_date === today

          return (
            <div
              key={slot.slot_date}
              className={`rounded-2xl border p-5 ${isToday ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-white'}`}
            >
              <div className="flex items-center gap-2 mb-4">
                {isToday && (
                  <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">今天</span>
                )}
                <h2 className="font-semibold text-gray-800">
                  {slot.weekday}・{slot.slot_date}
                </h2>
              </div>

              {!selection ? (
                <p className="text-sm text-gray-400">尚未有人選餐</p>
              ) : selection.selection_type === 'all_in_one' && selection.recipe ? (
                <AllInOneView recipe={selection.recipe} />
              ) : (
                <SplitView selection={selection} />
              )}
            </div>
          )
        })}
      </div>

      <CloseWeekButton weekPlanId={weekPlan.id} />
    </div>
  )
}

function AllInOneView({ recipe }: { recipe: any }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-gray-800 mb-1">{recipe.title}</h3>
        {recipe.description && (
          <p className="text-sm text-gray-500 mb-3">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(recipe.recipe_ingredients ?? []).map((ing: any, i: number) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
              {ing.name}{ing.amount ? ` ${ing.amount}${ing.unit ?? ''}` : ''}
            </span>
          ))}
        </div>
      </div>
      {recipe.instructions && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">烹調步驟</h4>
          <div className="text-sm text-gray-600 whitespace-pre-line bg-white/70 rounded-xl px-4 py-3 border border-gray-100">
            {recipe.instructions}
          </div>
        </div>
      )}
    </div>
  )
}

function SplitView({ selection }: { selection: any }) {
  const compKeys = ['starch_component', 'meat_component', 'veggie_component', 'sauce_component'] as const

  // Collect unique assembly steps from component parent recipes
  const assemblySteps: { title: string; instructions: string }[] = []
  const seenTitles = new Set<string>()
  for (const key of compKeys) {
    const comp = selection[key]
    if (comp?.recipes?.instructions && comp.recipes.title && !seenTitles.has(comp.recipes.title)) {
      seenTitles.add(comp.recipes.title)
      assemblySteps.push({ title: comp.recipes.title, instructions: comp.recipes.instructions })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {compKeys.map(key => {
          const comp = selection[key]
          if (!comp) return null
          const compType = comp.type as keyof typeof COMPONENT_CONFIG
          const config = COMPONENT_CONFIG[compType]
          return (
            <div key={key} className={`rounded-xl border p-3 ${config.bg} ${config.border}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{config.emoji}</span>
                <span className={`text-sm font-medium ${config.color}`}>{comp.name}</span>
                {comp.recipes?.title && (
                  <span className="text-xs text-gray-400 ml-1">（{comp.recipes.title}）</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(comp.recipe_component_ingredients ?? []).map((ing: any, i: number) => (
                  <span key={i} className="text-xs bg-white/70 text-gray-600 px-2 py-0.5 rounded-lg">
                    {ing.name}{ing.amount ? ` ${ing.amount}${ing.unit ?? ''}` : ''}
                  </span>
                ))}
              </div>
              {comp.instructions && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">烹調方式</p>
                  <div className="text-xs text-gray-600 whitespace-pre-line bg-white/60 rounded-lg px-3 py-2">
                    {comp.instructions}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {assemblySteps.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">🍽️ 組合 / 擺盤步驟</p>
          {assemblySteps.map((step, i) => (
            <div key={i} className={i > 0 ? 'mt-3' : ''}>
              {assemblySteps.length > 1 && (
                <p className="text-xs font-medium text-gray-500 mb-1">{step.title}</p>
              )}
              <div className="text-xs text-gray-600 whitespace-pre-line">
                {step.instructions}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
