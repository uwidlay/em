export const LESSON_FILE_BUCKET = 'lesson-files'
export const LESSON_FILE_URL_PREFIX = 'lesson-file://'

export function toLessonFileUrl(storagePath: string) {
  return `${LESSON_FILE_URL_PREFIX}${storagePath}`
}

export function getLessonFileStoragePath(url: string | undefined | null) {
  if (!url?.startsWith(LESSON_FILE_URL_PREFIX)) return null
  return url.slice(LESSON_FILE_URL_PREFIX.length)
}

export function isLessonFileMaterial(url: string | undefined | null) {
  return Boolean(getLessonFileStoragePath(url))
}

export function formatFileSize(sizeBytes: number | undefined) {
  if (!sizeBytes || !Number.isFinite(sizeBytes)) return ''
  const sizeMb = sizeBytes / (1024 * 1024)
  if (sizeMb >= 1) return `${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} МБ`
  return `${Math.max(1, Math.round(sizeBytes / 1024))} КБ`
}

export function safeLessonFileName(fileName: string) {
  const safe = fileName
    .trim()
    .replace(/[^\wа-яА-ЯёЁ.\- ]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)

  return safe || 'file'
}
