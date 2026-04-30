import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminNav profile={profile} />
      <main className="md:ml-56 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
    </div>
  )
}
