import type { Student, StudentStatus, UsefulLink } from '../../types/domain'
import { mapUpdateEvent } from './updateEventMapper'
import type { UpdateEventRow } from './updateEventMapper'

export type UsefulLinkRow = {
  id: string
  title: string
  url: string
  sort_order: number
}

export type StudentRow = {
  id: string
  name: string
  subject: string
  grade: string | null
  student_contact: string | null
  parent_contact: string | null
  lesson_price: number | string | null
  lesson_duration_minutes: number | null
  comment: string | null
  status: StudentStatus
  schedule_text: string | null
  goals_text: string | null
  meeting_url: string | null
  has_unread_updates_for_student: boolean
  useful_links?: UsefulLinkRow[] | null
  update_events?: UpdateEventRow[] | null
}

export function mapUsefulLink(row: UsefulLinkRow): UsefulLink {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
  }
}

export function mapStudent(row: StudentRow, plaintextToken = ''): Student {
  const usefulLinks = [...(row.useful_links || [])].sort((a, b) => a.sort_order - b.sort_order)
  const updateEvents = [...(row.update_events || [])].map(mapUpdateEvent)

  return {
    id: row.id,
    token: plaintextToken,
    name: row.name,
    subject: row.subject,
    grade: row.grade || undefined,
    studentContact: row.student_contact || undefined,
    parentContact: row.parent_contact || undefined,
    lessonPrice: row.lesson_price === null ? undefined : Number(row.lesson_price),
    lessonDurationMinutes: row.lesson_duration_minutes ?? undefined,
    comment: row.comment || undefined,
    status: row.status,
    schedule: row.schedule_text || undefined,
    goals: row.goals_text || undefined,
    meetingUrl: row.meeting_url || undefined,
    usefulLinks: usefulLinks.map(mapUsefulLink),
    hasUnreadUpdates: row.has_unread_updates_for_student,
    lastUpdateMessage: updateEvents[0]?.message,
    updateEvents,
  }
}
