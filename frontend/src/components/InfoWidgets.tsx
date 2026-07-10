import { ExternalLink, Link as LinkIcon, Target, CalendarDays } from 'lucide-react'
import type { Student } from '../types/domain'

type Props = {
  student: Student
  role: 'tutor' | 'student'
}

export function InfoWidgets({ student, role }: Props) {
  const widgets = [
    {
      title: 'Расписание',
      icon: CalendarDays,
      content: student.schedule,
      empty: 'Расписание пока не заполнено',
    },
    {
      title: 'Цели занятий',
      icon: Target,
      content: student.goals,
      empty: 'Цели пока не заполнены',
    },
  ]

  return (
    <section className="widgets-grid">
      {widgets.map((widget) => {
        if (role === 'student' && !widget.content) return null
        const Icon = widget.icon
        return (
          <article className="info-widget" key={widget.title}>
            <Icon size={19} />
            <span>{widget.title}</span>
            <strong>{widget.content || widget.empty}</strong>
          </article>
        )
      })}

      {(role === 'tutor' || student.meetingUrl) && (
        <article className="info-widget">
          <ExternalLink size={19} />
          <span>Подключение</span>
          {student.meetingUrl ? (
            <a href={student.meetingUrl} target="_blank">
              Открыть ссылку занятия
            </a>
          ) : (
            <strong>Ссылка пока не заполнена</strong>
          )}
        </article>
      )}

      {(role === 'tutor' || student.usefulLinks.length > 0) && (
        <article className="info-widget links-widget">
          <LinkIcon size={19} />
          <span>Полезные ссылки</span>
          {student.usefulLinks.length > 0 ? (
            <div className="link-list">
              {student.usefulLinks.map((link) => (
                <a href={link.url} target="_blank" key={link.id}>
                  {link.title}
                </a>
              ))}
            </div>
          ) : (
            <strong>Список пока пуст</strong>
          )}
        </article>
      )}
    </section>
  )
}
