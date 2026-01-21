import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Quick DB connectivity check
    const { error } = await supabase.from('tenants').select('id').limit(1)
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (acceptable)
      return NextResponse.json(
        { status: 'error', message: 'Database connectivity issue' },
        { status: 503 }
      )
    }
    
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Service unavailable' },
      { status: 503 }
    )
  }
}
