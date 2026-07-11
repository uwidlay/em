import { Archive, ClipboardCheck, Copy, Plus, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Lesson, Student } from '../types/domain'
import { formatDateTime } from '../utils/format'
import { StatusBadge } from '../components/StatusBadge'
import { useMemo, useState } from 'react'

type Props = {
  students: Student[]
  lessons: Lesson[]
  onCopyStudentLink: (token: string) => void
}

export function TutorDashboardPage({ students, lessons, onCopyStudentLink }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('active')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')

  const subjectOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.subject).filter(Boolean))).sort(),
    [students],
  )

  const gradeOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.grade).filter(Boolean))).sort(),
    [students],
  )

  const filtered = useMemo(() => {
    return students.filter((student) => {
      const matchesStatus = status === 'all' || student.status === status
      const matchesSubject = subjectFilter === 'all' || student.subject === subjectFilter
      const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter
      const text = `${student.name} ${student.subject} ${student.grade || ''}`.toLowerCase()
      return matchesStatus && matchesSubject && matchesGrade && text.includes(query.toLowerCase())
    })
  }, [gradeFilter, query, status, subjectFilter, students])

  const reviewQueue = useMemo(() => {
    return lessons
      .filter((lesson) => lesson.homeworkStatus === 'in_review' && !lesson.deletedAt)
      .map((lesson) => {
        const student = students.find((item) => item.id === lesson.studentId)
        return {
          lesson,
          student,
          latestSubmission: lesson.submissions.at(-1),
        }
      })
      .filter((item) => item.student)
      .sort((a, b) => {
        const aDate = a.latestSubmission?.submittedAt || a.lesson.date
        const bDate = b.latestSubmission?.submittedAt || b.lesson.date
        return bDate.localeCompare(aDate)
      })
  }, [lessons, students])

  function pendingCount(studentId: string) {
    return lessons.filter((lesson) => lesson.studentId === studentId && lesson.homeworkStatus === 'in_review' && !lesson.deletedAt).length
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Рабочее пространство</p>
          <h2>Ученики</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate('/app/students/new')}>
          <Plus size={17} />
          Добавить ученика
        </button>
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени, предмету или классу" />
        </label>
        <div className="segmented">
          {(['active', 'archived', 'all'] as const).map((value) => (
            <button className={status === value ? 'active' : ''} key={value} type="button" onClick={() => setStatus(value)}>
              {value === 'active' ? 'Активные' : value === 'archived' ? 'Архив' : 'Все'}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row" aria-label="Фильтры учеников">
        <label className="select-field">
          Предмет
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="all">Все предметы</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          Класс
          <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
            <option value="all">Все классы</option>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="review-queue">
        <div className="review-queue-header">
          <div>
            <p className="eyebrow">Рабочая очередь</p>
            <h3>К проверке</h3>
          </div>
          <span className="review-badge">{reviewQueue.length}</span>
        </div>
        {reviewQueue.length === 0 ? (
          <div className="review-queue-empty">
            <ClipboardCheck size={22} />
            <p>Сейчас нет Д/З на проверке.</p>
          </div>
        ) : (
          <div className="review-queue-list">
            {reviewQueue.map(({ lesson, student, latestSubmission }) => (
              <Link className="review-queue-item" key={lesson.id} to={`/app/students/${student?.id}`}>
                <span className="review-queue-icon"><ClipboardCheck size={16} /></span>
                <div>
                  <strong>{student?.name}</strong>
                  <p>{lesson.topic}</p>
                </div>
                <small>
                  {latestSubmission ? formatDateTime(latestSubmission.submittedAt) : 'Сдача без даты'}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Archive size={28} />
          <h3>Ученики не найдены</h3>
          <p>Измените поиск или фильтр, либо создайте нового ученика.</p>
        </div>
      ) : (
        <div className="students-grid">
          {filtered.map((student) => {
            const pending = pendingCount(student.id)
            return (
              <article className="student-card" key={student.id}>
                <div className="student-card-top">
                  <StatusBadge type="student" value={student.status} />
                  {pending > 0 && <span className="review-badge">Д/З на проверке: {pending}</span>}
                </div>
                <h3>{student.name}</h3>
                <p>{student.subject}{student.grade ? ` · ${student.grade}` : ''}</p>
                <dl>
                  <div><dt>Расписание</dt><dd>{student.schedule || 'Не заполнено'}</dd></div>
                  <div><dt>Занятие</dt><dd>{student.lessonDurationMinutes || '-'} мин · {student.lessonPrice || '-'} ₽</dd></div>
                </dl>
                <div className="card-actions">
                  <Link className="primary-button" to={`/app/students/${student.id}`}>Открыть</Link>
                  <button className="icon-button" type="button" onClick={() => onCopyStudentLink(student.token)} aria-label="Скопировать ссылку">
                    <Copy size={17} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
