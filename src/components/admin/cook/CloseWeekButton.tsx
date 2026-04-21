'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CloseWeekButton({ weekPlanId }: { weekPlanId: string }) {
  const [closing, setClosing] = useState(false)
  const router = useRouter()

  async function handleClose() {
    if (!confirm('確定要關閉本週計畫並產生採購清單？關閉後成員無法再更改選擇。')) return
    setClosing(true)
    const res = await fetch('/api/generate-shopping-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekPlanId }),
    })
    if (res.ok) {
      router.push(`/admin/shopping/${weekPlanId}`)
    } else {
      setClosing(false)
      alert('關閉失敗，請再試一次')
    }
  }

  return (
    <button
      onClick={handleClose}
      disabled={closing}
      className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors mt-6"
    >
      {closing ? '產生採購清單中...' : '關閉本週並產生採購清單'}
    </button>
  )
}
