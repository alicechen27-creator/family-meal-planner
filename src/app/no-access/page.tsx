export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">沒有週晚餐規劃權限</h1>
        <p className="mt-2 text-sm text-gray-500">請聯繫家庭管理員開啟此系統的存取權。</p>
        <a
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          返回登入
        </a>
      </div>
    </div>
  )
}
