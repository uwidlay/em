import type { Student } from '../../types/domain'
import type { CreateStudentPayload, UpdateStudentPayload } from './contracts'

export function createMockStudent(students: Student[], payload: CreateStudentPayload): Student[] {
  const timestamp = Date.now()

  return [
    {
      ...payload,
      id: `student-${timestamp}`,
      token: `student-${timestamp}-token`,
      hasUnreadUpdates: false,
    },
    ...students,
  ]
}

export function updateMockStudent(students: Student[], payload: UpdateStudentPayload): Student[] {
  return students.map((student) =>
    student.id === payload.id
      ? {
          ...student,
          ...payload,
          hasUnreadUpdates: true,
        }
      : student,
  )
}

export function regenerateMockStudentToken(students: Student[], studentId: string): Student[] {
  return students.map((student) =>
    student.id === studentId
      ? { ...student, token: `${student.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}` }
      : student,
  )
}

export function markMockStudentUpdatesSeen(students: Student[], studentId: string): Student[] {
  return students.map((student) =>
    student.id === studentId
      ? {
          ...student,
          hasUnreadUpdates: false,
          lastUpdateMessage: undefined,
          updateEvents: (student.updateEvents || []).map((event) => ({ ...event, isSeen: true })),
        }
      : student,
  )
}
