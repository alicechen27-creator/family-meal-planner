import { redirect } from 'next/navigation'

export default function NewRecipePage() {
  redirect('/admin/recipes/new')
}
