type Props = {
  value?: number
  onChange?: (value: number) => void
}

export function Stars({ value = 0, onChange }: Props) {
  return (
    <div className="stars" aria-label={`Усвоение темы: ${value || 'не указано'}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          className={star <= value ? 'active' : ''}
          disabled={!onChange}
          key={star}
          onClick={() => onChange?.(star)}
          type="button"
          aria-label={`${star} из 5`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
