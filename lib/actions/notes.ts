'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Note = {
  id: string
  tenant_id: string
  user_id: string
  title: string
  body: string
  visibility: 'private' | 'org'
  created_at: string
  updated_at: string
  tags?: { id: string; name: string; color: string }[]
}

export async function getNotes(tenantId: string, search?: string, tagIds?: string[]) {
  const supabase = await createClient()
  
  let query = supabase
    .from('notes')
    .select(`
      *,
      item_tags!inner(tag_id),
      tags:item_tags(tags(*))
    `)
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
  
  if (search) {
    query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  }
  
  const { data, error } = await query
  
  if (error) {
    // Try simpler query without tag joins
    const { data: simpleData, error: simpleError } = await supabase
      .from('notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
    
    if (simpleError) throw simpleError
    return simpleData as Note[]
  }
  
  // Filter by tags if specified
  let notes = data as Note[]
  if (tagIds && tagIds.length > 0) {
    notes = notes.filter(note => {
      const noteTagIds = (note as any).item_tags?.map((it: any) => it.tag_id) || []
      return tagIds.some(tid => noteTagIds.includes(tid))
    })
  }
  
  // Transform tags
  return notes.map(note => ({
    ...note,
    tags: ((note as any).tags || [])
      .map((t: any) => t.tags)
      .filter(Boolean)
  })) as Note[]
}

export async function getNotesSimple(tenantId: string, search?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('notes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
  
  if (search) {
    query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data as Note[]
}

export async function getNote(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Note
}

export async function createNote(tenantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')
  
  const { data, error } = await supabase
    .from('notes')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: '',
      body: '',
      visibility: 'private'
    })
    .select()
    .single()
  
  if (error) throw error
  
  revalidatePath('/app/notes')
  return data as Note
}

export async function updateNote(id: string, updates: Partial<Pick<Note, 'title' | 'body' | 'visibility'>>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Note
}

export async function deleteNote(id: string) {
  const supabase = await createClient()

  // 1. Delete all item_tags for this note
  const { error: tagError } = await supabase
    .from('item_tags')
    .delete()
    .eq('item_type', 'note')
    .eq('item_id', id)
  if (tagError) throw tagError

  // 2. Delete the note itself
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
  if (error) throw error

  // 3. Clean up unused tags (no item_tags reference)
  // (This is a little expensive, but safe for small tag sets)
  const { data: unusedTags } = await supabase
    .rpc('delete_unused_tags', { item_type: 'note' })

  revalidatePath('/app/notes')
  return { success: true }
}

export async function getNoteWithTags(id: string) {
  const supabase = await createClient()
  
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .single()
  
  if (noteError) throw noteError
  
  const { data: itemTags } = await supabase
    .from('item_tags')
    .select('tag_id, tags(*)')
    .eq('item_type', 'note')
    .eq('item_id', id)
  
  return {
    ...note,
    tags: (itemTags || []).map((it: any) => it.tags).filter(Boolean)
  } as Note
}
