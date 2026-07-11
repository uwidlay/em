import type {
  ApiResult,
  LessonMaterialSyncPayload,
  PrepareLessonFileUploadsResult,
  SaveLessonPayload,
  SoftDeleteLessonPayload,
  ToggleLessonPaidPayload,
} from './contracts'
import type { Lesson, LessonMaterial } from '../../types/domain'
import { getSupabaseClient } from './supabaseClient'
import { mapLesson, mapLessonMaterial } from '../mappers/lessonMapper'
import type { LessonMaterialRow, LessonRow } from '../mappers/lessonMapper'
import type { HomeworkPhotoRow } from '../mappers/homeworkMapper'
import {
  getLessonFileStoragePath,
  LESSON_FILE_BUCKET,
  toLessonFileUrl,
} from '../../utils/lessonFiles'

type UpdateEventType =
  | 'lesson_created'
  | 'homework_changed'
  | 'review_comment_added'
  | 'homework_status_changed'
  | 'material_added'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function missingClientResult<T>(): ApiResult<T> {
  return {
    data: null,
    error: 'Supabase env не настроены. Действие выполнено только в mock-режиме.',
  }
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить действие с уроком.'
}

function nullableText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toLessonPayload(lesson: Lesson) {
  return {
    student_id: lesson.studentId,
    lesson_date: lesson.date,
    topic: lesson.topic.trim(),
    comprehension_rating: lesson.understandingRating ?? null,
    homework_text: nullableText(lesson.homeworkText),
    homework_deadline: lesson.homeworkDeadline || null,
    homework_status: lesson.homeworkStatus,
    homework_review_comment: nullableText(lesson.homeworkReviewComment),
    is_paid: lesson.isPaid,
    deleted_at: lesson.deletedAt || null,
  }
}

async function fetchLesson(lessonId: string): Promise<ApiResult<Lesson>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase
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
      .eq('id', lessonId)
      .maybeSingle()

    if (error) throw error
    if (!data) return { data: null, error: 'Урок не найден.' }

    let lessonRows = [data as unknown as LessonRow]
    lessonRows = await attachSignedHomeworkPhotoUrls(lessonRows)
    lessonRows = await attachSignedLessonFileUrls(lessonRows)
    return { data: mapLesson(lessonRows[0]), error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

async function getPreviousLesson(lessonId: string) {
  const result = await fetchLesson(lessonId)
  return result.data || undefined
}

function getUpdateEventType(previousLesson: Lesson | undefined, nextLesson: Lesson): UpdateEventType | null {
  if (!previousLesson) return 'lesson_created'

  if (
    nextLesson.homeworkStatus !== previousLesson.homeworkStatus
  ) {
    return 'homework_status_changed'
  }

  if ((nextLesson.homeworkReviewComment || '') !== (previousLesson.homeworkReviewComment || '')) {
    return 'review_comment_added'
  }

  if (
    nextLesson.homeworkText !== previousLesson.homeworkText ||
    nextLesson.homeworkDeadline !== previousLesson.homeworkDeadline
  ) {
    return 'homework_changed'
  }

  const previousMaterialKeys = new Set(previousLesson.materials.map((material) => `${material.id}:${material.title}:${material.url}:${material.type}`))
  const hasMaterialChange =
    nextLesson.materials.length !== previousLesson.materials.length ||
    nextLesson.materials.some((material) => !previousMaterialKeys.has(`${material.id}:${material.title}:${material.url}:${material.type}`))

  return hasMaterialChange ? 'material_added' : null
}

async function createUpdateEvent(studentId: string, lessonId: string, eventType: UpdateEventType) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { error } = await supabase.from('update_events').insert({
    student_id: studentId,
    lesson_id: lessonId,
    event_type: eventType,
    is_seen_by_student: false,
  })

  if (error) throw error

  const { error: studentError } = await supabase
    .from('students')
    .update({ has_unread_updates_for_student: true })
    .eq('id', studentId)

  if (studentError) throw studentError
}

async function prepareLessonFileUploads(lessonId: string, files: File[]) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env не настроены.')

  const { data, error } = await supabase.functions.invoke<PrepareLessonFileUploadsResult & { error?: string }>(
    'student-token-flow',
    {
      body: {
        action: 'prepareLessonFileUploads',
        lessonId,
        files: files.map((file) => ({
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        })),
      },
    },
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (!data) throw new Error('Пустой ответ при подготовке загрузки файла.')

  return data.uploadTargets
}

async function uploadPendingLessonFiles(lessonId: string, materials: LessonMaterial[]) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env не настроены.')

  const pendingMaterials = materials.filter((material) => material.pendingFile)
  if (pendingMaterials.length === 0) return materials

  const files = pendingMaterials.map((material) => material.pendingFile as File)
  const uploadTargets = await prepareLessonFileUploads(lessonId, files)

  await Promise.all(
    uploadTargets.map(async (target) => {
      const file = files[target.clientFileIndex]
      if (!file) throw new Error('Не найден файл для загрузки.')

      const { error } = await supabase.storage
        .from(LESSON_FILE_BUCKET)
        .uploadToSignedUrl(target.storagePath, target.token, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (error) throw error
    }),
  )

  const pathByMaterialId = new Map(
    uploadTargets.map((target) => [pendingMaterials[target.clientFileIndex]?.id, target.storagePath]),
  )

  return materials.map((material) => {
    if (!material.pendingFile) return material
    const storagePath = pathByMaterialId.get(material.id)
    if (!storagePath) throw new Error('Не удалось сохранить путь файла урока.')

    return {
      ...material,
      url: toLessonFileUrl(storagePath),
      storagePath,
      pendingFile: undefined,
      sizeBytes: material.pendingFile.size,
    }
  })
}

async function prepareMaterialsForSave(lessonId: string, materials: LessonMaterial[]) {
  const uploadedMaterials = await uploadPendingLessonFiles(lessonId, materials)

  return uploadedMaterials.map((material) => {
      if (material.storagePath) {
        return {
          ...material,
          url: toLessonFileUrl(material.storagePath),
        }
      }

      return material
  })
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

async function attachSignedHomeworkPhotoUrls(lessons: LessonRow[]) {
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

async function syncMaterials(lessonId: string, materials: LessonMaterial[]) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { data: existingRows, error: listError } = await supabase
    .from('lesson_materials')
    .select('id, url')
    .eq('lesson_id', lessonId)

  if (listError) throw listError

  const preparedMaterials = await prepareMaterialsForSave(lessonId, materials)
  const nextPersistedIds = new Set(materials.filter((material) => uuidPattern.test(material.id)).map((material) => material.id))
  const idsToDelete = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => !nextPersistedIds.has(id))

  if (idsToDelete.length > 0) {
    const filePathsToDelete = (existingRows || [])
      .filter((row) => idsToDelete.includes(row.id))
      .map((row) => getLessonFileStoragePath(row.url))
      .filter((path): path is string => Boolean(path))

    if (filePathsToDelete.length > 0) {
      await supabase.storage.from(LESSON_FILE_BUCKET).remove(filePathsToDelete)
    }

    const { error } = await supabase.from('lesson_materials').delete().in('id', idsToDelete)
    if (error) throw error
  }

  await Promise.all(
    preparedMaterials.map(async (material, index) => {
      const payload = {
        title: material.title.trim(),
        url: material.storagePath ? toLessonFileUrl(material.storagePath) : material.url.trim(),
        material_type: material.type,
        sort_order: index,
      }

      if (uuidPattern.test(material.id)) {
        const { error } = await supabase
          .from('lesson_materials')
          .update(payload)
          .eq('id', material.id)
          .eq('lesson_id', lessonId)

        if (error) throw error
        return
      }

      const { error } = await supabase.from('lesson_materials').insert({
        ...payload,
        lesson_id: lessonId,
      })

      if (error) throw error
    }),
  )
}

export async function listLessonsByStudent(studentId: string): Promise<ApiResult<Lesson[]>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { data, error } = await supabase
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
      .eq('student_id', studentId)
      .order('lesson_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    let lessonRows = (data || []) as unknown as LessonRow[]
    lessonRows = await attachSignedHomeworkPhotoUrls(lessonRows)
    lessonRows = await attachSignedLessonFileUrls(lessonRows)
    return { data: lessonRows.map(mapLesson), error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function saveLesson(payload: SaveLessonPayload): Promise<ApiResult<Lesson>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const previousLesson = uuidPattern.test(payload.id) ? await getPreviousLesson(payload.id) : undefined
    const lessonPayload = toLessonPayload(payload)
    let lessonId = payload.id

    if (previousLesson) {
      const { error } = await supabase
        .from('lessons')
        .update(lessonPayload)
        .eq('id', payload.id)

      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('lessons')
        .insert(lessonPayload)
        .select('id')
        .single()

      if (error) throw error
      lessonId = data.id
    }

    await syncMaterials(lessonId, payload.materials)

    const updateEventType = getUpdateEventType(previousLesson, payload)
    if (updateEventType) {
      await createUpdateEvent(payload.studentId, lessonId, updateEventType)
    }

    return fetchLesson(lessonId)
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function softDeleteLesson(payload: SoftDeleteLessonPayload): Promise<ApiResult<{ lessonId: string }>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase
      .from('lessons')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', payload.lessonId)

    if (error) throw error
    return { data: { lessonId: payload.lessonId }, error: null }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function toggleLessonPaid(payload: ToggleLessonPaidPayload): Promise<ApiResult<Lesson>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const { error } = await supabase
      .from('lessons')
      .update({ is_paid: payload.isPaid })
      .eq('id', payload.lessonId)

    if (error) throw error
    return fetchLesson(payload.lessonId)
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}

export async function syncLessonMaterials(payload: LessonMaterialSyncPayload): Promise<ApiResult<LessonMaterial[]>> {
  const supabase = getSupabaseClient()
  if (!supabase) return missingClientResult()

  try {
    const lesson = await fetchLesson(payload.lessonId)
    if (!lesson.data) throw new Error(lesson.error || 'Урок не найден.')

    await syncMaterials(payload.lessonId, payload.materials)

    const { data, error } = await supabase
      .from('lesson_materials')
      .select('id, title, url, material_type, sort_order')
      .eq('lesson_id', payload.lessonId)
      .order('sort_order', { ascending: true })

    if (error) throw error

    return {
      data: ((data || []) as unknown as LessonMaterialRow[]).map(mapLessonMaterial),
      error: null,
    }
  } catch (error) {
    return { data: null, error: apiErrorMessage(error) }
  }
}
