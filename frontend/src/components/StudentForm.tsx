import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Student } from '../types/domain'

type Props = {
  initial?: Student
  onSubmit: (student: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>) => void | Promise<void>
  onCancel: () => void
  isSaving?: boolean
  submitError?: string
}

const blankStudent: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'> = {
  name: '',
  subject: '',
  grade: '',
  studentContact: '',
  parentContact: '',
  lessonPrice: undefined,
  lessonDurationMinutes: 60,
  comment: '',
  status: 'active',
  schedule: '',
  goals: '',
  meetingUrl: '',
  usefulLinks: [],
}

export function StudentForm({ initial, onSubmit, onCancel, isSaving = false, submitError }: Props) {
  const [form, setForm] = useState<Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>>(
    initial
      ? {
          name: initial.name,
          subject: initial.subject,
          grade: initial.grade || '',
          studentContact: initial.studentContact || '',
          parentContact: initial.parentContact || '',
          lessonPrice: initial.lessonPrice,
          lessonDurationMinutes: initial.lessonDurationMinutes,
          comment: initial.comment || '',
          status: initial.status,
          schedule: initial.schedule || '',
          goals: initial.goals || '',
          meetingUrl: initial.meetingUrl || '',
          usefulLinks: initial.usefulLinks,
        }
      : blankStudent,
  )
  const [linkDraft, setLinkDraft] = useState({ title: '', url: '' })
  const [errors, setErrors] = useState<{ name?: string; subject?: string; form?: string }>({})

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'name' || key === 'subject') {
      setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
    }
  }

  function addLink() {
    if (!linkDraft.title.trim() || !linkDraft.url.trim()) return
    update('usefulLinks', [
      ...form.usefulLinks,
      { id: `link-${Date.now()}`, title: linkDraft.title, url: linkDraft.url },
    ])
    setLinkDraft({ title: '', url: '' })
  }

  function updateLink(id: string, field: 'title' | 'url', value: string) {
    update(
      'usefulLinks',
      form.usefulLinks.map((link) => (link.id === id ? { ...link, [field]: value } : link)),
    )
  }

  function removeLink(id: string) {
    update('usefulLinks', form.usefulLinks.filter((link) => link.id !== id))
  }

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault()
        const nextErrors = {
          name: form.name.trim() ? undefined : 'Введите имя ученика.',
          subject: form.subject.trim() ? undefined : 'Введите предмет.',
        }
        if (nextErrors.name || nextErrors.subject) {
          setErrors({
            ...nextErrors,
            form: 'Заполните обязательные поля: имя ученика и предмет.',
          })
          return
        }
        setErrors({})
        onSubmit(form)
      }}
    >
      <label>
        Имя ученика *
        <input
          aria-invalid={Boolean(errors.name)}
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>
      <label>
        Предмет *
        <input
          aria-invalid={Boolean(errors.subject)}
          value={form.subject}
          onChange={(event) => update('subject', event.target.value)}
        />
        {errors.subject && <span className="field-error">{errors.subject}</span>}
      </label>
      <label>
        Класс
        <input value={form.grade} onChange={(event) => update('grade', event.target.value)} />
      </label>
      <label>
        Статус
        <select value={form.status} onChange={(event) => update('status', event.target.value as Student['status'])}>
          <option value="active">Активный</option>
          <option value="archived">Архив</option>
        </select>
      </label>
      <label>
        Контакт ученика
        <input value={form.studentContact} onChange={(event) => update('studentContact', event.target.value)} />
      </label>
      <label>
        Контакт родителя
        <input value={form.parentContact} onChange={(event) => update('parentContact', event.target.value)} />
      </label>
      <label>
        Стоимость занятия
        <input
          min="0"
          type="number"
          value={form.lessonPrice || ''}
          onChange={(event) => update('lessonPrice', Number(event.target.value) || undefined)}
        />
      </label>
      <label>
        Длительность, минут
        <input
          min="0"
          type="number"
          value={form.lessonDurationMinutes || ''}
          onChange={(event) => update('lessonDurationMinutes', Number(event.target.value) || undefined)}
        />
      </label>
      <label className="wide">
        Расписание
        <input value={form.schedule} onChange={(event) => update('schedule', event.target.value)} />
      </label>
      <label className="wide">
        Цели занятий
        <textarea value={form.goals} onChange={(event) => update('goals', event.target.value)} />
      </label>
      <label className="wide">
        Ссылка подключения к занятию
        <input value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} />
      </label>
      <label className="wide">
        Комментарий
        <textarea value={form.comment} onChange={(event) => update('comment', event.target.value)} />
      </label>

      <div className="wide nested-section">
        <h3>Полезные ссылки</h3>
        <div className="inline-fields">
          <input
            placeholder="Название"
            value={linkDraft.title}
            onChange={(event) => setLinkDraft((current) => ({ ...current, title: event.target.value }))}
          />
          <input
            placeholder="URL"
            value={linkDraft.url}
            onChange={(event) => setLinkDraft((current) => ({ ...current, url: event.target.value }))}
          />
          <button className="soft-button" type="button" onClick={addLink}>
            Добавить
          </button>
        </div>
        {form.usefulLinks.length > 0 && (
          <div className="editable-list">
            {form.usefulLinks.map((link) => (
              <div className="editable-row" key={link.id}>
                <input
                  aria-label="Название полезной ссылки"
                  value={link.title}
                  onChange={(event) => updateLink(link.id, 'title', event.target.value)}
                />
                <input
                  aria-label="URL полезной ссылки"
                  value={link.url}
                  onChange={(event) => updateLink(link.id, 'url', event.target.value)}
                />
                <button className="icon-button" type="button" onClick={() => removeLink(link.id)} aria-label="Удалить полезную ссылку">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions wide">
        {(errors.form || submitError) && <p className="form-error">{errors.form || submitError}</p>}
        <button className="ghost-button" disabled={isSaving} type="button" onClick={onCancel}>
          Отмена
        </button>
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Сохраняем...' : 'Сохранить ученика'}
        </button>
      </div>
    </form>
  )
}
