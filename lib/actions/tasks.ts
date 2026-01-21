'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export type Task = {
  id: string
  tenant_id: string
  user_id: string
  title: string
  description: string
  status: TaskStatus
  progress: number
  due_date: string | null
  visibility: 'private' | 'org'
  created_at: string
  updated_at: string
  tags?: { id: string; name: string; color: string }[]
}

export async function getTasks(tenantId: string, status?: TaskStatus) {
  const supabase = await createClient()
  
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data as Task[]
}

export async function getTask(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Task
}

export async function createTask(tenantId: string, task: Partial<Pick<Task, 'title' | 'description' | 'due_date' | 'status' | 'progress'>>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')
  
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: task.title || 'Untitled Task',
      description: task.description || '',
      status: task.status || 'todo',
      progress: task.progress || 0,
      due_date: task.due_date || null,
      visibility: 'private'
    })
    .select()
    .single()
  
  if (error) throw error
  
  revalidatePath('/app/tasks')
  return data as Task
}

export async function updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'progress' | 'due_date' | 'visibility'>>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  
  revalidatePath('/app/tasks')
  return data as Task
}

export async function deleteTask(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  
  revalidatePath('/app/tasks')
  return { success: true }
}
