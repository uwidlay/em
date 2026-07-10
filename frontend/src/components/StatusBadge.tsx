import type { HomeworkStatus, StudentStatus } from '../types/domain'
import { homeworkStatusLabel, studentStatusLabel } from '../utils/format'

type Props =
  | {
      type: 'homework'
      value: HomeworkStatus
    }
  | {
      type: 'student'
      value: StudentStatus
    }

export function StatusBadge(props: Props) {
  const label =
    props.type === 'homework'
      ? homeworkStatusLabel[props.value]
      : studentStatusLabel[props.value]

  return <span className={`status-badge ${props.type}-${props.value}`}>{label}</span>
}
