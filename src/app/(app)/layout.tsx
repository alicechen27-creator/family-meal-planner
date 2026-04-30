import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MemberNav from '@/components/member/MemberNav'
import PushSubscriber from '@/components/member/PushSubscriber'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <MemberNav profile={profile} isAdmin={isAdmin} />
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pb-24 pt-4">
        {vapidPublicKey && <PushSubscriber vapidPublicKey={vapidPublicKey} />}
        {children}
      </main>
    </div>
  )
}
