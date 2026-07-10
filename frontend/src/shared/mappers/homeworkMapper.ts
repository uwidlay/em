import type { HomeworkPhoto, HomeworkSubmission } from '../../types/domain'

export type HomeworkPhotoRow = {
  id: string
  storage_path: string
  original_filename: string | null
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  sort_order: number
  signed_url?: string | null
}

export type HomeworkSubmissionRow = {
  id: string
  comment: string | null
  submitted_at: string
  is_revision: boolean
  homework_submission_photos?: HomeworkPhotoRow[] | null
}

export function mapHomeworkPhoto(row: HomeworkPhotoRow): HomeworkPhoto {
  return {
    id: row.id,
    name: row.original_filename || row.storage_path.split('/').at(-1) || 'Фото Д/З',
    sizeMb: Math.round((row.size_bytes / 1024 / 1024) * 10) / 10,
    previewUrl: row.signed_url || undefined,
  }
}

export function mapHomeworkSubmission(row: HomeworkSubmissionRow): HomeworkSubmission {
  const photos = [...(row.homework_submission_photos || [])].sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: row.id,
    submittedAt: row.submitted_at,
    comment: row.comment || undefined,
    photos: photos.map(mapHomeworkPhoto),
  }
}
