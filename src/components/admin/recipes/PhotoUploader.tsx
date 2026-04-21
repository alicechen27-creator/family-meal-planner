'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Props {
  currentUrl: string | null
  onUpload: (url: string) => void
}

export default function PhotoUploader({ currentUrl, onUpload }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const supabase = createClient()
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`

    const { error: uploadError } = await supabase.storage
      .from('recipe-photos')
      .upload(fileName, file)

    if (uploadError) {
      setError('上傳失敗：' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('recipe-photos')
      .getPublicUrl(fileName)

    onUpload(publicUrl)
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-4">
      {currentUrl ? (
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
          <Image src={currentUrl} alt="封面" fill className="object-cover" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-xl bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
          <span className="text-2xl">🖼️</span>
        </div>
      )}
      <div>
        <label className="cursor-pointer inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-xl transition-colors">
          {uploading ? '上傳中...' : currentUrl ? '更換照片' : '上傳照片'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  )
}
