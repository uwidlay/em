import { Bell, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { HomeworkModal } from '../components/HomeworkModal'
import type { HomeworkPhotoDraft } from '../components/HomeworkModal'
import { InfoWidgets } from '../components/InfoWidgets'
import { LessonTable } from '../components/LessonTable'
import {
  getPublicStudentProfile,
  markStudentUpdatesSeen,
  submitHomeworkWithPhotos,
} from '../shared/api/studentTokenFlowApi'
import type { Lesson, Student, StudentUpdateEvent } from '../types/domain'
import { formatDate, formatDateTime } from '../utils/format'
import { selectActualHomework } from '../utils/homework'
import { compareLessonsNewestFirst } from '../utils/lessons'

type PublicProfileState = {
  student: Student
  lessons: Lesson[]
  updateEvents: StudentUpdateEvent[]
}

export function PublicStudentProfilePage() {
  const { token } = useParams()
  const [profile, setProfile] = useState<PublicProfileState | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | undefined>()
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmittingHomework, setIsSubmittingHomework] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!token) {
        setError('Ссылка ученика не найдена.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError('')
      const result = await getPublicStudentProfile(token)
      if (!isMounted) return

      setIsLoading(false)

      if (!result.data) {
        setProfile(null)
        setError(result.error || 'Не удалось открыть профиль ученика.')
        return
      }

      setProfile({
        student: result.data.student,
        lessons: result.data.lessons,
        updateEvents: result.data.updateEvents,
      })
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [token])

  async function reloadProfile() {
    if (!token) return

    const result = await getPublicStudentProfile(token)
    if (!result.data) {
      setError(result.error || 'Не удалось обновить профиль ученика.')
      return
    }

    setProfile({
      student: result.data.student,
      lessons: result.data.lessons,
      updateEvents: result.data.updateEvents,
    })
  }

  const studentLessons = useMemo(() => {
    return [...(profile?.lessons || [])]
      .filter((lesson) => !lesson.deletedAt)
      .sort(compareLessonsNewestFirst)
  }, [profile?.lessons])

  const actualHomework = selectActualHomework(studentLessons)
  const canSubmitActualHomework =
    actualHomework?.homeworkStatus === 'not_submitted' || actualHomework?.homeworkStatus === 'needs_correction'
  const recentUpdates = (profile?.updateEvents || profile?.student.updateEvents || []).slice(0, 5)

  async function markUpdatesSeen() {
    if (!token || !profile) return

    setIsUpdatesOpen((current) => !current)
    if (!profile.student.hasUnreadUpdates) return

    const result = await markStudentUpdatesSeen({ token })
    if (!result.data) return

    setProfile((current) =>
      current
        ? {
            ...current,
            student: {
              ...current.student,
              hasUnreadUpdates: false,
              updateEvents: (current.student.updateEvents || []).map((event) => ({ ...event, isSeen: true })),
            },
            updateEvents: current.updateEvents.map((event) => ({ ...event, isSeen: true })),
          }
        : current,
    )
  }

  async function submitHomework(payload: { comment?: string; photos: HomeworkPhotoDraft[] }) {
    if (!token || !selectedLesson) return

    setSubmitError('')
    setIsSubmittingHomework(true)

    const result = await submitHomeworkWithPhotos({
      token,
      lessonId: selectedLesson.id,
      comment: payload.comment,
      photos: payload.photos,
    })

    setIsSubmittingHomework(false)

    if (!result.data) {
      setSubmitError(result.error || 'Не удалось отправить Д/З.')
      return
    }

    setSelectedLesson(undefined)
    await reloadProfile()
  }

  if (isLoading) {
    return (
      <main className="student-public-page">
        <div className="empty-state">
          <h1>Открываем профиль</h1>
          <p>Проверяем ученическую ссылку и загружаем занятия.</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="student-public-page">
        <div className="empty-state">
          <h1>Ссылка не найдена</h1>
          <p>{error || 'Проверьте адрес или запросите новую ссылку у репетитора.'}</p>
        </div>
      </main>
    )
  }

  const { student } = profile

  return (
    <main className="student-public-page">
      <header className="student-header">
        <div>
          <p className="eyebrow">Профиль ученика</p>
          <h1>{student.name}</h1>
          <p>{student.subject}{student.grade ? ` · ${student.grade}` : ''}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={markUpdatesSeen}
          aria-label="Обновления"
        >
          <Bell size={19} />
          {student.hasUnreadUpdates && <span className="dot" />}
        </button>
        {(student.hasUnreadUpdates || isUpdatesOpen) && (
          <div className="updates-summary">
            <span className="updates-pill">{student.hasUnreadUpdates ? 'Есть обновления' : 'Последние обновления'}</span>
            {recentUpdates.length > 0 ? (
              <ul className="updates-list">
                {recentUpdates.map((event) => (
                  <li key={event.id}>
                    <p>{event.message}</p>
                    <time>{formatDateTime(event.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Список обновлений будет доступен после расширения student-token-flow.</p>
            )}
          </div>
        )}
      </header>

      <InfoWidgets student={student} role="student" />

      <section className="homework-summary">
        <div>
          <p className="eyebrow">Ближайшее Д/З / последнее Д/З</p>
          <h2>{actualHomework?.topic || 'Пока нет заданий'}</h2>
          <p title={actualHomework?.homeworkText || undefined}>
            {actualHomework?.homeworkText || 'Когда репетитор добавит занятие, задание появится здесь.'}
          </p>
        </div>
        <div className="summary-actions">
          {actualHomework?.homeworkDeadline && <span>Дедлайн: {formatDate(actualHomework.homeworkDeadline)}</span>}
          {actualHomework && canSubmitActualHomework && (
            <button className="primary-button" type="button" onClick={() => setSelectedLesson(actualHomework)}>
              <Upload size={17} />
              {actualHomework.homeworkStatus === 'needs_correction' ? 'Отправить исправления' : 'Сдать Д/З'}
            </button>
          )}
          {actualHomework?.homeworkStatus === 'in_review' && (
            <span className="readonly-note">Д/З уже на проверке. Файлы можно добавить после проверки.</span>
          )}
          {actualHomework?.homeworkStatus === 'checked' && (
            <span className="readonly-note">Д/З проверено. Новая отправка недоступна.</span>
          )}
        </div>
      </section>

      <section className="page-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">История занятий</p>
            <h2>Занятия</h2>
          </div>
        </div>
        {studentLessons.length === 0 ? (
          <div className="empty-state">
            <h3>Занятий пока нет</h3>
            <p>Когда репетитор добавит первый урок, он появится здесь.</p>
          </div>
        ) : (
          <LessonTable lessons={studentLessons} role="student" onSubmitHomework={setSelectedLesson} />
        )}
      </section>

      {selectedLesson && (
        <HomeworkModal
          onClose={() => setSelectedLesson(undefined)}
          onSubmit={submitHomework}
          isSubmitting={isSubmittingHomework}
          submitError={submitError}
        />
      )}
    </main>
  )
}
