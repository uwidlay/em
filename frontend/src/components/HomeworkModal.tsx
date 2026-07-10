import { Camera, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'

export type HomeworkPhotoDraft = {
  file: File
  mimeType: string
  sizeBytes: number
}

type Props = {
  onClose: () => void
  onSubmit: (payload: { comment?: string; photos: HomeworkPhotoDraft[] }) => void | Promise<void>
  isSubmitting?: boolean
  submitError?: string
}

const maxPhotos = 10
const maxPhotoBytes = 10 * 1024 * 1024
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
const extensionMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
}

function mimeTypeForFile(file: File) {
  if (allowedMimeTypes.includes(file.type)) return file.type
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  return extension ? extensionMimeTypes[extension] || file.type : file.type
}

function validateFiles(files: File[]) {
  if (files.length === 0) return 'Выберите хотя бы одно фото.'
  if (files.length > maxPhotos) return `Можно прикрепить не больше ${maxPhotos} фото.`

  const unsupported = files.find((file) => !allowedMimeTypes.includes(mimeTypeForFile(file)))
  if (unsupported) return `Формат файла "${unsupported.name}" не поддерживается. Можно JPG, PNG, HEIC/HEIF или WebP.`

  const oversized = files.find((file) => file.size > maxPhotoBytes)
  if (oversized) return `Файл "${oversized.name}" больше 10 МБ.`

  return ''
}

function photoKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export function HomeworkModal({ onClose, onSubmit, isSubmitting = false, submitError }: Props) {
  const extraFileInputRef = useRef<HTMLInputElement | null>(null)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<HomeworkPhotoDraft[]>([])
  const [validationError, setValidationError] = useState('')

  function addFiles(files: File[]) {
    if (files.length === 0) return

    const existingKeys = new Set(photos.map((photo) => photoKey(photo.file)))
    const nextFiles = [
      ...photos.map((photo) => photo.file),
      ...files.filter((file) => !existingKeys.has(photoKey(file))),
    ]

    const error = validateFiles(nextFiles)
    setValidationError(error)

    if (error) {
      return
    }

    setPhotos(
      nextFiles.map((file) => ({
        file,
        mimeType: mimeTypeForFile(file),
        sizeBytes: file.size,
      })),
    )
  }

  function removePhoto(fileKey: string) {
    const nextPhotos = photos.filter((photo) => photoKey(photo.file) !== fileKey)
    setPhotos(nextPhotos)
    setValidationError('')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-narrow">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Сдача Д/З</p>
            <h2>Прикрепить фото решения</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть" disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        <form
          className="form-grid one-column"
          onSubmit={async (event) => {
            event.preventDefault()
            const error = validateFiles(photos.map((photo) => photo.file))
            setValidationError(error)
            if (error) return
            await onSubmit({
              comment: comment.trim() || undefined,
              photos,
            })
          }}
        >
          <label className="upload-box">
            <Camera size={24} />
            <strong>{photos.length > 0 ? 'Добавить фото' : 'Выбрать фото'}</strong>
            <span>До 10 фото: JPG, PNG, HEIC/HEIF или WebP. Максимум 10 МБ на фото.</span>
            <small>Старая сдача не редактируется: новые фото сохраняются отдельной отправкой.</small>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
              multiple
              disabled={isSubmitting}
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
          </label>

          {photos.length > 0 && (
            <>
              <div className="photo-list" aria-label="Выбранные фото">
                {photos.map((photo, index) => {
                  const key = photoKey(photo.file)
                  return (
                    <span className="chip photo-chip" key={key}>
                      <span>
                        Фото {index + 1}: {photo.file.name} · {(photo.sizeBytes / 1024 / 1024).toFixed(1)} МБ
                      </span>
                      <button
                        aria-label={`Убрать фото ${photo.file.name}`}
                        className="chip-remove"
                        disabled={isSubmitting}
                        type="button"
                        onClick={() => removePhoto(key)}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )
                })}
              </div>
              <div className="upload-actions">
                <button
                  className="soft-button"
                  disabled={isSubmitting || photos.length >= maxPhotos}
                  type="button"
                  onClick={() => extraFileInputRef.current?.click()}
                >
                  <Plus size={16} />
                  Добавить еще фото
                </button>
                <span>{photos.length} из {maxPhotos} фото</span>
                <input
                  ref={extraFileInputRef}
                  className="visually-hidden-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
                  multiple
                  disabled={isSubmitting}
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
              </div>
            </>
          )}

          <label>
            Комментарий к сдаче
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSubmitting} />
          </label>

          {(validationError || submitError) && <p className="form-error">{validationError || submitError}</p>}

          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </button>
            <button className="primary-button" type="submit" disabled={photos.length === 0 || isSubmitting}>
              {isSubmitting ? 'Отправляем...' : 'Отправить Д/З'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
