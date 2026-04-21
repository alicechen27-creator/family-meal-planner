import RecommendView from '@/components/admin/recommend/RecommendView'

export default function RecommendPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">AI 推薦食譜</h1>
      <p className="text-sm text-gray-400 mb-6">根據家裡庫存，AI 幫你挑本週最適合的晚餐</p>
      <RecommendView />
    </div>
  )
}
