import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { StudentForm } from '../components/StudentForm'
import type { Student } from '../types/domain'

export type StudentSaveResult = {
  ok: boolean
  error?: string
}

type Props = {
  students: Student[]
  onCreate: (student: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>) => Promise<StudentSaveResult>
  onUpdate: (id: string, student: Omit<Student, 'id' | 'token' | 'hasUnreadUpdates'>) => Promise<StudentSaveResult>
}

export function StudentEditorPage({ students, onCreate, onUpdate }: Props) {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const student = studentId ? students.find((item) => item.id === studentId) : undefined
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  return (
    <section className="page-section narrow-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">SCR-006</p>
          <h2>{student ? 'Редактировать ученика' : 'Создать ученика'}</h2>
        </div>
      </div>
      <StudentForm
        initial={student}
        isSaving={isSaving}
        submitError={error}
        onCancel={() => navigate(student ? `/app/students/${student.id}` : '/app')}
        onSubmit={async (payload) => {
          setError('')
          setIsSaving(true)
          let result: StudentSaveResult
          if (student) {
            result = await onUpdate(student.id, payload)
          } else {
            result = await onCreate(payload)
          }
          setIsSaving(false)

          if (!result.ok) {
            setError(result.error || 'Не удалось сохранить ученика. Проверьте сообщение внизу экрана и попробуйте еще раз.')
            return
          }

          navigate(student ? `/app/students/${student.id}` : '/app')
        }}
      />
    </section>
  )
}
