import { getSupabaseClient } from './supabaseClient'

export type TutorAuthPayload = {
  email: string
  password: string
}

export type RegisterTutorPayload = TutorAuthPayload & {
  name: string
  phone: string
}

export type AuthOperationResult = {
  ok: boolean
  error: string | null
  needsEmailConfirmation?: boolean
}

function missingClientResult(): AuthOperationResult {
  return {
    ok: false,
    error: 'Supabase env не настроены. Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, чтобы проверить реальную авторизацию.',
  }
}

function authErrorMessage(error: unknown) {
  if (import.meta.env.DEV) {
    console.error('Supabase auth error:', error)
  }

  if (error instanceof Error) return error.message

  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown
      error_description?: unknown
      error?: unknown
      code?: unknown
      status?: unknown
    }

    const message = maybeError.message || maybeError.error_description || maybeError.error
    if (typeof message === 'string' && message.trim()) return message

    const details = [maybeError.code, maybeError.status].filter(Boolean).join(', ')
    if (details) return `Ошибка авторизации Supabase: ${details}`
  }

  return 'Не удалось выполнить действие авторизации.'
}

export async function ensureTutorProfile(payload: { name: string; email: string; phone: string }): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const user = sessionData.session?.user

    if (!user) {
      return {
        ok: false,
        error: 'Профиль репетитора можно создать только после входа.',
      }
    }

    const { error } = await supabase
      .from('tutors')
      .upsert(
        {
          auth_user_id: user.id,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
        },
        { onConflict: 'auth_user_id' },
      )

    if (error) throw error

    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}

export async function registerTutor(payload: RegisterTutorPayload): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          name: payload.name,
          phone: payload.phone,
          role: 'tutor',
        },
      },
    })

    if (error) throw error

    if (data.session) {
      const profileResult = await ensureTutorProfile({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      })
      if (!profileResult.ok) return profileResult
    }

    return {
      ok: true,
      error: null,
      needsEmailConfirmation: !data.session,
    }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}

export async function signInTutor(payload: TutorAuthPayload): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    })

    if (error) throw error

    const metadata = data.user.user_metadata
    const profileResult = await ensureTutorProfile({
      name: typeof metadata.name === 'string' ? metadata.name : 'Репетитор',
      email: data.user.email || payload.email,
      phone: typeof metadata.phone === 'string' ? metadata.phone : '+70000000000',
    })
    if (!profileResult.ok) return profileResult

    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}

export async function signOutTutor(): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return { ok: true, error: null }

  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}

export async function sendPasswordRecoveryEmail(email: string): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw error
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}

export async function resendTutorConfirmation(email: string): Promise<AuthOperationResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    if (error) throw error
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) }
  }
}
