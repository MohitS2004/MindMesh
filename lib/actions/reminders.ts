'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Reminder = {
  id: string
  tenant_id: string
  user_id: string
  title: string
  remind_at: string
  visibility: 'private' | 'org'
  created_at: string
  updated_at: string
}

export async function getReminders(tenantId: string, search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('remind_at', { ascending: true })

  if (search) {
    query = query.or(`title.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Reminder[]
}

export async function createReminder(tenantId: string, reminder: { title: string; remind_at: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: reminder.title,
      remind_at: reminder.remind_at,
      visibility: 'private'
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/app/reminders')
  return data as Reminder
}

export async function updateReminder(
  id: string,
  updates: Partial<Pick<Reminder, 'title' | 'remind_at' | 'visibility'>>
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  revalidatePath('/app/reminders')
  return data as Reminder
}

export async function deleteReminder(id: string) {
  const supabase = await createClient()

  const { error: tagError } = await supabase
    .from('item_tags')
    .delete()
    .eq('item_type', 'reminder')
    .eq('item_id', id)
  if (tagError) throw tagError

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)

  if (error) throw error

  revalidatePath('/app/reminders')
  return { success: true }
}
