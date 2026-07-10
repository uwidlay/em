import type { HomeworkStatus, MaterialType, StudentStatus } from '../types/domain'

export const homeworkStatusLabel: Record<HomeworkStatus, string> = {
  not_submitted: 'Не сдано',
  in_review: 'На проверке',
  checked: 'Проверено',
  needs_correction: 'Нужно исправить',
}

export const studentStatusLabel: Record<StudentStatus, string> = {
  active: 'Активный',
  archived: 'Архив',
}

export const materialTypeLabel: Record<MaterialType, string> = {
  note: 'Конспект',
  video: 'Видео',
  presentation: 'Презентация',
  board: 'Доска',
  taskbook: 'Задачник',
  other: 'Другое',
}

export function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('ru-RU').format(date)
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getLateDays(deadline?: string, submittedAt?: string) {
  if (!deadline || !submittedAt) return 0
  const deadlineDate = new Date(`${deadline}T23:59:59`)
  const submitDate = new Date(submittedAt)
  const diff = submitDate.getTime() - deadlineDate.getTime()
  return diff > 0 ? Math.ceil(diff / 86_400_000) : 0
}

export function studentUrl(token: string) {
  return `/student/${token}`
}
