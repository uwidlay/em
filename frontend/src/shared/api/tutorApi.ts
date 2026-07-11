import type { ApiResult, TutorProfileResult, TutorWorkspaceResult } from './contracts'
import { getSupabaseClient } from './supabaseClient'
import { mapLesson } from '../mappers/lessonMapper'
import type { LessonMaterialRow, LessonRow } from '../mappers/lessonMapper'
import { mapStudent } from '../mappers/studentMapper'
import type { StudentRow } from '../mappers/studentMapper'
import type { HomeworkPhotoRow } from '../mappers/homeworkMapper'
import type { Tutor } from '../../types/domain'
import { getLessonFileStoragePath, LESSON_FILE_BUCKET } from '../../utils/lessonFiles'

type TutorRow = {
  id: string
  name: string
  email: string
  phone: string
}

export type UpdateTutorSettingsPayload = {
  name: string
  email: string
  phone: string
  password?: string
}

export type UpdateTutorSettingsResult = ApiResult<{
  tutor: Tutor
  needsEmailConfirmation: boolean
}>

function mapTutor(row: TutorRow): Tutor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
  }
}

function missingClientResult<T>(): ApiResult<T> {
  return {
    data: null,
    error: 'Supabase env не настроены. Кабинет продолжает работать на mock data.',
  }
}

function apiErrorMessage(error: unknown) {
  if (import.meta.env.DEV) {
    console.error('Supabase workspace load error:', error)
  }

  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      status?: unknown
    }

    const parts = [maybeError.message, maybeError.details, maybeError.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)

    if (parts.length > 0) return parts.join(' ')

    const meta = [maybeError.code, maybeError.status].filter(Boolean).join(', ')
    if (meta) return `Ошибка Supabase при загрузке кабинета: ${meta}`
  }

  return 'Не удалось загрузить данные из Supabase.'
}

async function getAuthenticatedTutorRow(): Promise<ApiResult<TutorRow>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const user = sessionData.session?.user
    if (!user) {
      return {
        data: null,
        error: 'Войдите как репетитор, чтобы загрузить данные из Supabase.',
      }
    }

    const { data, error } = await supabase
      .from('tutors')
      .select('id, name, email, phone')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return {
        data: null,
        error: 'Профиль репетитора в таблице tutors не найден.',
      }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

async function attachSignedPhotoUrls(lessons: LessonRow[]) {
  const supabase = getSupabaseClient()
  if (!supabase) return lessons

  const photoRows = lessons.flatMap((lesson) =>
    (lesson.homework_submissions || []).flatMap((submission) => submission.homework_submission_photos || []),
  )

  await Promise.all(
    photoRows.map(async (photo) => {
      const { data, error } = await supabase.storage
        .from('homework-photos')
        .createSignedUrl(photo.storage_path, 60 * 10)

      if (!error && data?.signedUrl) {
        ;(photo as HomeworkPhotoRow).signed_url = data.signedUrl
      }
    }),
  )

  return lessons
}

async function attachSignedLessonFileUrls(lessons: LessonRow[]) {
  const supabase = getSupabaseClient()
  if (!supabase) return lessons

  const materials = lessons.flatMap((lesson) => lesson.lesson_materials || [])

  await Promise.all(
    materials.map(async (material) => {
      const storagePath = getLessonFileStoragePath(material.url)
      if (!storagePath) return

      const { data, error } = await supabase.storage
        .from(LESSON_FILE_BUCKET)
        .createSignedUrl(storagePath, 60 * 10)

      if (!error && data?.signedUrl) {
        ;(material as LessonMaterialRow).signed_url = data.signedUrl
      }
    }),
  )

  return lessons
}

export async function getTutorProfile(): Promise<ApiResult<TutorProfileResult>> {
  const result = await getAuthenticatedTutorRow()
  if (!result.data) return { data: null, error: result.error }

  return {
    data: {
      tutor: mapTutor(result.data),
    },
    error: null,
  }
}

export async function getTutorWorkspace(): Promise<ApiResult<TutorWorkspaceResult>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  const tutorResult = await getAuthenticatedTutorRow()
  if (!tutorResult.data) return { data: null, error: tutorResult.error }

  try {
    const { data: studentsData, error: studentsError } = await supabase
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
      .eq('tutor_id', tutorResult.data.id)
      .order('name', { ascending: true })

    if (studentsError) throw studentsError

    const studentRows = (studentsData || []) as unknown as StudentRow[]
    const studentIds = studentRows.map((student) => student.id)

    let lessonRows: LessonRow[] = []

    if (studentIds.length > 0) {
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
          id,
          student_id,
          created_at,
          lesson_date,
          topic,
          comprehension_rating,
          homework_text,
          homework_deadline,
          homework_status,
          homework_review_comment,
          is_paid,
          deleted_at,
          lesson_materials (
            id,
            title,
            url,
            material_type,
            sort_order
          ),
          homework_submissions!homework_submissions_lesson_id_fkey(
            id,
            comment,
            submitted_at,
            is_revision,
            homework_submission_photos (
              id,
              storage_path,
              original_filename,
              mime_type,
              size_bytes,
              width,
              height,
              sort_order
            )
          )
        `)
        .in('student_id', studentIds)
        .order('lesson_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (lessonsError) throw lessonsError
      lessonRows = (lessonsData || []) as unknown as LessonRow[]
      lessonRows = await attachSignedPhotoUrls(lessonRows)
      lessonRows = await attachSignedLessonFileUrls(lessonRows)
    }

    return {
      data: {
        tutor: mapTutor(tutorResult.data),
        students: studentRows.map((student) => mapStudent(student)),
        lessons: lessonRows.map(mapLesson),
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function updateTutorSettings(payload: UpdateTutorSettingsPayload): Promise<UpdateTutorSettingsResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const user = sessionData.session?.user
    if (!user) {
      return {
        data: null,
        error: 'Войдите как репетитор, чтобы сохранить настройки.',
      }
    }

    const emailChanged = payload.email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()

    const authUpdate: {
      email?: string
      password?: string
      data: {
        name: string
        phone: string
        role: string
      }
    } = {
      data: {
        name: payload.name,
        phone: payload.phone,
        role: 'tutor',
      },
    }

    if (emailChanged) {
      authUpdate.email = payload.email
    }

    if (payload.password) {
      authUpdate.password = payload.password
    }

    const { error: authError } = await supabase.auth.updateUser(authUpdate)
    if (authError) throw authError

    const { data, error } = await supabase
      .from('tutors')
      .update({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      })
      .eq('auth_user_id', user.id)
      .select('id, name, email, phone')
      .single()

    if (error) throw error

    return {
      data: {
        tutor: mapTutor(data),
        needsEmailConfirmation: emailChanged,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}
