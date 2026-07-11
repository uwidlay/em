import { Paperclip, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { HomeworkStatus, Lesson, LessonMaterial, MaterialType } from '../types/domain'
import { homeworkStatusLabel, materialTypeLabel } from '../utils/format'
import { formatFileSize, isLessonFileMaterial } from '../utils/lessonFiles'
import { validateHomeworkDeadline } from '../utils/validation'
import { Stars } from './Stars'

type Props = {
  lesson?: Lesson
  studentId: string
  onClose: () => void
  onSave: (lesson: Lesson) => void
}

const materialTypes = Object.keys(materialTypeLabel) as MaterialType[]

export function LessonModal({ lesson, studentId, onClose, onSave }: Props) {
  const [form, setForm] = useState<Lesson>(
    lesson || {
      id: `lesson-${Date.now()}`,
      studentId,
      date: new Date().toISOString().slice(0, 10),
      topic: '',
      materials: [],
      understandingRating: undefined,
      homeworkText: '',
      homeworkDeadline: '',
      homeworkStatus: 'not_submitted',
      homeworkReviewComment: '',
      submissions: [],
      isPaid: false,
    },
  )
  const [materialDraft, setMaterialDraft] = useState<LessonMaterial>({
    id: '',
    title: '',
    url: '',
    type: 'note',
  })
  const [error, setError] = useState('')

  function update<K extends keyof Lesson>(key: K, value: Lesson[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addMaterial() {
    if (!materialDraft.title.trim() || !materialDraft.url.trim()) return
    update('materials', [...form.materials, { ...materialDraft, id: `mat-${Date.now()}` }])
    setMaterialDraft({ id: '', title: '', url: '', type: 'note' })
  }

  function addHomeworkFiles(files: FileList | null) {
    if (!files?.length) return
    const nextMaterials = Array.from(files).map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      title: file.name,
      url: '',
      type: 'other' as MaterialType,
      pendingFile: file,
      sizeBytes: file.size,
    }))

    update('materials', [...form.materials, ...nextMaterials])
  }

  function updateMaterial(id: string, field: 'title' | 'url' | 'type', value: string) {
    update(
      'materials',
      form.materials.map((material) =>
        material.id === id ? { ...material, [field]: value } : material,
      ),
    )
  }

  function removeMaterial(id: string) {
    update('materials', form.materials.filter((material) => material.id !== id))
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{lesson ? 'Редактирование' : 'Новое занятие'}</p>
            <h2>{lesson ? 'Изменить занятие' : 'Добавить занятие'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            const deadlineError = validateHomeworkDeadline(form.date, form.homeworkDeadline)
            if (!form.topic.trim()) {
              setError('Укажите тему урока.')
              return
            }
            if (deadlineError) {
              setError(deadlineError)
              return
            }
            setError('')
            onSave(form)
          }}
        >
          <label>
            Дата
            <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
          </label>
          <label>
            Тема урока
            <input value={form.topic} onChange={(event) => update('topic', event.target.value)} />
          </label>
          <label className="wide">
            Д/З
            <textarea value={form.homeworkText} onChange={(event) => update('homeworkText', event.target.value)} />
          </label>
          <label>
            Дедлайн Д/З
            <input
              type="date"
              min={form.date}
              value={form.homeworkDeadline || ''}
              onChange={(event) => update('homeworkDeadline', event.target.value)}
            />
          </label>
          <label>
            Статус Д/З
            <select
              value={form.homeworkStatus}
              onChange={(event) => update('homeworkStatus', event.target.value as HomeworkStatus)}
            >
              {Object.entries(homeworkStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            Комментарий к Д/З
            <textarea
              value={form.homeworkReviewComment || ''}
              onChange={(event) => update('homeworkReviewComment', event.target.value)}
            />
          </label>
          <div className="field-block">
            <span>Усвоение темы</span>
            <Stars value={form.understandingRating} onChange={(value) => update('understandingRating', value)} />
          </div>
          <label className="check-row">
            <input type="checkbox" checked={form.isPaid} onChange={(event) => update('isPaid', event.target.checked)} />
            Урок оплачен
          </label>

          <div className="wide nested-section">
            <h3>Материалы занятия</h3>
            <p className="section-hint">
              Добавьте ссылку или прикрепите файл к уроку/ДЗ. Ученик увидит эти материалы в своей карточке.
            </p>
            <div className="inline-fields">
              <select
                value={materialDraft.type}
                onChange={(event) =>
                  setMaterialDraft((current) => ({ ...current, type: event.target.value as MaterialType }))
                }
              >
                {materialTypes.map((type) => (
                  <option key={type} value={type}>{materialTypeLabel[type]}</option>
                ))}
              </select>
              <input
                placeholder="Название"
                value={materialDraft.title}
                onChange={(event) => setMaterialDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                placeholder="URL"
                value={materialDraft.url}
                onChange={(event) => setMaterialDraft((current) => ({ ...current, url: event.target.value }))}
              />
              <button className="soft-button" type="button" onClick={addMaterial}>
                Добавить
              </button>
            </div>
            <div className="upload-actions material-upload-actions">
              <label className="soft-button file-trigger">
                <Paperclip size={16} />
                Прикрепить файл
                <input
                  className="visually-hidden-file"
                  type="file"
                  multiple
                  onChange={(event) => {
                    addHomeworkFiles(event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              <span>Можно добавить PDF, изображения, документы или презентации.</span>
            </div>
            {form.materials.length > 0 && (
              <div className="editable-list">
                {form.materials.map((material) => (
                  <div className="editable-row material-row" key={material.id}>
                    <select
                      aria-label="Тип материала"
                      value={material.type}
                      onChange={(event) => updateMaterial(material.id, 'type', event.target.value as MaterialType)}
                    >
                      {materialTypes.map((type) => (
                        <option key={type} value={type}>{materialTypeLabel[type]}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Название материала"
                      value={material.title}
                      onChange={(event) => updateMaterial(material.id, 'title', event.target.value)}
                    />
                    {material.pendingFile || isLessonFileMaterial(material.url) ? (
                      <div className="attached-material-note" aria-label="Прикрепленный файл">
                        <Paperclip size={15} />
                        <span>
                          {material.pendingFile ? 'Будет загружен при сохранении' : 'Файл прикреплен'}
                          {material.sizeBytes ? ` · ${formatFileSize(material.sizeBytes)}` : ''}
                        </span>
                      </div>
                    ) : (
                      <input
                        aria-label="URL материала"
                        value={material.url}
                        onChange={(event) => updateMaterial(material.id, 'url', event.target.value)}
                      />
                    )}
                    <button className="icon-button material-remove-button" type="button" onClick={() => removeMaterial(material.id)} aria-label="Удалить материал">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions wide">
            {error && <p className="form-error">{error}</p>}
            <button className="ghost-button" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-button" type="submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
