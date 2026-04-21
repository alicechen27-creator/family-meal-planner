'use client'

import { useState } from 'react'

export const CHANNEL_PRESETS = ['Costco', 'Weee!', "Trader Joe's", 'Stop & Shop']

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
}

export default function ChannelSelect({ value, onChange, className }: Props) {
  const isCustom = value !== '' && !CHANNEL_PRESETS.includes(value)
  const [otherMode, setOtherMode] = useState(isCustom)

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__other__') {
      setOtherMode(true)
      onChange('')
    } else {
      setOtherMode(false)
      onChange(e.target.value)
    }
  }

  const selectVal = otherMode ? '__other__' : value

  return (
    <div className="flex gap-1 flex-wrap">
      <select
        value={selectVal}
        onChange={handleSelectChange}
        className={className ?? 'w-28 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 text-gray-600'}
      >
        <option value="">渠道</option>
        {CHANNEL_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
        <option value="__other__">其他（自填）</option>
      </select>
      {otherMode && (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="填寫渠道名稱"
          autoFocus
          className="w-24 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
        />
      )}
    </div>
  )
}
