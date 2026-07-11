import { X } from 'lucide-react'
import { useState } from 'react'
import type { HomeworkStatus, Lesson } from '../types/domain'
import { formatDateTime } from '../utils/format'

type Props = {
  lesson: Lesson
  onClose: () => void
  onSave: (lesson: Lesson) => void
}

export function HomeworkReviewModal({ lesson, onClose, onSave }: Props) {
  const [comment, setComment] = useState(lesson.homeworkReviewComment || '')
  const [status, setStatus] = useState<Extract<HomeworkStatus, 'checked' | 'needs_correction'>>(
    lesson.homeworkStatus === 'needs_correction' ? 'needs_correction' : 'checked',
  )

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal review-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Проверка Д/З</p>
            <h2>{lesson.topic}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="review-modal-content">
          <section className="review-submissions">
            <h3>История сдач</h3>
            {lesson.submissions.length === 0 ? (
              <p className="muted">У этого урока пока нет отправленных работ.</p>
            ) : (
              lesson.submissions.map((submission, index) => (
                <article className="submission-card" key={submission.id}>
                  <header>
                    <strong>Сдача {index + 1}</strong>
                    <time>{formatDateTime(submission.submittedAt)}</time>
                  </header>
                  {submission.comment ? <p>{submission.comment}</p> : <p className="muted">Комментарий не добавлен.</p>}
                  <div className="submission-files">
                    {submission.photos.map((photo) =>
                      photo.previewUrl ? (
                        <a className="chip file-chip-link" href={photo.previewUrl} target="_blank" rel="noreferrer" key={photo.id}>
                          Открыть фото: {photo.name} · {photo.sizeMb} МБ
                        </a>
                      ) : (
                        <span className="chip unavailable-file-chip" key={photo.id}>
                          {photo.name} · {photo.sizeMb} МБ · фото пока недоступно
                        </span>
                      ),
                    )}
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="review-decision">
            <label>
              Комментарий репетитора
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Что получилось, что исправить, на что обратить внимание"
              />
            </label>
            <label>
              Итог проверки
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="checked">Проверено</option>
                <option value="needs_correction">Нужно исправить</option>
              </select>
            </label>
          </section>
        </div>

        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              onSave({
                ...lesson,
                homeworkReviewComment: comment,
                homeworkStatus: status,
              })
            }
          >
            Сохранить проверку
          </button>
        </div>
      </div>
    </div>
  )
}
