'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { COMPONENT_CONFIG, RECIPE_TYPE_CONFIG } from '@/lib/types'

interface Component { id: string; type: string; name: string }
interface Recipe {
  id: string
  title: string
  type: 'split' | 'all_in_one'
  description: string | null
  photo_url: string | null
  servings: number
  recipe_components: Component[]
}

interface Props {
  recipes: Recipe[]
  ratingsMap?: Record<string, { avg: number; count: number }>
}

export default function RecipeListView({ recipes, ratingsMap }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'split' | 'all_in_one'>('all')

  const filtered = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || r.type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋食譜..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <div className="flex gap-1">
          {(['all', 'split', 'all_in_one'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${typeFilter === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t === 'all' ? '全部' : RECIPE_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📖</div>
          <p>{search ? '找不到符合的食譜' : '食譜庫還是空的'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Link key={r.id} href={`/recipes/${r.id}`} className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 transition-colors">
              {r.photo_url ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={r.photo_url} alt={r.title} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{RECIPE_TYPE_CONFIG[r.type].emoji}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {RECIPE_TYPE_CONFIG[r.type].label}
                  </span>
                  {ratingsMap?.[r.id] && (
                    <span className="text-xs text-amber-500 flex-shrink-0">
                      ⭐ {ratingsMap[r.id].avg.toFixed(1)}
                      <span className="text-gray-300 ml-0.5">({ratingsMap[r.id].count})</span>
                    </span>
                  )}
                </div>
                {r.description && <p className="text-xs text-gray-400 truncate mb-1">{r.description}</p>}
                {r.type === 'split' && r.recipe_components.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.recipe_components.map(c => (
                      <span key={c.id} className={`text-xs px-1.5 py-0.5 rounded-full ${COMPONENT_CONFIG[c.type as keyof typeof COMPONENT_CONFIG]?.bg} ${COMPONENT_CONFIG[c.type as keyof typeof COMPONENT_CONFIG]?.color}`}>
                        {COMPONENT_CONFIG[c.type as keyof typeof COMPONENT_CONFIG]?.emoji} {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-gray-300 text-sm flex-shrink-0 self-center">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
