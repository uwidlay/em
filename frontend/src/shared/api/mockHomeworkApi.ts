import type { HomeworkSubmission, Lesson, Student } from '../../types/domain'

export type SubmitMockHomeworkResult = {
  lessons: Lesson[]
  students: Student[]
}

export function submitMockHomework(
  lessons: Lesson[],
  students: Student[],
  lessonId: string,
  submission: HomeworkSubmission,
): SubmitMockHomeworkResult {
  let studentId = ''
  const nextLessons = lessons.map((lesson) => {
    if (lesson.id !== lessonId) return lesson
    studentId = lesson.studentId
    return {
      ...lesson,
      homeworkStatus: 'in_review' as const,
      submissions: [...lesson.submissions, submission],
    }
  })

  return {
    lessons: nextLessons,
    students: students.map((student) =>
      student.id === studentId ? { ...student, hasUnreadUpdates: false } : student,
    ),
  }
}
