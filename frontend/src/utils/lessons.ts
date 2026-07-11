import type { Lesson } from '../types/domain'

export function compareLessonsNewestFirst(a: Lesson, b: Lesson) {
  const dateCompare = b.date.localeCompare(a.date)
  if (dateCompare !== 0) return dateCompare

  const aCreatedAt = a.createdAt || ''
  const bCreatedAt = b.createdAt || ''
  if (aCreatedAt || bCreatedAt) return bCreatedAt.localeCompare(aCreatedAt)

  return b.id.localeCompare(a.id)
}
