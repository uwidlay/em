import { Copy, Edit, Plus, RotateCcw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { InfoWidgets } from '../components/InfoWidgets'
import { HomeworkReviewModal } from '../components/HomeworkReviewModal'
import { LessonModal } from '../components/LessonModal'
import { LessonTable } from '../components/LessonTable'
import type { Lesson, Student } from '../types/domain'
import { formatDate } from '../utils/format'
import { selectActualHomework } from '../utils/homework'
import { compareLessonsNewestFirst } from '../utils/lessons'

type Props = {
  students: Student[]
  lessons: Lesson[]
  onSaveLesson: (lesson: Lesson) => void
  onDeleteLesson: (lessonId: string) => void
  onToggleLessonPaid: (lessonId: string) => void
  onRegenerateToken: (studentId: string) => void
  onCopyStudentLink: (token: string) => void
}

export function TutorStudentProfilePage({
  students,
  lessons,
  onSaveLesson,
  onDeleteLesson,
  onToggleLessonPaid,
  onRegenerateToken,
  onCopyStudentLink,
}: Props) {
  const { studentId } = useParams()
  const student = students.find((item) => item.id === studentId)
  const [editingLesson, setEditingLesson] = useState<Lesson | undefined>()
  const [reviewLesson, setReviewLesson] = useState<Lesson | undefined>()
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | undefined>()
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false)
  const [isTokenConfirmOpen, setIsTokenConfirmOpen] = useState(false)

  const studentLessons = useMemo(() => {
    return lessons
      .filter((lesson) => lesson.studentId === studentId && !lesson.deletedAt)
      .sort(compareLessonsNewestFirst)
  }, [lessons, studentId])

  const actualHomework = selectActualHomework(studentLessons)

  if (!student) {
    return <div className="empty-state"><h2>Ученик не найден</h2></div>
  }

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div>
          <p className="eyebrow">Профиль ученика</p>
          <h2>{student.name}</h2>
          <p>{student.subject}{student.grade ? ` · ${student.grade}` : ''}</p>
        </div>
        <div className="hero-actions">
          <Link className="soft-button" to={`/app/students/${student.id}/edit`}>
            <Edit size={17} />
            Карточка
          </Link>
          <button className="soft-button" type="button" onClick={() => onCopyStudentLink(student.token)}>
            <Copy size={17} />
            Ссылка
          </button>
          <button className="ghost-button" type="button" onClick={() => setIsTokenConfirmOpen(true)}>
            <RotateCcw size={17} />
            Новая ссылка
          </button>
        </div>
      </div>

      <InfoWidgets student={student} role="tutor" />

      <section className="homework-summary">
        <div>
          <p className="eyebrow">Ближайшее Д/З / последнее Д/З</p>
          <h3>{actualHomework?.topic || 'Пока нет уроков'}</h3>
          <p>{actualHomework?.homeworkText || 'Создайте занятие, чтобы появилось актуальное задание.'}</p>
        </div>
        {actualHomework?.homeworkDeadline && <span>Дедлайн: {formatDate(actualHomework.homeworkDeadline)}</span>}
      </section>

      <div className="section-header">
        <div>
          <p className="eyebrow">История занятий</p>
          <h2>Занятия</h2>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setEditingLesson(undefined)
            setIsLessonModalOpen(true)
          }}
        >
          <Plus size={17} />
          Добавить занятие
        </button>
      </div>

      <LessonTable
        lessons={studentLessons}
        role="tutor"
        onTogglePaid={onToggleLessonPaid}
        onReviewLesson={setReviewLesson}
        onRequestDeleteLesson={setLessonToDelete}
        onEditLesson={(lesson) => {
          setEditingLesson(lesson)
          setIsLessonModalOpen(true)
        }}
      />

      {isLessonModalOpen && (
        <LessonModal
          lesson={editingLesson}
          studentId={student.id}
          onClose={() => setIsLessonModalOpen(false)}
          onSave={(lesson) => {
            onSaveLesson(lesson)
            setIsLessonModalOpen(false)
          }}
        />
      )}

      {reviewLesson && (
        <HomeworkReviewModal
          lesson={reviewLesson}
          onClose={() => setReviewLesson(undefined)}
          onSave={(lesson) => {
            onSaveLesson(lesson)
            setReviewLesson(undefined)
          }}
        />
      )}

      {lessonToDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-narrow confirm-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Мягкое удаление</p>
                <h2>Удалить урок?</h2>
              </div>
            </div>
            <div className="confirm-content">
              <p>
                Урок будет скрыт из таблицы, но история сохранится. В будущей базе это будет
                мягкое удаление через поле deleted_at.
              </p>
              <p>{lessonToDelete.topic}</p>
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setLessonToDelete(undefined)}>
                Отмена
              </button>
              <button
                className="primary-button danger-button"
                type="button"
                onClick={() => {
                  onDeleteLesson(lessonToDelete.id)
                  setLessonToDelete(undefined)
                }}
              >
                Удалить урок
              </button>
            </div>
          </div>
        </div>
      )}

      {isTokenConfirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-narrow confirm-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Опасное действие</p>
                <h2>Создать новую ссылку?</h2>
              </div>
            </div>
            <div className="confirm-content">
              <p>
                Новая ссылка заменит старую. Ученику нужно будет сохранить новый адрес,
                иначе старая ссылка в будущей реализации перестанет открывать профиль.
              </p>
              <p>
                Используйте это действие только если ссылка потерялась или стала небезопасной.
              </p>
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setIsTokenConfirmOpen(false)}>
                Отмена
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  onRegenerateToken(student.id)
                  setIsTokenConfirmOpen(false)
                }}
              >
                Создать новую ссылку
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
