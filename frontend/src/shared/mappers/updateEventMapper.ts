import type { StudentUpdateEvent } from '../../types/domain'

export type UpdateEventType =
  | 'lesson_created'
  | 'homework_changed'
  | 'review_comment_added'
  | 'homework_status_changed'
  | 'material_added'

export type UpdateEventRow = {
  id: string
  event_type: UpdateEventType
  created_at: string
  is_seen_by_student: boolean
  lessons?: {
    topic?: string | null
  } | null
}

const updateEventLabel: Record<UpdateEventType, string> = {
  lesson_created: 'Добавлен урок',
  homework_changed: 'Изменено Д/З',
  review_comment_added: 'Оставлен комментарий к Д/З',
  homework_status_changed: 'Изменен статус проверки',
  material_added: 'Добавлена ссылка на материал',
}

export function mapUpdateEvent(row: UpdateEventRow): StudentUpdateEvent {
  const topic = row.lessons?.topic ? `: ${row.lessons.topic}` : ''

  return {
    id: row.id,
    message: `${updateEventLabel[row.event_type]}${topic}.`,
    createdAt: row.created_at,
    isSeen: row.is_seen_by_student,
  }
}
