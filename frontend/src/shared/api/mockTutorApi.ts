import { mockLessons, mockStudents, mockTutor } from '../../mocks/mockData'
import type { TutorProfileResult, TutorWorkspaceResult } from './contracts'

export function getMockTutorProfile(): TutorProfileResult {
  return {
    tutor: mockTutor,
  }
}

export function getMockTutorWorkspace(): TutorWorkspaceResult {
  return {
    tutor: mockTutor,
    students: mockStudents,
    lessons: mockLessons,
  }
}
