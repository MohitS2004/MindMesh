'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ItemType = 'note' | 'task' | 'file' | 'reminder'

export type Tag = {
  id: string
  tenant_id: string
  name: string
  color: string
  created_at: string
}

// Only return tags that are assigned to at least one item of the given type
export async function getUsedTags(tenantId: string, itemType: ItemType) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*, item_tags: item_tags!inner(id)')
    .eq('tenant_id', tenantId)
    .eq('item_type', itemType)
    .not('item_tags.id', 'is', null)
    .order('name')
  if (error) throw error
  // Remove duplicate tags (since join can duplicate rows)
  const unique = Object.values(
    (data || []).reduce((acc: any, tag: any) => {
      acc[tag.id] = tag
      return acc
    }, {})
  )
  return unique as Tag[]
}


// Now requires itemType: 'note' | 'task' | 'file'
export async function getTags(tenantId: string, itemType: ItemType) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('item_type', itemType)
    .order('name')
  if (error) throw error
  return data as Tag[]
}

// Now requires itemType: 'note' | 'task' | 'file'
export async function createTag(tenantId: string, itemType: ItemType, name: string, color?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .insert({
      tenant_id: tenantId,
      item_type: itemType,
      name: name.trim().toLowerCase(),
      color: color || getRandomColor()
    })
    .select()
    .single()
  if (error) {
    // If tag already exists, return existing
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_type', itemType)
        .ilike('name', name.trim())
        .single()
      return existing as Tag
    }
    throw error
  }
  revalidatePath('/app/notes')
  revalidatePath('/app/tasks')
  revalidatePath('/app/files')
  revalidatePath('/app/reminders')
  return data as Tag
}

export async function deleteTag(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  
  revalidatePath('/app/notes')
  revalidatePath('/app/tasks')
  revalidatePath('/app/files')
  revalidatePath('/app/reminders')
  return { success: true }
}

export async function getItemTags(itemType: ItemType, itemId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('item_tags')
    .select('tag_id, tags(*)')
    .eq('item_type', itemType)
    .eq('item_id', itemId)
  
  if (error) throw error
  return (data || []).map((it: any) => it.tags).filter(Boolean) as Tag[]
}

export async function addTagToItem(tagId: string, itemType: ItemType, itemId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('item_tags')
    .insert({
      tag_id: tagId,
      item_type: itemType,
      item_id: itemId
    })
  
  if (error && error.code !== '23505') throw error
  
  revalidatePath('/app/notes')
  revalidatePath('/app/tasks')
  revalidatePath('/app/files')
  revalidatePath('/app/reminders')
  return { success: true }
}

export async function removeTagFromItem(tagId: string, itemType: ItemType, itemId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('item_tags')
    .delete()
    .eq('tag_id', tagId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
  
  if (error) throw error
  
  revalidatePath('/app/notes')
  revalidatePath('/app/tasks')
  revalidatePath('/app/files')
  revalidatePath('/app/reminders')
  return { success: true }
}

function getRandomColor() {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
