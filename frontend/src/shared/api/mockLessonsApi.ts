import type { Lesson, Student, StudentUpdateEvent } from '../../types/domain'

export type SaveMockLessonResult = {
  lessons: Lesson[]
  students: Student[]
}

export type ToggleMockLessonPaidResult = {
  lessons: Lesson[]
  isPaid: boolean
}

function createMockUpdateEvent(message: string): StudentUpdateEvent {
  return {
    id: `update-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    createdAt: new Date().toISOString(),
    isSeen: false,
  }
}

function lessonUpdateMessage(previousLesson: Lesson | undefined, nextLesson: Lesson) {
  if (!previousLesson) return `Добавлен урок: ${nextLesson.topic}.`
  if (nextLesson.materials.length > previousLesson.materials.length) return `Добавлена ссылка на материал: ${nextLesson.topic}.`
  if (
    nextLesson.homeworkText !== previousLesson.homeworkText ||
    nextLesson.homeworkDeadline !== previousLesson.homeworkDeadline
  ) {
    return `Изменено Д/З: ${nextLesson.topic}.`
  }
  if ((nextLesson.homeworkReviewComment || '') !== (previousLesson.homeworkReviewComment || '')) {
    return `Оставлен комментарий к Д/З: ${nextLesson.topic}.`
  }
  if (nextLesson.homeworkStatus !== previousLesson.homeworkStatus) {
    return `Изменен статус проверки: ${nextLesson.topic}.`
  }
  return `Обновлен урок: ${nextLesson.topic}.`
}

function addMockStudentUpdate(student: Student, message: string): Student {
  const events = [createMockUpdateEvent(message), ...(student.updateEvents || [])].slice(0, 5)
  return {
    ...student,
    hasUnreadUpdates: true,
    lastUpdateMessage: message,
    updateEvents: events,
  }
}

export function saveMockLesson(lessons: Lesson[], students: Student[], nextLesson: Lesson): SaveMockLessonResult {
  const previousLesson = lessons.find((lesson) => lesson.id === nextLesson.id)
  const updateMessage = lessonUpdateMessage(previousLesson, nextLesson)
  const exists = lessons.some((lesson) => lesson.id === nextLesson.id)

  return {
    lessons: exists
      ? lessons.map((lesson) => (lesson.id === nextLesson.id ? nextLesson : lesson))
      : [nextLesson, ...lessons],
    students: students.map((student) =>
      student.id === nextLesson.studentId
        ? addMockStudentUpdate(student, updateMessage)
        : student,
    ),
  }
}

export function softDeleteMockLesson(lessons: Lesson[], lessonId: string): Lesson[] {
  return lessons.map((lesson) =>
    lesson.id === lessonId ? { ...lesson, deletedAt: new Date().toISOString() } : lesson,
  )
}

export function toggleMockLessonPaid(lessons: Lesson[], lessonId: string): ToggleMockLessonPaidResult {
  let isPaid = false
  const nextLessons = lessons.map((lesson) => {
    if (lesson.id !== lessonId) return lesson
    isPaid = !lesson.isPaid
    return { ...lesson, isPaid }
  })

  return {
    lessons: nextLessons,
    isPaid,
  }
}
