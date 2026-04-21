import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error('usage: tsx scripts/admin-reset-password.ts <email> <new_password>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const { data: list, error: listErr } = await supabase.auth.admin.listUsers()
if (listErr) { console.error(listErr); process.exit(1) }

const user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
if (!user) { console.error(`找不到使用者：${email}`); process.exit(1) }

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
  email_confirm: true,
})
if (error) { console.error(error); process.exit(1) }

console.log(`✓ 已重設 ${email} 的密碼`)
console.log(`  user id: ${user.id}`)
console.log(`  email_confirmed_at: ${user.email_confirmed_at ?? '(原本為 null，已設為 confirmed)'}`)
