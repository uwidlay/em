import type { Lesson } from '../types/domain'

function dateValue(value?: string) {
  return value ? new Date(`${value}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
}

function isUnchecked(lesson: Lesson) {
  return lesson.homeworkStatus !== 'checked'
}

export function selectActualHomework(lessons: Lesson[], today = new Date()) {
  const activeLessons = lessons.filter((lesson) => !lesson.deletedAt)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const unchecked = activeLessons.filter(isUnchecked)

  const overdue = unchecked
    .filter((lesson) => lesson.homeworkDeadline && dateValue(lesson.homeworkDeadline) < todayStart)
    .sort((a, b) => dateValue(a.homeworkDeadline) - dateValue(b.homeworkDeadline))

  if (overdue[0]) return overdue[0]

  const upcoming = unchecked
    .filter((lesson) => lesson.homeworkDeadline)
    .sort((a, b) => dateValue(a.homeworkDeadline) - dateValue(b.homeworkDeadline))

  if (upcoming[0]) return upcoming[0]

  const uncheckedWithoutDeadline = unchecked
    .filter((lesson) => !lesson.homeworkDeadline)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (uncheckedWithoutDeadline[0]) return uncheckedWithoutDeadline[0]

  return activeLessons
    .filter((lesson) => lesson.homeworkStatus === 'checked')
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}
