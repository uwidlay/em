import type { Lesson, LessonMaterial, MaterialType } from '../../types/domain'
import { mapHomeworkSubmission } from './homeworkMapper'
import type { HomeworkSubmissionRow } from './homeworkMapper'

export type LessonMaterialRow = {
  id: string
  title: string
  url: string
  material_type: MaterialType
  sort_order: number
}

export type LessonRow = {
  id: string
  student_id: string
  lesson_date: string
  topic: string
  comprehension_rating: number | null
  homework_text: string | null
  homework_deadline: string | null
  homework_status: Lesson['homeworkStatus']
  homework_review_comment: string | null
  is_paid: boolean
  deleted_at: string | null
  lesson_materials?: LessonMaterialRow[] | null
  homework_submissions?: HomeworkSubmissionRow[] | null
}

export function mapLessonMaterial(row: LessonMaterialRow): LessonMaterial {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    type: row.material_type,
  }
}

export function mapLesson(row: LessonRow): Lesson {
  const materials = [...(row.lesson_materials || [])].sort((a, b) => a.sort_order - b.sort_order)
  const submissions = [...(row.homework_submissions || [])].sort((a, b) =>
    a.submitted_at.localeCompare(b.submitted_at),
  )

  return {
    id: row.id,
    studentId: row.student_id,
    date: row.lesson_date,
    topic: row.topic,
    materials: materials.map(mapLessonMaterial),
    understandingRating: row.comprehension_rating ?? undefined,
    homeworkText: row.homework_text || '',
    homeworkDeadline: row.homework_deadline || undefined,
    homeworkStatus: row.homework_status,
    homeworkReviewComment: row.homework_review_comment || undefined,
    submissions: submissions.map(mapHomeworkSubmission),
    isPaid: row.is_paid,
    deletedAt: row.deleted_at || undefined,
  }
}
