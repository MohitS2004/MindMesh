'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getUserMemberships() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('memberships')
    .select(`
      tenant_id,
      role,
      tenants (
        id,
        name,
        slug,
        is_personal
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return { data, error: error?.message }
}

export async function ensurePersonalWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  try {
    const { data, error } = await supabase.rpc('get_or_create_personal_workspace')
    if (error) throw error
    return { data, error: null }
  } catch (e: any) {
    console.error('Failed to ensure personal workspace:', e)
    return { data: null, error: e.message }
  }
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const slug = formData.get('slug') as string

  if (!name || name.length < 2) {
    return { data: null, error: 'Organization name must be at least 2 characters' }
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      created_by: user.id
    })
    .select()
    .single()

  if (tenantError) {
    return { data: null, error: tenantError.message }
  }

  revalidatePath('/app')
  
  return { data: tenant, error: null }
}
