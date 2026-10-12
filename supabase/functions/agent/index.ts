import { createAgentHandler } from './handler.ts'

function required(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value.replace(/\/$/, '')
}

Deno.serve(
  createAgentHandler({
    supabaseUrl: required('SUPABASE_URL'),
    publishableKey: required('FLOWTIME_PUBLISHABLE_KEY'),
    resourceUrl: required('FLOWTIME_AGENT_URL'),
    clientIds: (Deno.env.get('FLOWTIME_AGENT_CLIENT_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  })
)
