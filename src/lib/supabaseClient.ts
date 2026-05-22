import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string)

function warmupSupabaseOrigin(url: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return
  }

  if (document.head.querySelector(`link[data-flowtime-origin="${origin}"]`)) {
    return
  }

  const dnsPrefetch = document.createElement('link')
  dnsPrefetch.rel = 'dns-prefetch'
  dnsPrefetch.href = origin
  dnsPrefetch.setAttribute('data-flowtime-origin', origin)

  const preconnect = document.createElement('link')
  preconnect.rel = 'preconnect'
  preconnect.href = origin
  preconnect.crossOrigin = 'anonymous'
  preconnect.setAttribute('data-flowtime-origin', origin)

  document.head.append(dnsPrefetch, preconnect)
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY)'
  )
}

warmupSupabaseOrigin(supabaseUrl)

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
