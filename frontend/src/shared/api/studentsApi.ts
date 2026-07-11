import type {
  ApiResult,
  CreateStudentPayload,
  CreateStudentResult,
  RegenerateStudentTokenResult,
  StudentListFilters,
  UpdateStudentPayload,
} from './contracts'
import type { Student } from '../../types/domain'
import { studentUrl } from '../../utils/format'
import { getSupabaseClient } from './supabaseClient'
import { mapStudent } from '../mappers/studentMapper'
import type { StudentRow } from '../mappers/studentMapper'

type TutorIdResult = ApiResult<{ tutorId: string }>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function missingClientResult<T>(): ApiResult<T> {
  return {
    data: null,
    error: 'Supabase env не настроены. Действие выполнено только в mock-режиме.',
  }
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить действие с учеником.'
}

function toNullableText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toStudentPayload(payload: CreateStudentPayload | UpdateStudentPayload) {
  const isArchived = payload.status === 'archived'

  return {
    name: payload.name.trim(),
    subject: payload.subject.trim(),
    grade: toNullableText(payload.grade),
    student_contact: toNullableText(payload.studentContact),
    parent_contact: toNullableText(payload.parentContact),
    lesson_price: payload.lessonPrice ?? null,
    lesson_duration_minutes: payload.lessonDurationMinutes ?? null,
    comment: toNullableText(payload.comment),
    status: payload.status,
    schedule_text: toNullableText(payload.schedule),
    goals_text: toNullableText(payload.goals),
    meeting_url: toNullableText(payload.meetingUrl),
    archived_at: isArchived ? new Date().toISOString() : null,
  }
}

function generatePlaintextToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getCurrentTutorId(): Promise<TutorIdResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const user = sessionData.session?.user
    if (!user) {
      return { data: null, error: 'Войдите как репетитор, чтобы изменить учеников.' }
    }

    const { data, error } = await supabase
      .from('tutors')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return { data: null, error: 'Профиль репетитора в tutors не найден.' }

    return { data: { tutorId: data.id }, error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

async function fetchStudent(studentId: string, plaintextToken = ''): Promise<ApiResult<Student>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        name,
        subject,
        grade,
        student_contact,
        parent_contact,
        lesson_price,
        lesson_duration_minutes,
        comment,
        status,
        schedule_text,
        goals_text,
        meeting_url,
        has_unread_updates_for_student,
        useful_links (
          id,
          title,
          url,
          sort_order
        ),
        update_events (
          id,
          event_type,
          created_at,
          is_seen_by_student,
          lessons!update_events_lesson_id_fkey(
            topic
          )
        )
      `)
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw error
    if (!data) return { data: null, error: 'Ученик не найден.' }

    return { data: mapStudent(data as unknown as StudentRow, plaintextToken), error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

async function syncUsefulLinks(studentId: string, links: CreateStudentPayload['usefulLinks']) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { data: existingRows, error: listError } = await supabase
    .from('useful_links')
    .select('id')
    .eq('student_id', studentId)

  if (listError) throw listError

  const nextPersistedIds = new Set(links.filter((link) => uuidPattern.test(link.id)).map((link) => link.id))
  const idsToDelete = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => !nextPersistedIds.has(id))

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from('useful_links').delete().in('id', idsToDelete)
    if (error) throw error
  }

  await Promise.all(
    links.map(async (link, index) => {
      if (uuidPattern.test(link.id)) {
        const { error } = await supabase
          .from('useful_links')
          .update({
            title: link.title.trim(),
            url: link.url.trim(),
            sort_order: index,
          })
          .eq('id', link.id)
          .eq('student_id', studentId)

        if (error) throw error
        return
      }

      const { error } = await supabase.from('useful_links').insert({
        student_id: studentId,
        title: link.title.trim(),
        url: link.url.trim(),
        sort_order: index,
      })

      if (error) throw error
    }),
  )
}

export async function listStudents(filters: StudentListFilters = {}): Promise<ApiResult<Student[]>> {
  void filters
  return {
    data: null,
    error: 'listStudents пока не используется напрямую: кабинет загружает учеников через getTutorWorkspace.',
  }
}

export async function createStudentWithToken(payload: CreateStudentPayload): Promise<ApiResult<CreateStudentResult>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  const tutorResult = await getCurrentTutorId()
  if (!tutorResult.data) return { data: null, error: tutorResult.error }

  try {
    const plaintextToken = generatePlaintextToken()
    const accessTokenHash = await hashToken(plaintextToken)

    const { data, error } = await supabase
      .from('students')
      .insert({
        ...toStudentPayload(payload),
        tutor_id: tutorResult.data.tutorId,
        access_token_hash: accessTokenHash,
        access_token_created_at: new Date().toISOString(),
        has_unread_updates_for_student: false,
      })
      .select('id')
      .single()

    if (error) throw error

    await syncUsefulLinks(data.id, payload.usefulLinks)

    const studentResult = await fetchStudent(data.id, plaintextToken)
    if (!studentResult.data) return { data: null, error: studentResult.error }

    return {
      data: {
        student: studentResult.data,
        studentUrl: studentUrl(plaintextToken),
        plaintextToken,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function updateStudent(payload: UpdateStudentPayload): Promise<ApiResult<Student>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase
      .from('students')
      .update(toStudentPayload(payload))
      .eq('id', payload.id)

    if (error) throw error

    await syncUsefulLinks(payload.id, payload.usefulLinks)

    return fetchStudent(payload.id)
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function archiveStudent(studentId: string): Promise<ApiResult<Student>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase
      .from('students')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', studentId)

    if (error) throw error
    return fetchStudent(studentId)
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function regenerateStudentToken(studentId: string): Promise<ApiResult<RegenerateStudentTokenResult>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const plaintextToken = generatePlaintextToken()
    const accessTokenHash = await hashToken(plaintextToken)
    const { error } = await supabase
      .from('students')
      .update({
        access_token_hash: accessTokenHash,
        access_token_created_at: new Date().toISOString(),
        has_unread_updates_for_student: false,
      })
      .eq('id', studentId)

    if (error) throw error

    return {
      data: {
        studentId,
        studentUrl: studentUrl(plaintextToken),
        plaintextToken,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}
