import { Navigate, Route, Routes } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/AppShell'
import { AuthLayout } from './components/AuthLayout'
import { mockScheduleEvents } from './mocks/mockData'
import { ConfirmEmailPage, ForgotPasswordPage, LoginPage, RegisterPage } from './pages/auth/AuthPages'
import { PublicStudentProfilePage } from './pages/PublicStudentProfilePage'
import { SchedulePage } from './pages/SchedulePage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentEditorPage, type StudentSaveResult } from './pages/StudentEditorPage'
import { TutorDashboardPage } from './pages/TutorDashboardPage'
import { TutorStudentProfilePage } from './pages/TutorStudentProfilePage'
import { signOutTutor } from './shared/api/authApi'
import {
  saveMockLesson,
  softDeleteMockLesson,
  toggleMockLessonPaid,
} from './shared/api/mockLessonsApi'
import {
  saveLesson as saveSupabaseLesson,
  softDeleteLesson as softDeleteSupabaseLesson,
  toggleLessonPaid as toggleSupabaseLessonPaid,
} from './shared/api/lessonsApi'
import {
  createMockStudent,
  regenerateMockStudentToken,
  updateMockStudent,
} from './shared/api/mockStudentsApi'
import { getMockTutorWorkspace } from './shared/api/mockTutorApi'
import {
  createStudentWithToken as createSupabaseStudentWithToken,
  regenerateStudentToken as regenerateSupabaseStudentToken,
  updateStudent as updateSupabaseStudent,
} from './shared/api/studentsApi'
import { getSupabaseClient } from './shared/api/supabaseClient'
import { getTutorWorkspace, updateTutorSettings } from './shared/api/tutorApi'
import type { Lesson, Student, Tutor } from './types/domain'
import { studentUrl } from './utils/format'
import './styles/app.css'

const initialWorkspace = getMockTutorWorkspace()

function App() {
  const [tutor, setTutor] = useState<Tutor>(initialWorkspace.tutor)
  const [students, setStudents] = useState<Student[]>(initialWorkspace.students)
  const [lessons, setLessons] = useState<Lesson[]>(initialWorkspace.lessons)
  const [toastMessage, setToastMessage] = useState('')
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [isSupabaseWorkspace, setIsSupabaseWorkspace] = useState(false)
  const [hasAuthSession, setHasAuthSession] = useState(() => !getSupabaseClient())
  const [isAuthChecking, setIsAuthChecking] = useState(() => Boolean(getSupabaseClient()))

  const pendingReviews = useMemo(
    () => lessons.filter((lesson) => lesson.homeworkStatus === 'in_review' && !lesson.deletedAt).length,
    [lessons],
  )

  const loadTutorWorkspace = useCallback(async () => {
    setIsWorkspaceLoading(true)
    const result = await getTutorWorkspace()

    setIsWorkspaceLoading(false)

    if (!result.data) {
      setWorkspaceError(result.error)
      setIsSupabaseWorkspace(false)
      return
    }

    setTutor(result.data.tutor)
    setStudents(result.data.students)
    setLessons(result.data.lessons)
    setWorkspaceError(null)
    setIsSupabaseWorkspace(true)
  }, [])

  useEffect(() => {
    if (!toastMessage) return undefined
    const timeoutId = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    let isMounted = true

    const supabase = getSupabaseClient()
    if (!supabase) {
      setHasAuthSession(true)
      setIsAuthChecking(false)
      void loadTutorWorkspace()
      return () => {
        isMounted = false
      }
    }

    setIsAuthChecking(true)

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!isMounted) return

      const session = sessionData.session
      setHasAuthSession(Boolean(session))
      setIsAuthChecking(false)

      if (session) {
        void loadTutorWorkspace()
      } else {
        setWorkspaceError(null)
        setIsSupabaseWorkspace(false)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!isMounted) return

        setHasAuthSession(Boolean(session))
        setIsAuthChecking(false)

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          void loadTutorWorkspace()
        }

        if (event === 'SIGNED_OUT') {
          setTutor(initialWorkspace.tutor)
          setStudents(initialWorkspace.students)
          setLessons(initialWorkspace.lessons)
          setWorkspaceError(null)
          setIsSupabaseWorkspace(false)
        }
      }, 0)
    })

    return () => {
      isMounted = false
      data?.subscription.unsubscribe()
    }
  }, [loadTutorWorkspace])

  function showToast(message: string) {
    setToastMessage(message)
  }

  function shouldUseSupabaseApi() {
    return Boolean(getSupabaseClient())
  }

  async function copyStudentLink(token: string) {
    if (!token) {
      showToast('Ссылка недоступна: plaintext token не хранится в базе. Создайте новую ссылку для ученика.')
      return
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is unavailable')
      }
      await navigator.clipboard.writeText(studentUrl(token))
      showToast('Ссылка скопирована.')
    } catch {
      showToast('Не удалось скопировать ссылку.')
    }
  }

  async function createStudent(payload: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>): Promise<StudentSaveResult> {
    if (shouldUseSupabaseApi()) {
      const result = await createSupabaseStudentWithToken(payload)
      if (!result.data) {
        const error = result.error || 'Не удалось создать ученика.'
        showToast(error)
        return { ok: false, error }
      }

      const createdStudent = result.data.student
      setStudents((current) => [createdStudent, ...current])
      showToast('Ученик создан. Новая ссылка доступна в карточке ученика.')
      return { ok: true }
    }

    setStudents((current) => createMockStudent(current, payload))
    showToast('Ученик создан.')
    return { ok: true }
  }

  async function updateStudent(id: string, payload: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>): Promise<StudentSaveResult> {
    if (shouldUseSupabaseApi()) {
      const previousToken = students.find((student) => student.id === id)?.token || ''
      const result = await updateSupabaseStudent({ ...payload, id })
      if (!result.data) {
        const error = result.error || 'Не удалось обновить ученика.'
        showToast(error)
        return { ok: false, error }
      }

      const updatedStudent = result.data
      setStudents((current) =>
        current.map((student) =>
          student.id === id
            ? {
                ...updatedStudent,
                token: updatedStudent.token || previousToken,
              }
            : student,
        ),
      )
      showToast(payload.status === 'archived' ? 'Ученик перенесен в архив.' : 'Карточка ученика обновлена.')
      return { ok: true }
    }

    setStudents((current) => updateMockStudent(current, { ...payload, id }))
    showToast('Карточка ученика обновлена.')
    return { ok: true }
  }

  async function saveLesson(nextLesson: Lesson) {
    if (shouldUseSupabaseApi()) {
      const result = await saveSupabaseLesson(nextLesson)
      if (!result.data) {
        showToast(result.error || 'Не удалось сохранить урок.')
        return
      }

      const savedLesson = result.data
      const previousLesson = lessons.find((lesson) => lesson.id === nextLesson.id)
      setLessons((current) =>
        previousLesson
          ? current.map((lesson) => (lesson.id === previousLesson.id ? savedLesson : lesson))
          : [savedLesson, ...current],
      )
      setStudents((current) =>
        current.map((student) =>
          student.id === savedLesson.studentId
            ? { ...student, hasUnreadUpdates: true }
            : student,
        ),
      )
      showToast('Урок сохранен.')
      return
    }

    const result = saveMockLesson(lessons, students, nextLesson)
    setLessons(result.lessons)
    setStudents(result.students)
    showToast('Урок сохранен.')
  }

  async function deleteLesson(lessonId: string) {
    if (shouldUseSupabaseApi()) {
      const result = await softDeleteSupabaseLesson({ lessonId })
      if (!result.data) {
        showToast(result.error || 'Не удалось скрыть урок.')
        return
      }

      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === lessonId ? { ...lesson, deletedAt: new Date().toISOString() } : lesson,
        ),
      )
      showToast('Урок скрыт из таблицы.')
      return
    }

    setLessons((current) => softDeleteMockLesson(current, lessonId))
    showToast('Урок скрыт из таблицы.')
  }

  async function toggleLessonPaid(lessonId: string) {
    if (shouldUseSupabaseApi()) {
      const lesson = lessons.find((item) => item.id === lessonId)
      if (!lesson) {
        showToast('Урок не найден.')
        return
      }

      const nextPaidState = !lesson.isPaid
      const result = await toggleSupabaseLessonPaid({ lessonId, isPaid: nextPaidState })
      if (!result.data) {
        showToast(result.error || 'Не удалось обновить оплату.')
        return
      }

      const updatedLesson = result.data
      setLessons((current) => current.map((item) => (item.id === lessonId ? updatedLesson : item)))
      showToast(updatedLesson.isPaid ? 'Урок отмечен оплаченным.' : 'Отметка оплаты снята.')
      return
    }

    const result = toggleMockLessonPaid(lessons, lessonId)
    setLessons(result.lessons)
    showToast(result.isPaid ? 'Урок отмечен оплаченным.' : 'Отметка оплаты снята.')
  }

  async function regenerateToken(studentId: string) {
    if (shouldUseSupabaseApi()) {
      const result = await regenerateSupabaseStudentToken(studentId)
      if (!result.data) {
        showToast(result.error || 'Не удалось создать новую ссылку.')
        return
      }

      const plaintextToken = result.data.plaintextToken
      setStudents((current) =>
        current.map((student) =>
          student.id === studentId ? { ...student, token: plaintextToken } : student,
        ),
      )
      showToast('Новая ссылка создана. Скопируйте ее и отправьте ученику.')
      return
    }

    setStudents((current) => regenerateMockStudentToken(current, studentId))
    showToast('Новая ссылка создана.')
  }

  async function saveTutorSettings(payload: { name: string; email: string; phone: string; password?: string }) {
    if (shouldUseSupabaseApi()) {
      const result = await updateTutorSettings(payload)
      if (!result.data) {
        return { ok: false, error: result.error || 'Не удалось сохранить настройки.' }
      }

      setTutor(result.data.tutor)
      const message = result.data.needsEmailConfirmation
        ? 'Настройки сохранены. Подтвердите новый email по ссылке из письма.'
        : 'Настройки сохранены.'
      showToast(message)
      return { ok: true, message }
    }

    setTutor((current) => ({
      ...current,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    }))
    showToast('Настройки сохранены.')
    return { ok: true, message: 'Настройки сохранены.' }
  }

  async function signOut() {
    const result = await signOutTutor()
    showToast(result.ok ? 'Вы вышли из аккаунта.' : result.error || 'Не удалось выйти.')
  }

  return (
    <>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route
          path="/app"
          element={isAuthChecking ? (
            <main className="content auth-check-screen">
              <p className="eyebrow">Проверяем вход</p>
              <h1>Загружаем кабинет...</h1>
            </main>
          ) : hasAuthSession ? (
            <AppShell
              tutor={tutor}
              pendingReviews={pendingReviews}
              onSignOut={signOut}
              isWorkspaceLoading={isWorkspaceLoading}
              workspaceError={workspaceError}
              workspaceModeLabel={isSupabaseWorkspace ? 'Данные Supabase' : 'MVP на мок-данных'}
            />
          ) : (
            <Navigate to="/login" replace />
          )}
        >
          <Route index element={<TutorDashboardPage students={students} lessons={lessons} onCopyStudentLink={copyStudentLink} />} />
          <Route
            path="students/new"
            element={<StudentEditorPage students={students} onCreate={createStudent} onUpdate={updateStudent} />}
          />
          <Route
            path="students/:studentId"
            element={
              <TutorStudentProfilePage
                students={students}
              lessons={lessons}
              onSaveLesson={saveLesson}
              onDeleteLesson={deleteLesson}
              onToggleLessonPaid={toggleLessonPaid}
              onRegenerateToken={regenerateToken}
              onCopyStudentLink={copyStudentLink}
            />
            }
          />
          <Route
            path="students/:studentId/edit"
            element={<StudentEditorPage students={students} onCreate={createStudent} onUpdate={updateStudent} />}
          />
          <Route path="schedule" element={<SchedulePage events={mockScheduleEvents} />} />
          <Route path="settings" element={<SettingsPage tutor={tutor} onSaveSettings={saveTutorSettings} />} />
        </Route>

        <Route
          path="/student/:token"
          element={<PublicStudentProfilePage />}
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      {toastMessage && (
        <div className="toast-message" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </>
  )
}

export default App
