import { withRequestTimeout } from './requestTimeout'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string)

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY)'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  global: {
    // Auth refresh requests also need a deadline after Safari suspends the page.
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (init?.signal || !url.startsWith(`${supabaseUrl}/auth/v1/`)) return fetch(input, init)
      return withRequestTimeout((signal) => fetch(input, { ...init, signal }))
    },
  },
})
