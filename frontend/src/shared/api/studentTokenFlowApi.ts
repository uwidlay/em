import type {
  ApiResult,
  CompleteHomeworkSubmissionResult,
  CompleteHomeworkSubmissionPayload,
  MarkUpdatesSeenPayload,
  MarkUpdatesSeenResult,
  PrepareHomeworkUploadsResult,
  PublicStudentProfileResult,
  SubmitHomeworkPayload,
} from './contracts'
import { getSupabaseClient } from './supabaseClient'
import { mapLesson } from '../mappers/lessonMapper'
import type { LessonRow } from '../mappers/lessonMapper'
import { mapUsefulLink } from '../mappers/studentMapper'
import type { UsefulLinkRow } from '../mappers/studentMapper'
import { mapUpdateEvent } from '../mappers/updateEventMapper'
import type { UpdateEventRow } from '../mappers/updateEventMapper'
import type { Lesson, Student, StudentUpdateEvent } from '../../types/domain'
import { compareLessonsNewestFirst } from '../../utils/lessons'

type StudentTokenAction =
  | 'getProfile'
  | 'prepareHomeworkPhotoUploads'
  | 'completeHomeworkSubmission'
  | 'markUpdatesSeen'

type StudentTokenPayload = {
  action: StudentTokenAction
  token: string
  lessonId?: string
  comment?: string
  photos?: unknown[]
}

type StudentTokenResponse<T> = T & {
  error?: string
}

type PublicStudentRecord = {
  id: string
  name: string
  subject: string
  grade: string | null
  schedule_text: string | null
  goals_text: string | null
  meeting_url: string | null
  has_unread_updates_for_student: boolean
}

type PublicLessonRow = Omit<LessonRow, 'student_id' | 'deleted_at'> & {
  student_id?: string
  deleted_at?: string | null
}

type PublicProfileResponse = {
  student: PublicStudentRecord
  usefulLinks: UsefulLinkRow[]
  lessons: PublicLessonRow[]
  updateEvents?: UpdateEventRow[]
}

function missingClientResult<T>(): ApiResult<T> {
  return {
    data: null,
    error: 'Supabase env не настроены. Публичный профиль по ссылке пока недоступен.',
  }
}

async function apiErrorMessage(error: unknown) {
  if (import.meta.env.DEV) {
    console.error('student-token-flow error:', error)
  }

  if (error instanceof Error) return error.message

  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown
      context?: unknown
    }

    const context = maybeError.context
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown; message?: unknown }
        const message = payload.error || payload.message
        if (typeof message === 'string' && message.trim()) return message
      } catch {
        // Keep the generic error below if the response body is not JSON.
      }
    }

    if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message
  }

  return 'Не удалось выполнить student-token-flow.'
}

async function invokeStudentTokenFlow<T>(payload: StudentTokenPayload): Promise<ApiResult<T>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase.functions.invoke<StudentTokenResponse<T>>('student-token-flow', {
      body: payload,
    })

    if (error) throw error
    if (data?.error) return { data: null, error: data.error }
    if (!data) return { data: null, error: 'Пустой ответ student-token-flow.' }

    return { data, error: null }
  } catch (error) {
    return { data: null, error: await apiErrorMessage(error) }
  }
}

function mapPublicStudent(
  record: PublicStudentRecord,
  token: string,
  usefulLinks: UsefulLinkRow[],
  updateEvents: StudentUpdateEvent[],
): Student {
  return {
    id: record.id,
    token,
    name: record.name,
    subject: record.subject,
    grade: record.grade || undefined,
    status: 'active',
    schedule: record.schedule_text || undefined,
    goals: record.goals_text || undefined,
    meetingUrl: record.meeting_url || undefined,
    usefulLinks: usefulLinks.map(mapUsefulLink),
    hasUnreadUpdates: record.has_unread_updates_for_student,
    lastUpdateMessage: updateEvents[0]?.message,
    updateEvents,
  }
}

function mapPublicLesson(row: PublicLessonRow, studentId: string): Lesson {
  return mapLesson({
    ...row,
    student_id: studentId,
    deleted_at: row.deleted_at || null,
  })
}

export async function getPublicStudentProfile(token: string): Promise<ApiResult<PublicStudentProfileResult>> {
  const result = await invokeStudentTokenFlow<PublicProfileResponse>({
    action: 'getProfile',
    token,
  })

  if (!result.data) return { data: null, error: result.error }

  const profile = result.data
  const usefulLinks = [...(profile.usefulLinks || [])].sort((a, b) => a.sort_order - b.sort_order)
  const updateEvents = [...(profile.updateEvents || [])].map(mapUpdateEvent)
  const student = mapPublicStudent(profile.student, token, usefulLinks, updateEvents)
  const lessons = (profile.lessons || [])
    .map((lesson) => mapPublicLesson(lesson, profile.student.id))
    .sort(compareLessonsNewestFirst)

  return {
    data: {
      student,
      usefulLinks: usefulLinks.map(mapUsefulLink),
      lessons,
      updateEvents,
    },
    error: null,
  }
}

export async function prepareHomeworkPhotoUploads(
  payload: SubmitHomeworkPayload,
): Promise<ApiResult<PrepareHomeworkUploadsResult>> {
  return invokeStudentTokenFlow<PrepareHomeworkUploadsResult>({
    action: 'prepareHomeworkPhotoUploads',
    token: payload.token,
    lessonId: payload.lessonId,
    comment: payload.comment,
    photos: payload.photos.map((photo) => ({
      originalFilename: photo.file.name,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      width: photo.width,
      height: photo.height,
    })),
  })
}

export async function completeHomeworkSubmission(
  payload: CompleteHomeworkSubmissionPayload,
): Promise<ApiResult<CompleteHomeworkSubmissionResult>> {
  return invokeStudentTokenFlow<CompleteHomeworkSubmissionResult>({
    action: 'completeHomeworkSubmission',
    token: payload.token,
    lessonId: payload.lessonId,
    comment: payload.comment,
    photos: payload.photos,
  })
}

export async function submitHomeworkWithPhotos(
  payload: SubmitHomeworkPayload,
): Promise<ApiResult<CompleteHomeworkSubmissionResult>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  const prepared = await prepareHomeworkPhotoUploads(payload)
  if (!prepared.data) return { data: null, error: prepared.error }

  try {
    const uploadTargets = prepared.data.uploadTargets

    await Promise.all(
      uploadTargets.map(async (target) => {
        const pendingPhoto = payload.photos[target.clientPhotoIndex]
        if (!pendingPhoto) throw new Error('Не найден файл для загрузки.')

        const { error } = await supabase.storage
          .from('homework-photos')
          .uploadToSignedUrl(target.storagePath, target.token, pendingPhoto.file, {
            contentType: pendingPhoto.mimeType,
            upsert: false,
          })

        if (error) throw error
      }),
    )

    return completeHomeworkSubmission({
      token: payload.token,
      lessonId: payload.lessonId,
      comment: payload.comment,
      photos: uploadTargets.map((target) => {
        const pendingPhoto = payload.photos[target.clientPhotoIndex]
        return {
          storagePath: target.storagePath,
          originalFilename: pendingPhoto.file.name,
          mimeType: pendingPhoto.mimeType,
          sizeBytes: pendingPhoto.sizeBytes,
          width: pendingPhoto.width,
          height: pendingPhoto.height,
        }
      }),
    })
  } catch (error) {
    return { data: null, error: await apiErrorMessage(error) }
  }
}

export async function markStudentUpdatesSeen(
  payload: MarkUpdatesSeenPayload,
): Promise<ApiResult<MarkUpdatesSeenResult>> {
  return invokeStudentTokenFlow<MarkUpdatesSeenResult>({
    action: 'markUpdatesSeen',
    token: payload.token,
  })
}
