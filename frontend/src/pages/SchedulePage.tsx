import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Link as LinkIcon,
  MapPin,
  Plus,
  Text,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ScheduleEvent } from '../types/domain'

type Props = {
  events: ScheduleEvent[]
}

type CalendarView = 'day' | 'week' | 'month' | 'agenda'

type ScheduleFormState = {
  id?: string
  title: string
  type: ScheduleEvent['type']
  date: string
  startTime: string
  endTime: string
  isAllDay: boolean
  recurrence: NonNullable<ScheduleEvent['recurrence']>
  guests: string
  meetingUrl: string
  location: string
  description: string
  calendarName: string
}

const viewLabel: Record<CalendarView, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  agenda: 'Расписание',
}

const eventTypeLabel: Record<ScheduleEvent['type'], string> = {
  individual: 'Индивидуальный',
  group: 'Группа (Post-MVP)',
  trial: 'Пробное',
  transfer: 'Перенос',
  cancelled: 'Отмена',
  free: 'Свободное окно',
}

const mvpEventTypes = (Object.keys(eventTypeLabel) as ScheduleEvent['type'][]).filter((type) => type !== 'group')

const recurrenceLabel: Record<NonNullable<ScheduleEvent['recurrence']>, string> = {
  none: 'Не повторяется',
  weekly: 'Каждую неделю',
  biweekly: 'Раз в две недели',
  monthly: 'Каждый месяц',
}

const mockToday = new Date('2026-04-15T00:00:00')
const hourStart = 0
const hourEnd = 24
const hourHeight = 76
const scheduleStartMinutes = hourStart * 60
const dayStartMinutes = 0
const dayEndMinutes = 24 * 60
const agendaRangeDays = 31
const timelineHeaderHeight = 58
const allDayRowHeight = 48

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay())
}

function startOfMonthGrid(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  return startOfWeek(monthStart)
}

function monthDays(date: Date) {
  const start = startOfMonthGrid(date)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function weekDays(date: Date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date)
}

function formatPeriod(date: Date, view: CalendarView) {
  if (view === 'day') {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  }
  if (view === 'week') {
    const week = weekDays(date)
    const first = week[0]
    const last = week[6]
    const sameMonth = first.getMonth() === last.getMonth()
    const firstMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(first)
    const lastMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(last)
    return sameMonth ? formatMonth(date) : `${firstMonth} - ${lastMonth}`
  }
  if (view === 'agenda') {
    return `с ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}`
  }
  return formatMonth(date)
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatRange(event: ScheduleEvent) {
  if (event.isAllDay) return 'Весь день'
  return `${formatTime(event.startMinutes)}-${formatTime(event.endMinutes)}`
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date).replace('.', '').toUpperCase()
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric' }).format(date)
}

function longDateLabel(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }).format(date)
}

function eventToForm(event?: ScheduleEvent, date = mockToday): ScheduleFormState {
  return {
    id: event?.id,
    title: event?.title || '',
    type: event?.type || 'individual',
    date: event?.date || toIsoDate(date),
    startTime: formatTime(event?.startMinutes ?? 12 * 60 + 30),
    endTime: formatTime(event?.endMinutes ?? 13 * 60 + 30),
    isAllDay: Boolean(event?.isAllDay),
    recurrence: event?.recurrence || 'none',
    guests: event?.guests || '',
    meetingUrl: event?.meetingUrl || '',
    location: event?.location || '',
    description: event?.description || '',
    calendarName: event?.calendarName || 'Ольга',
  }
}

function formToEvent(form: ScheduleFormState): ScheduleEvent {
  const date = parseIsoDate(form.date)
  return {
    id: form.id || `schedule-${Date.now()}`,
    title: form.title.trim(),
    subtitle: eventTypeLabel[form.type],
    type: form.type,
    day: date.getDay(),
    date: form.date,
    startMinutes: form.isAllDay ? dayStartMinutes : parseTime(form.startTime),
    endMinutes: form.isAllDay ? dayEndMinutes : parseTime(form.endTime),
    isAllDay: form.isAllDay,
    recurrence: form.recurrence,
    guests: form.guests,
    meetingUrl: form.meetingUrl,
    location: form.location,
    description: form.description,
    calendarName: form.calendarName,
  }
}

function eventColorClass(event: ScheduleEvent) {
  return `schedule-${event.type}`
}

function eventStatusLabel(event: ScheduleEvent) {
  if (event.type === 'cancelled') return 'Отмена'
  if (event.type === 'transfer') return 'Перенос'
  return eventTypeLabel[event.type]
}

export function SchedulePage({ events }: Props) {
  const [scheduleEvents, setScheduleEvents] = useState(events)
  const [selectedDate, setSelectedDate] = useState(mockToday)
  const [view, setView] = useState<CalendarView>('week')
  const [form, setForm] = useState<ScheduleFormState | null>(null)
  const [formError, setFormError] = useState('')

  const selectedIsoDate = toIsoDate(selectedDate)
  const hours = Array.from({ length: hourEnd - hourStart + 1 }, (_, index) => hourStart + index)
  const week = useMemo(() => weekDays(selectedDate), [selectedDate])
  const monthGrid = useMemo(() => monthDays(selectedDate), [selectedDate])
  const agendaDays = useMemo(
    () => Array.from({ length: agendaRangeDays }, (_, index) => addDays(selectedDate, index)),
    [selectedDate],
  )

  const sortedEvents = useMemo(
    () => [...scheduleEvents].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.startMinutes - b.startMinutes),
    [scheduleEvents],
  )

  function eventsForDate(date: Date) {
    const iso = toIsoDate(date)
    return sortedEvents.filter((event) => event.date === iso)
  }

  function eventsForCurrentView() {
    if (view === 'day') return eventsForDate(selectedDate)
    if (view === 'week') {
      const weekIso = new Set(week.map(toIsoDate))
      return sortedEvents.filter((event) => event.date && weekIso.has(event.date))
    }
    return sortedEvents.filter((event) => {
      if (!event.date) return false
      const date = parseIsoDate(event.date)
      return date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear()
    })
  }

  function openForm(event?: ScheduleEvent, date = selectedDate) {
    setForm(eventToForm(event, date))
    setFormError('')
  }

  function updateForm<K extends keyof ScheduleFormState>(key: K, value: ScheduleFormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  function saveForm() {
    if (!form) return
    if (!form.title.trim()) {
      setFormError('Добавьте название урока.')
      return
    }
    if (!form.isAllDay && parseTime(form.endTime) <= parseTime(form.startTime)) {
      setFormError('Время окончания должно быть позже времени начала.')
      return
    }

    const nextEvent = formToEvent(form)
    setScheduleEvents((current) => {
      const exists = current.some((event) => event.id === nextEvent.id)
      if (exists) return current.map((event) => (event.id === nextEvent.id ? nextEvent : event))
      return [...current, nextEvent]
    })
    setSelectedDate(parseIsoDate(nextEvent.date || selectedIsoDate))
    setForm(null)
    setFormError('')
  }

  function shiftPeriod(direction: -1 | 1) {
    if (view === 'day') setSelectedDate((current) => addDays(current, direction))
    if (view === 'week') setSelectedDate((current) => addDays(current, direction * 7))
    if (view === 'month' || view === 'agenda') setSelectedDate((current) => addMonths(current, direction))
  }

  function selectMiniDate(date: Date) {
    setSelectedDate(date)
    if (view === 'month') return
    if (view === 'week' && window.innerWidth < 720) setView('day')
  }

  return (
    <section className="schedule-layout">
      <aside className="mini-calendar-panel">
        <button className="primary-button create-lesson-button" type="button" onClick={() => openForm()}>
          <Plus size={18} />
          Создать урок
        </button>
        <div className="mini-calendar">
          <header>
            <strong>{formatMonth(selectedDate)}</strong>
            <span>
              <button className="icon-button" type="button" onClick={() => setSelectedDate((current) => addMonths(current, -1))} aria-label="Предыдущий месяц">
                <ChevronLeft size={17} />
              </button>
              <button className="icon-button" type="button" onClick={() => setSelectedDate((current) => addMonths(current, 1))} aria-label="Следующий месяц">
                <ChevronRight size={17} />
              </button>
            </span>
          </header>
          <div className="mini-calendar-weekdays">
            {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mini-calendar-grid">
            {monthGrid.map((date) => {
              const iso = toIsoDate(date)
              const hasEvents = eventsForDate(date).length > 0
              const isSelected = iso === selectedIsoDate
              const isOutside = date.getMonth() !== selectedDate.getMonth()
              return (
                <button
                  className={`${isSelected ? 'selected' : ''} ${isOutside ? 'outside' : ''}`}
                  key={iso}
                  type="button"
                  onClick={() => selectMiniDate(date)}
                >
                  {date.getDate()}
                  {hasEvents && <span />}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <div className="page-section schedule-page">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar-left">
            <button className="ghost-button" type="button" onClick={() => setSelectedDate(mockToday)}>
              Сегодня
            </button>
            <button className="icon-button" type="button" onClick={() => shiftPeriod(-1)} aria-label="Назад">
              <ChevronLeft size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => shiftPeriod(1)} aria-label="Вперед">
              <ChevronRight size={18} />
            </button>
            <h2>{formatPeriod(selectedDate, view)}</h2>
          </div>
          <div className="calendar-toolbar-right">
            <select value={view} onChange={(event) => setView(event.target.value as CalendarView)} aria-label="Вид расписания">
              {Object.entries(viewLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="schedule-prototype-note">
          Визуальный прототип расписания: события здесь не создают уроки, Д/З и записи в таблице занятий. Группы и абонементы не подключены.
        </div>

        {view === 'week' && (
          <WeekView
            days={week}
            events={eventsForCurrentView()}
            hours={hours}
            onCreate={openForm}
            onEdit={openForm}
          />
        )}

        {view === 'day' && (
          <DayView
            date={selectedDate}
            events={eventsForDate(selectedDate)}
            hours={hours}
            onCreate={openForm}
            onEdit={openForm}
          />
        )}

        {view === 'month' && (
          <MonthView
            monthGrid={monthGrid}
            selectedDate={selectedDate}
            eventsForDate={eventsForDate}
            onSelectDate={(date) => setSelectedDate(date)}
            onEdit={openForm}
          />
        )}

        {view === 'agenda' && (
          <AgendaView
            days={agendaDays}
            eventsForDate={eventsForDate}
            onEdit={openForm}
          />
        )}
      </div>

      {form && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal schedule-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{form.id ? 'Редактирование урока' : 'Новый урок'}</p>
                <h2>{form.id ? 'Редактировать урок' : 'Добавить урок'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setForm(null)} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>

            <div className="schedule-form">
              <label className="schedule-title-field">
                Название урока
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Например: Индивидуальное занятие" />
              </label>

              <div className="schedule-form-row">
                <Clock3 size={20} />
                <div className="schedule-form-grid">
                  <label>
                    Дата
                    <input value={form.date} type="date" onChange={(event) => updateForm('date', event.target.value)} />
                  </label>
                  <label>
                    Начало
                    <input
                      disabled={form.isAllDay}
                      type="time"
                      value={form.startTime}
                      onChange={(event) => updateForm('startTime', event.target.value)}
                    />
                  </label>
                  <label>
                    Конец
                    <input
                      disabled={form.isAllDay}
                      type="time"
                      value={form.endTime}
                      onChange={(event) => updateForm('endTime', event.target.value)}
                    />
                  </label>
                  <label>
                    Повтор
                    <select
                      value={form.recurrence}
                      onChange={(event) => updateForm('recurrence', event.target.value as ScheduleFormState['recurrence'])}
                    >
                      {Object.entries(recurrenceLabel).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <label className="check-row schedule-all-day">
                <input
                  checked={form.isAllDay}
                  type="checkbox"
                  onChange={(event) => updateForm('isAllDay', event.target.checked)}
                />
                Весь день
              </label>

              <label>
                Тип
                <select value={form.type} onChange={(event) => updateForm('type', event.target.value as ScheduleEvent['type'])}>
                  {mvpEventTypes.map((value) => (
                    <option key={value} value={value}>{eventTypeLabel[value]}</option>
                  ))}
                  {form.type === 'group' && (
                    <option value="group">{eventTypeLabel.group}</option>
                  )}
                </select>
              </label>

              <div className="schedule-form-row">
                <Users size={20} />
                <label>
                  Участники
                  <input value={form.guests} onChange={(event) => updateForm('guests', event.target.value)} placeholder="Ученик или комментарий для расписания" />
                </label>
              </div>

              <div className="schedule-form-row">
                <Video size={20} />
                <label>
                  Ссылка на занятие
                  <input value={form.meetingUrl} onChange={(event) => updateForm('meetingUrl', event.target.value)} placeholder="Zoom, Telegram, Meet..." />
                </label>
              </div>

              <div className="schedule-form-row">
                <MapPin size={20} />
                <label>
                  Место
                  <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} placeholder="Онлайн, кабинет, адрес" />
                </label>
              </div>

              <div className="schedule-form-row">
                <Text size={20} />
                <label>
                  Описание / комментарий
                  <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Комментарий, тема, условия переноса или отмены" />
                </label>
              </div>

              <div className="schedule-form-row">
                <LinkIcon size={20} />
                <label>
                  Календарь
                  <input value={form.calendarName} onChange={(event) => updateForm('calendarName', event.target.value)} />
                </label>
              </div>
            </div>

            <div className="form-actions">
              {formError && <p className="form-error">{formError}</p>}
              <button className="ghost-button" type="button" onClick={() => setForm(null)}>Отмена</button>
              <button className="primary-button" type="button" onClick={saveForm}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

type TimelineProps = {
  days: Date[]
  events: ScheduleEvent[]
  hours: number[]
  onCreate: (event?: ScheduleEvent, date?: Date) => void
  onEdit: (event: ScheduleEvent) => void
}

function WeekView({ days, events, hours, onCreate, onEdit }: TimelineProps) {
  return (
    <>
      <div className="schedule-board-wrap week-board-wrap">
        <div className="schedule-board" style={{ minHeight: `${(hourEnd - hourStart) * hourHeight + timelineHeaderHeight + allDayRowHeight}px` }}>
          <div className="schedule-corner">GMT+03</div>
          {days.map((day, index) => (
            <button className="schedule-day-head" style={{ gridColumn: index + 2 }} key={toIsoDate(day)} type="button" onClick={() => onCreate(undefined, day)}>
              <span>{dayLabel(day)}</span>
              <strong>{dateLabel(day)}</strong>
            </button>
          ))}
          <TimelineGrid hours={hours} columnCount={7} />
          <div className="timeline-event-columns">
            {days.map((day) => (
              <TimelineDayColumn
                events={events.filter((event) => event.date === toIsoDate(day))}
                key={toIsoDate(day)}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="week-compact-list">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => event.date === toIsoDate(day))
            .sort((a, b) => a.startMinutes - b.startMinutes)

          return (
            <article className="week-compact-day" key={toIsoDate(day)}>
              <button className="week-compact-date" type="button" onClick={() => onCreate(undefined, day)}>
                <span>{dayLabel(day)}</span>
                <strong>{dateLabel(day)}</strong>
              </button>
              <div className="week-compact-events">
                {dayEvents.length === 0 ? (
                  <p className="muted">Нет уроков</p>
                ) : (
                  dayEvents.map((event) => (
                    <button className={`week-compact-event ${eventColorClass(event)}`} key={event.id} type="button" onClick={() => onEdit(event)}>
                      <time>{formatRange(event)}</time>
                      <strong>{event.title}</strong>
                      <span>{eventStatusLabel(event)}</span>
                    </button>
                  ))
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

type DayViewProps = {
  date: Date
  events: ScheduleEvent[]
  hours: number[]
  onCreate: (event?: ScheduleEvent, date?: Date) => void
  onEdit: (event: ScheduleEvent) => void
}

function DayView({ date, events, hours, onCreate, onEdit }: DayViewProps) {
  return (
    <div className="schedule-board-wrap day-board-wrap">
      <div className="schedule-board day-board" style={{ minHeight: `${(hourEnd - hourStart) * hourHeight + timelineHeaderHeight + allDayRowHeight}px` }}>
        <div className="schedule-corner">GMT+03</div>
        <button className="schedule-day-head" style={{ gridColumn: 2 }} type="button" onClick={() => onCreate(undefined, date)}>
          <span>{dayLabel(date)}</span>
          <strong>{dateLabel(date)}</strong>
        </button>
        <TimelineGrid hours={hours} columnCount={1} />
        <div className="timeline-event-columns single-day">
          <TimelineDayColumn events={events} onEdit={onEdit} />
        </div>
      </div>
    </div>
  )
}

function TimelineGrid({ hours, columnCount }: { hours: number[]; columnCount: number }) {
  return (
    <>
      <div className="all-day-label" aria-hidden="true">Весь день</div>
      <div className="schedule-time-grid" aria-hidden="true">
        {hours.map((hour) => (
          <div className="schedule-hour-row" key={hour} style={{ height: hourHeight }}>
            <span>{hour}:00</span>
          </div>
        ))}
      </div>
      <div className={`schedule-columns ${columnCount === 1 ? 'single-day-grid' : ''}`} aria-hidden="true">
        {Array.from({ length: columnCount }, (_, index) => <span key={index} />)}
      </div>
    </>
  )
}

type PositionedTimelineEvent = {
  event: ScheduleEvent
  lane: number
  laneCount: number
}

function positionEvents(events: ScheduleEvent[]): PositionedTimelineEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
  const lanes: ScheduleEvent[][] = []

  return sorted.map((event) => {
    let laneIndex = lanes.findIndex((lane) => {
      const last = lane[lane.length - 1]
      return last.endMinutes <= event.startMinutes
    })

    if (laneIndex === -1) {
      laneIndex = lanes.length
      lanes.push([])
    }

    lanes[laneIndex].push(event)
    const overlappingCount = sorted.filter(
      (candidate) =>
        candidate.id !== event.id &&
        candidate.startMinutes < event.endMinutes &&
        candidate.endMinutes > event.startMinutes,
    ).length

    return {
      event,
      lane: laneIndex,
      laneCount: Math.max(1, overlappingCount + 1),
    }
  })
}

function TimelineDayColumn({ events, onEdit }: { events: ScheduleEvent[]; onEdit: (event: ScheduleEvent) => void }) {
  const allDayEvents = events.filter((event) => event.isAllDay)
  const timedEvents = events.filter((event) => !event.isAllDay)

  return (
    <div className="timeline-event-column">
      <div className="all-day-events">
        {allDayEvents.map((event) => (
          <button
            className={`all-day-event ${eventColorClass(event)}`}
            key={event.id}
            type="button"
            onClick={() => onEdit(event)}
            title={`${event.title} · ${formatRange(event)}`}
          >
            {event.title}
          </button>
        ))}
      </div>
      {positionEvents(timedEvents).map(({ event, lane, laneCount }) => (
        <TimelineEvent event={event} key={event.id} lane={lane} laneCount={laneCount} onEdit={onEdit} />
      ))}
    </div>
  )
}

function TimelineEvent({
  event,
  lane,
  laneCount,
  onEdit,
}: {
  event: ScheduleEvent
  lane: number
  laneCount: number
  onEdit: (event: ScheduleEvent) => void
}) {
  const top = timelineHeaderHeight + allDayRowHeight + ((event.startMinutes - scheduleStartMinutes) / 60) * hourHeight
  const height = Math.max(42, ((event.endMinutes - event.startMinutes) / 60) * hourHeight - 6)
  const isShort = height < 68
  const gap = 6
  const width = `calc((100% - ${gap * (laneCount - 1)}px) / ${laneCount})`
  const left = `calc((${width} + ${gap}px) * ${lane})`
  return (
    <button
      className={`schedule-event ${eventColorClass(event)} ${isShort ? 'short-event' : ''}`}
      style={{ top, height, left, width }}
      type="button"
      onClick={() => onEdit(event)}
      title={`${event.title} · ${formatRange(event)}`}
    >
      <span>{eventStatusLabel(event)}</span>
      <strong>{event.title}</strong>
      {!isShort && <small>{event.subtitle}</small>}
      <time>{formatRange(event)}</time>
    </button>
  )
}

type MonthViewProps = {
  monthGrid: Date[]
  selectedDate: Date
  eventsForDate: (date: Date) => ScheduleEvent[]
  onSelectDate: (date: Date) => void
  onEdit: (event: ScheduleEvent) => void
}

function MonthView({ monthGrid, selectedDate, eventsForDate, onSelectDate, onEdit }: MonthViewProps) {
  return (
    <div className="month-view">
      <div className="month-weekdays">
        {['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="month-grid">
        {monthGrid.map((date) => {
          const events = eventsForDate(date)
          const visible = events.slice(0, 4)
          const more = events.length - visible.length
          const isOutside = date.getMonth() !== selectedDate.getMonth()
          const isSelected = toIsoDate(date) === toIsoDate(selectedDate)
          return (
            <article className={`${isOutside ? 'outside' : ''} ${isSelected ? 'selected' : ''}`} key={toIsoDate(date)}>
              <button className="month-date" type="button" onClick={() => onSelectDate(date)}>
                {date.getDate()}
              </button>
              <div className="month-events">
                {visible.map((event) => (
                  <button className={`month-event ${eventColorClass(event)}`} key={event.id} type="button" onClick={() => onEdit(event)}>
                    <span />
                    <strong>{event.isAllDay ? 'Весь день' : formatTime(event.startMinutes)}</strong>
                    {event.title}
                  </button>
                ))}
                {more > 0 && <span className="more-events">Еще {more}</span>}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function AgendaView({ days, eventsForDate, onEdit }: { days: Date[]; eventsForDate: (date: Date) => ScheduleEvent[]; onEdit: (event: ScheduleEvent) => void }) {
  const daysWithEvents = days
    .map((date) => ({ date, events: eventsForDate(date) }))
    .filter(({ events }) => events.length > 0)

  if (daysWithEvents.length === 0) {
    return (
      <div className="agenda-view empty-agenda">
        <p className="muted">На выбранный период занятий нет.</p>
      </div>
    )
  }

  return (
    <div className="agenda-view">
      {daysWithEvents.map(({ date, events }) => {
        return (
          <section className="agenda-day" key={toIsoDate(date)}>
            <div className="agenda-date">
              <strong>{date.getDate()}</strong>
              <span>{longDateLabel(date)}</span>
            </div>
            <div className="agenda-events">
              {events.map((event) => (
                <button className={`agenda-event ${eventColorClass(event)}`} key={event.id} type="button" onClick={() => onEdit(event)}>
                  <span className="agenda-dot" />
                  <time>{formatRange(event)}</time>
                  <strong>{event.title}</strong>
                  <small>{eventStatusLabel(event)}</small>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
