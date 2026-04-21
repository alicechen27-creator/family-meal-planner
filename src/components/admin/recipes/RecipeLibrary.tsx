'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Recipe, RecipeComponent } from '@/lib/types'
import { COMPONENT_CONFIG, RECIPE_TYPE_CONFIG } from '@/lib/types'

type RecipeWithComponents = Recipe & { recipe_components: Pick<RecipeComponent, 'id' | 'type' | 'name'>[] }

interface Props {
  initialRecipes: RecipeWithComponents[]
}

export default function RecipeLibrary({ initialRecipes }: Props) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'split' | 'all_in_one'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  const filtered = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || r.type === typeFilter
    return matchSearch && matchType
  })

  async function handleDelete(id: string) {
    if (!confirm('確定要刪除這個食譜嗎？')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(recipes.filter(r => r.id !== id))
    setDeleting(null)
    router.refresh()
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋食譜..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <div className="flex gap-1">
          {(['all', 'split', 'all_in_one'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${typeFilter === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'all' ? '全部' : RECIPE_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📖</div>
          <p>{search ? '找不到符合的食譜' : '還沒有食譜，點擊「新增食譜」開始'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex gap-4 p-4">
                {recipe.photo_url ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <Image src={recipe.photo_url} alt={recipe.title} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">{RECIPE_TYPE_CONFIG[recipe.type].emoji}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{recipe.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {RECIPE_TYPE_CONFIG[recipe.type].label}
                        </span>
                        <span className="text-xs text-gray-400">{recipe.servings} 人份</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link href={`/admin/recipes/${recipe.id}`}
                        className="text-xs text-orange-500 hover:text-orange-700 px-3 py-1.5 border border-orange-200 rounded-lg">
                        編輯
                      </Link>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        disabled={deleting === recipe.id}
                        className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-red-100 rounded-lg disabled:opacity-50">
                        {deleting === recipe.id ? '...' : '刪除'}
                      </button>
                    </div>
                  </div>

                  {recipe.type === 'split' && recipe.recipe_components.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {recipe.recipe_components.map(c => (
                        <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full ${COMPONENT_CONFIG[c.type].bg} ${COMPONENT_CONFIG[c.type].color}`}>
                          {COMPONENT_CONFIG[c.type].emoji} {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
