'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FileSource = 'upload' | 'link'

export type FileItem = {
  id: string
  tenant_id: string
  user_id: string
  title: string
  description: string
  file_type: FileSource
  storage_path: string | null
  url: string | null
  mime_type: string | null
  size_bytes: number | null
  original_name: string | null
  visibility: 'private' | 'org'
  created_at: string
  updated_at: string
  tags?: { id: string; name: string; color: string }[]
}

export async function getFiles(tenantId: string, search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('files')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,url.ilike.%${search}%,original_name.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as FileItem[]
}

export async function createFile(
  tenantId: string,
  file: {
    title?: string
    description?: string
    file_type: FileSource
    storage_path?: string | null
    url?: string | null
    mime_type?: string | null
    size_bytes?: number | null
    original_name?: string | null
    visibility?: 'private' | 'org'
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      title: file.title || '',
      description: file.description || '',
      file_type: file.file_type,
      storage_path: file.storage_path || null,
      url: file.url || null,
      mime_type: file.mime_type || null,
      size_bytes: file.size_bytes ?? null,
      original_name: file.original_name || null,
      visibility: file.visibility || 'private'
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/app/files')
  return data as FileItem
}

export async function updateFile(
  id: string,
  updates: Partial<Pick<FileItem, 'title' | 'description' | 'visibility'>>
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('files')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  revalidatePath('/app/files')
  return data as FileItem
}

export async function deleteFile(id: string) {
  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('files')
    .select('file_type, storage_path')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  if (existing?.file_type === 'upload' && existing.storage_path) {
    const { error: storageError } = await supabase
      .storage
      .from('Files')
      .remove([existing.storage_path])
    if (storageError) throw storageError
  }

  const { error: tagError } = await supabase
    .from('item_tags')
    .delete()
    .eq('item_type', 'file')
    .eq('item_id', id)
  if (tagError) throw tagError

  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (error) throw error

  revalidatePath('/app/files')
  return { success: true }
}
