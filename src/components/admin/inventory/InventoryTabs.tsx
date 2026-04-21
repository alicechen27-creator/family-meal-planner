'use client'

import { useState } from 'react'
import type { IngredientCatalogEntry, HomeInventoryItem } from '@/lib/types'
import CatalogManager from './CatalogManager'
import HomeInventoryManager from './HomeInventoryManager'

interface Props {
  catalog: IngredientCatalogEntry[]
  inventory: HomeInventoryItem[]
}

export default function InventoryTabs({ catalog, inventory }: Props) {
  const [tab, setTab] = useState<'inventory' | 'catalog'>('inventory')

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('inventory')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === 'inventory' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          🧺 家裡庫存
        </button>
        <button onClick={() => setTab('catalog')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === 'catalog' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          📋 食材目錄
        </button>
      </div>
      {tab === 'inventory'
        ? <HomeInventoryManager initialInventory={inventory} catalog={catalog} />
        : <CatalogManager initialCatalog={catalog} />
      }
    </div>
  )
}
