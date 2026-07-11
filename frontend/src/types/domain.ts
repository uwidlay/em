export type StudentStatus = 'active' | 'archived'

export type HomeworkStatus =
  | 'not_submitted'
  | 'in_review'
  | 'checked'
  | 'needs_correction'

export type MaterialType =
  | 'note'
  | 'video'
  | 'presentation'
  | 'board'
  | 'taskbook'
  | 'other'

export type Tutor = {
  id: string
  name: string
  email: string
  phone: string
}

export type UsefulLink = {
  id: string
  title: string
  url: string
}

export type StudentUpdateEvent = {
  id: string
  message: string
  createdAt: string
  isSeen: boolean
}

export type Student = {
  id: string
  token: string
  name: string
  subject: string
  grade?: string
  studentContact?: string
  parentContact?: string
  lessonPrice?: number
  lessonDurationMinutes?: number
  comment?: string
  status: StudentStatus
  schedule?: string
  goals?: string
  meetingUrl?: string
  usefulLinks: UsefulLink[]
  hasUnreadUpdates: boolean
  lastUpdateMessage?: string
  updateEvents?: StudentUpdateEvent[]
}

export type LessonMaterial = {
  id: string
  title: string
  url: string
  type: MaterialType
  storagePath?: string
  pendingFile?: File
  sizeBytes?: number
}

export type HomeworkPhoto = {
  id: string
  name: string
  sizeMb: number
  previewUrl?: string
}

export type HomeworkSubmission = {
  id: string
  submittedAt: string
  comment?: string
  photos: HomeworkPhoto[]
}

export type Lesson = {
  id: string
  studentId: string
  createdAt?: string
  date: string
  topic: string
  materials: LessonMaterial[]
  understandingRating?: number
  homeworkText: string
  homeworkDeadline?: string
  homeworkStatus: HomeworkStatus
  homeworkReviewComment?: string
  submissions: HomeworkSubmission[]
  isPaid: boolean
  deletedAt?: string
}

export type ScheduleEventType =
  | 'individual'
  | 'group'
  | 'trial'
  | 'transfer'
  | 'cancelled'
  | 'free'

export type ScheduleEvent = {
  id: string
  title: string
  subtitle?: string
  day: number
  startMinutes: number
  endMinutes: number
  type: ScheduleEventType
  date?: string
  isAllDay?: boolean
  recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly'
  guests?: string
  meetingUrl?: string
  location?: string
  description?: string
  calendarName?: string
  studentIds?: string[]
  groupName?: string
}
