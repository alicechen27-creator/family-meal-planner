'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WEEKDAYS } from '@/lib/types'

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function CreateWeekForm() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(() => formatDate(getMonday(new Date())))
  const [availableDays, setAvailableDays] = useState<boolean[]>([true, true, true, true, true, false, false])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart + 'T00:00:00'), i)
    return { date: formatDate(d), weekday: WEEKDAYS[i] }
  })

  function toggleDay(i: number) {
    setAvailableDays(prev => { const a = [...prev]; a[i] = !a[i]; return a })
  }

  async function handleSubmit() {
    if (!availableDays.some(Boolean)) { setError('請至少選擇一天'); return }
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    const { data: week, error: weekError } = await supabase
      .from('week_plans')
      .insert({ week_start: weekStart })
      .select().single()

    if (weekError) {
      setError(weekError.code === '23505' ? '這一週的計畫已經存在' : '建立失敗：' + weekError.message)
      setSubmitting(false)
      return
    }

    await supabase.from('meal_slots').insert(
      weekDates.map((d, i) => ({
        week_plan_id: week.id,
        slot_date: d.date,
        weekday: d.weekday,
        is_available: availableDays[i],
      }))
    )

    // Send push notification to family members
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🍽️ 本週晚餐計畫已開放！',
        body: `${weekStart} 起的一週，快來選你的晚餐！`,
        url: '/',
      }),
    }).catch(() => {}) // non-blocking, ignore failures

    router.push(`/admin/week/${week.id}`)
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">週起始日期（週一）</label>
        <input
          type="date"
          value={weekStart}
          onChange={e => {
            const d = new Date(e.target.value + 'T00:00:00')
            setWeekStart(formatDate(getMonday(d)))
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">選擇開放選擇的日期</h2>
        <div className="space-y-2">
          {weekDates.map((d, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={availableDays[i]}
                onChange={() => toggleDay(i)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="font-medium text-gray-800 w-10">{d.weekday}</span>
              <span className="text-sm text-gray-400">{d.date}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
      >
        {submitting ? '建立中...' : '建立本週計畫'}
      </button>
    </div>
  )
}
