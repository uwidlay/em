import type {
  HomeworkSubmission,
  HomeworkStatus,
  Lesson,
  LessonMaterial,
  Student,
  StudentUpdateEvent,
  Tutor,
  UsefulLink,
} from '../../types/domain'

export type ApiResult<T> = {
  data: T | null
  error: string | null
}

export type TutorProfileResult = {
  tutor: Tutor
}

export type TutorWorkspaceResult = {
  tutor: Tutor
  students: Student[]
  lessons: Lesson[]
}

export type StudentListFilters = {
  status?: Student['status'] | 'all'
  subject?: string
  grade?: string
  query?: string
}

export type CreateStudentPayload = Omit<Student, 'id' | 'token' | 'hasUnreadUpdates' | 'lastUpdateMessage' | 'updateEvents'>

export type UpdateStudentPayload = CreateStudentPayload & {
  id: string
}

export type CreateStudentResult = {
  student: Student
  studentUrl: string
  plaintextToken: string
}

export type RegenerateStudentTokenResult = {
  studentId: string
  studentUrl: string
  plaintextToken: string
}

export type SaveLessonPayload = Lesson

export type SoftDeleteLessonPayload = {
  lessonId: string
}

export type ToggleLessonPaidPayload = {
  lessonId: string
  isPaid: boolean
}

export type ReviewHomeworkPayload = {
  lessonId: string
  status: Extract<HomeworkStatus, 'checked' | 'needs_correction'>
  comment: string
}

export type SubmitHomeworkPayload = {
  token: string
  lessonId: string
  comment?: string
  photos: PendingHomeworkPhoto[]
}

export type PendingHomeworkPhoto = {
  file: File
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
}

export type PreparedHomeworkUpload = {
  clientPhotoIndex: number
  storagePath: string
  signedUrl: string
  token: string
}

export type PrepareHomeworkUploadsResult = {
  lessonId: string
  uploadTargets: PreparedHomeworkUpload[]
}

export type CompleteHomeworkSubmissionPayload = {
  token: string
  lessonId: string
  comment?: string
  photos: CompletedHomeworkPhoto[]
}

export type CompleteHomeworkSubmissionResult = {
  submissionId: string
  status: 'in_review'
  lateDays: number | null
}

export type CompletedHomeworkPhoto = {
  storagePath: string
  originalFilename?: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
}

export type PublicStudentProfileResult = {
  student: Student
  usefulLinks: UsefulLink[]
  lessons: Lesson[]
  updateEvents: StudentUpdateEvent[]
}

export type MarkUpdatesSeenPayload = {
  token: string
}

export type MarkUpdatesSeenResult = {
  ok: true
}

export type LessonMaterialSyncPayload = {
  lessonId: string
  materials: LessonMaterial[]
}

export type HomeworkReviewResult = {
  lesson: Lesson
}

export type HomeworkSubmissionResult = {
  submission: HomeworkSubmission
  lesson: Lesson
}
