'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** The browser client for the admin panel: anon key + the admin's own session. Null when not configured. */
export function supabase(): SupabaseClient | null {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: true, storageKey: 'phinas-admin' } })
  return client
}
