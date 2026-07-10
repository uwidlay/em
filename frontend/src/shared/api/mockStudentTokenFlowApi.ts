import type { Lesson, Student } from '../../types/domain'
import type { PublicStudentProfileResult } from './contracts'
import { markMockStudentUpdatesSeen } from './mockStudentsApi'

export function getMockPublicStudentProfile(
  students: Student[],
  lessons: Lesson[],
  token: string | undefined,
): PublicStudentProfileResult | null {
  const student = students.find((item) => item.token === token)
  if (!student) return null

  return {
    student,
    usefulLinks: student.usefulLinks,
    lessons: lessons
      .filter((lesson) => lesson.studentId === student.id && !lesson.deletedAt)
      .sort((a, b) => b.date.localeCompare(a.date)),
    updateEvents: student.updateEvents || [],
  }
}

export function markMockUpdatesSeenByToken(students: Student[], token: string | undefined): Student[] {
  const student = students.find((item) => item.token === token)
  if (!student) return students

  return markMockStudentUpdatesSeen(students, student.id)
}
