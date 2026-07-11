import {
  Check,
  ClipboardCheck,
  FileText,
  Film,
  NotebookTabs,
  Pencil,
  Presentation,
  SquareArrowOutUpRight,
  Trash2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'
import type { HomeworkSubmission, Lesson, LessonMaterial } from '../types/domain'
import { formatDate, formatDateTime, getLateDays, materialTypeLabel } from '../utils/format'
import { Stars } from './Stars'
import { StatusBadge } from './StatusBadge'

type Props = {
  lessons: Lesson[]
  role: 'tutor' | 'student'
  onEditLesson?: (lesson: Lesson) => void
  onReviewLesson?: (lesson: Lesson) => void
  onRequestDeleteLesson?: (lesson: Lesson) => void
  onSubmitHomework?: (lesson: Lesson) => void
  onTogglePaid?: (lessonId: string) => void
}

function MaterialIcon({ material }: { material: LessonMaterial }) {
  const icons = {
    note: FileText,
    video: Film,
    presentation: Presentation,
    board: NotebookTabs,
    taskbook: NotebookTabs,
    other: SquareArrowOutUpRight,
  }
  const Icon = icons[material.type]
  return (
    <a className="material-link" href={material.url} target="_blank" rel="noreferrer" title={`${materialTypeLabel[material.type]}: ${material.title}`}>
      <Icon size={16} />
      <span>{material.title}</span>
    </a>
  )
}

function canStudentSubmit(status: Lesson['homeworkStatus']) {
  return status === 'not_submitted' || status === 'needs_correction'
}

function studentHomeworkHint(lesson: Lesson) {
  if (lesson.homeworkStatus === 'in_review') return 'Отправлено на проверку. Добавить файлы пока нельзя.'
  if (lesson.homeworkStatus === 'checked') return 'Д/З проверено. Новые файлы не принимаются.'
  if (lesson.homeworkStatus === 'needs_correction') return 'Можно отправить исправления новой сдачей.'
  return ''
}

function SubmissionCard({ submission, index }: { submission: HomeworkSubmission; index: number }) {
  return (
    <article className="submission-card">
      <header>
        <strong>Сдача {index + 1}</strong>
        <time>{formatDateTime(submission.submittedAt)}</time>
      </header>
      {submission.comment ? (
        <p>{submission.comment}</p>
      ) : (
        <p className="muted">Комментарий не добавлен.</p>
      )}
      <div className="submission-files" aria-label={`Файлы сдачи ${index + 1}`}>
        {submission.photos.map((photo) =>
          photo.previewUrl ? (
            <a className="chip file-chip-link" href={photo.previewUrl} target="_blank" rel="noreferrer" key={photo.id}>
              {photo.name} · {photo.sizeMb} МБ
            </a>
          ) : (
            <span className="chip" key={photo.id}>
              {photo.name} · {photo.sizeMb} МБ
            </span>
          ),
        )}
      </div>
      <small>Старые файлы сохранены и недоступны для редактирования.</small>
    </article>
  )
}

export function LessonTable({
  lessons,
  role,
  onEditLesson,
  onReviewLesson,
  onRequestDeleteLesson,
  onSubmitHomework,
  onTogglePaid,
}: Props) {
  const [expandedSubmissionLessons, setExpandedSubmissionLessons] = useState<Set<string>>(() => new Set())

  function toggleSubmissionHistory(lessonId: string) {
    setExpandedSubmissionLessons((current) => {
      const next = new Set(current)
      if (next.has(lessonId)) {
        next.delete(lessonId)
      } else {
        next.add(lessonId)
      }
      return next
    })
  }

  return (
    <>
      <div className={`lesson-table-wrap ${role === 'tutor' ? 'tutor-table-wrap' : ''}`}>
        <table className="lesson-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тема</th>
            <th>Материалы</th>
            <th>Усвоение</th>
            <th>Д/З</th>
            <th>Статус</th>
            <th>Сдачи</th>
            <th>Комментарий</th>
            <th>Оплата</th>
            {role === 'tutor' && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const latestSubmission = lesson.submissions.at(-1)
            const lateDays = getLateDays(lesson.homeworkDeadline, latestSubmission?.submittedAt)
            const isHistoryExpanded = expandedSubmissionLessons.has(lesson.id)
            const visibleSubmissions = isHistoryExpanded ? lesson.submissions : latestSubmission ? [latestSubmission] : []
            return (
              <tr key={lesson.id}>
                <td>{formatDate(lesson.date)}</td>
                <td className="topic-cell">{lesson.topic}</td>
                <td>
                  <div className="materials-list">
                    {lesson.materials.length > 0 ? (
                      lesson.materials.map((material) => <MaterialIcon key={material.id} material={material} />)
                    ) : (
                      <span className="muted">Нет</span>
                    )}
                  </div>
                </td>
                <td><Stars value={lesson.understandingRating} /></td>
                <td className="homework-cell">
                  <strong className="homework-text-preview" title={lesson.homeworkText || undefined}>
                    {lesson.homeworkText || 'Д/З не задано'}
                  </strong>
                  {lesson.homeworkDeadline && <small>Дедлайн: {formatDate(lesson.homeworkDeadline)}</small>}
                </td>
                <td><StatusBadge type="homework" value={lesson.homeworkStatus} /></td>
                <td>
                  {latestSubmission ? (
                    <div className="submission-cell">
                      <strong>
                        {isHistoryExpanded ? `История сдач: ${lesson.submissions.length}` : `Последняя сдача: ${latestSubmission.photos.length} фото`}
                      </strong>
                      {visibleSubmissions.map((submission) => (
                        <SubmissionCard
                          index={lesson.submissions.findIndex((item) => item.id === submission.id)}
                          key={submission.id}
                          submission={submission}
                        />
                      ))}
                      {lesson.submissions.length > 1 && (
                        <button
                          className="soft-button compact"
                          type="button"
                          onClick={() => toggleSubmissionHistory(lesson.id)}
                        >
                          {isHistoryExpanded ? 'Скрыть историю' : `Показать все (${lesson.submissions.length})`}
                        </button>
                      )}
                      {lateDays > 0 && <span className="late-label">Просрочка {lateDays} дн.</span>}
                      {role === 'student' && canStudentSubmit(lesson.homeworkStatus) && (
                        <button className="soft-button compact" type="button" onClick={() => onSubmitHomework?.(lesson)}>
                          <Upload size={15} />
                          {lesson.homeworkStatus === 'needs_correction' ? 'Отправить исправления' : 'Сдать еще раз'}
                        </button>
                      )}
                      {role === 'student' && !canStudentSubmit(lesson.homeworkStatus) && (
                        <small>{studentHomeworkHint(lesson)}</small>
                      )}
                    </div>
                  ) : (
                    role === 'student' ? (
                      canStudentSubmit(lesson.homeworkStatus) ? (
                        <button className="soft-button compact" type="button" onClick={() => onSubmitHomework?.(lesson)}>
                          <Upload size={15} />
                          Сдать
                        </button>
                      ) : (
                        <span className="muted">{studentHomeworkHint(lesson)}</span>
                      )
                    ) : (
                      <span className="muted">Нет сдач</span>
                    )
                  )}
                </td>
                <td className="comment-cell">{lesson.homeworkReviewComment || <span className="muted">Пока нет</span>}</td>
                <td>
                  {role === 'tutor' ? (
                    <button
                      className={`paid-mark paid-toggle ${lesson.isPaid ? 'paid' : ''}`}
                      type="button"
                      onClick={() => onTogglePaid?.(lesson.id)}
                      aria-label={lesson.isPaid ? 'Отметить урок неоплаченным' : 'Отметить урок оплаченным'}
                      aria-pressed={lesson.isPaid}
                    >
                      {lesson.isPaid && <Check size={15} />}
                    </button>
                  ) : (
                    <span className={`paid-mark ${lesson.isPaid ? 'paid' : ''}`} aria-label={lesson.isPaid ? 'Урок оплачен' : 'Урок не оплачен'}>
                      {lesson.isPaid && <Check size={15} />}
                    </span>
                  )}
                </td>
                {role === 'tutor' && (
                  <td className="lesson-actions-cell">
                    {lesson.homeworkStatus === 'in_review' && (
                      <button className="soft-button compact" type="button" onClick={() => onReviewLesson?.(lesson)}>
                        <ClipboardCheck size={15} />
                        Проверить Д/З
                      </button>
                    )}
                    <button className="icon-button" type="button" onClick={() => onEditLesson?.(lesson)} aria-label="Редактировать урок">
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button danger-icon" type="button" onClick={() => onRequestDeleteLesson?.(lesson)} aria-label="Удалить урок">
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        </table>
      </div>

      {role === 'tutor' && (
        <div className="tutor-lesson-cards" aria-label="Занятия">
          {lessons.map((lesson) => {
            const latestSubmission = lesson.submissions.at(-1)
            const lateDays = getLateDays(lesson.homeworkDeadline, latestSubmission?.submittedAt)
            return (
              <article className="tutor-lesson-card" key={lesson.id}>
                <header>
                  <div>
                    <time>{formatDate(lesson.date)}</time>
                    <h3>{lesson.topic}</h3>
                  </div>
                  <StatusBadge type="homework" value={lesson.homeworkStatus} />
                </header>

                <div className="mobile-lesson-meta">
                  <span>Усвоение</span>
                  <Stars value={lesson.understandingRating} />
                </div>

                <section>
                  <span className="mobile-card-label">Д/З</span>
                  <p className="homework-text-preview">{lesson.homeworkText || 'Д/З не задано'}</p>
                  {lesson.homeworkDeadline && <small>Дедлайн: {formatDate(lesson.homeworkDeadline)}</small>}
                </section>

                {lesson.materials.length > 0 && (
                  <section>
                    <span className="mobile-card-label">Материалы</span>
                    <div className="materials-list">
                      {lesson.materials.map((material) => <MaterialIcon key={material.id} material={material} />)}
                    </div>
                  </section>
                )}

                <section>
                  <span className="mobile-card-label">Сдачи</span>
                  {latestSubmission ? (
                    <div className="submission-cell">
                      <SubmissionCard index={lesson.submissions.length - 1} submission={latestSubmission} />
                      {lesson.submissions.length > 1 && <small>Всего сдач: {lesson.submissions.length}</small>}
                      {lateDays > 0 && <span className="late-label">Просрочка {lateDays} дн.</span>}
                    </div>
                  ) : (
                    <p className="muted">Нет сдач</p>
                  )}
                </section>

                <section>
                  <span className="mobile-card-label">Комментарий</span>
                  <p>{lesson.homeworkReviewComment || 'Пока нет'}</p>
                </section>

                <footer>
                  <button
                    className={`paid-mark paid-toggle ${lesson.isPaid ? 'paid' : ''}`}
                    type="button"
                    onClick={() => onTogglePaid?.(lesson.id)}
                    aria-label={lesson.isPaid ? 'Отметить урок неоплаченным' : 'Отметить урок оплаченным'}
                    aria-pressed={lesson.isPaid}
                  >
                    {lesson.isPaid && <Check size={15} />}
                  </button>
                  {lesson.homeworkStatus === 'in_review' && (
                    <button className="soft-button compact" type="button" onClick={() => onReviewLesson?.(lesson)}>
                      <ClipboardCheck size={15} />
                      Проверить
                    </button>
                  )}
                  <button className="soft-button compact" type="button" onClick={() => onEditLesson?.(lesson)}>
                    <Pencil size={15} />
                    Изменить
                  </button>
                  <button className="icon-button danger-icon" type="button" onClick={() => onRequestDeleteLesson?.(lesson)} aria-label="Удалить урок">
                    <Trash2 size={16} />
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
