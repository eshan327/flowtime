import { supabase } from './supabaseClient'
import type { Json } from '@/types/supabase'

export interface FlowtimePage<T> {
  items: T[]
  next_cursor: Json | null
  next_offset: number | null
  revision: string
}
export async function readFlowtime<T>(
  operation: string,
  input: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.rpc('flowtime_read', { operation, input: input as Json })
  if (error) throw error
  return data as T
}
export async function commandFlowtime<T>(
  operation: string,
  input: Record<string, unknown>,
  requestId: string = crypto.randomUUID()
): Promise<T> {
  const { data, error } = await supabase.rpc('flowtime_command', {
    operation,
    input: input as Json,
    request_id: requestId,
  })
  if (error) throw error
  return data as T
}
export async function readAllFlowtime<T>(
  operation: string,
  input: Record<string, unknown> = {}
): Promise<T[]> {
  const result: T[] = []
  let cursor: Json | null = null
  do {
    const page: FlowtimePage<T> = await readFlowtime<FlowtimePage<T>>(operation, {
      ...input,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    result.push(...page.items)
    cursor = page.next_cursor
  } while (cursor)
  return result
}
