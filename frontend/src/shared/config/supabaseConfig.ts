export const supabaseEnvKeys = {
  url: 'VITE_SUPABASE_URL',
  anonKey: 'VITE_SUPABASE_ANON_KEY',
} as const

export type SupabaseConfig = {
  url: string
  anonKey: string
}

export function readSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!url || !anonKey) return null

  return {
    url,
    anonKey,
  }
}

export const supabaseMissingEnvMessage =
  `Supabase env is not configured. Add ${supabaseEnvKeys.url} and ${supabaseEnvKeys.anonKey} to frontend/.env.local when you are ready to replace mock data.`
