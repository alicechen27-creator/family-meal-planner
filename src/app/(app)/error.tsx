'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-6 text-center">
      <p className="text-red-600 font-medium">頁面發生錯誤</p>
      <p className="text-sm text-gray-500 mt-1">{error.message}</p>
    </div>
  )
}
