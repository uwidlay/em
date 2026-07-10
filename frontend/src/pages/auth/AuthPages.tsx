import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  registerTutor,
  resendTutorConfirmation,
  sendPasswordRecoveryEmail,
  signInTutor,
} from '../../shared/api/authApi'
import {
  normalizeTutorPhoneInput,
  passwordRequirementStates,
  validateRussianPhone,
  validateTutorPassword,
} from '../../utils/validation'

const resendTimeoutSeconds = 120

type PasswordInputProps = {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  hasError?: boolean
}

function PasswordInput({ value, defaultValue, onChange, placeholder, hasError }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div className="password-field">
      <input
        aria-invalid={Boolean(hasError)}
        defaultValue={defaultValue}
        placeholder={placeholder}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      <button
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
        className="password-toggle"
        type="button"
        onClick={() => setIsVisible((current) => !current)}
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Введите email и пароль.')
      return
    }

    setIsLoading(true)
    const result = await signInTutor({ email: email.trim(), password })
    setIsLoading(false)

    if (!result.ok) {
      setError(result.error || 'Не удалось войти.')
      return
    }

    navigate('/app')
  }

  return (
    <div className="auth-content">
      <p className="eyebrow">Вход репетитора</p>
      <h1>Войти в кабинет</h1>
      <form className="form-grid one-column" onSubmit={submitLogin}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Пароль
          <PasswordInput value={password} onChange={setPassword} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? 'Входим...' : 'Войти'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/forgot-password">Забыли пароль?</Link>
        <Link to="/register">Создать аккаунт</Link>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+7')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string; form?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const passwordRequirements = useMemo(() => passwordRequirementStates(password), [password])

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = {
      name: name.trim() ? '' : 'Введите имя репетитора.',
      email: email.trim() ? '' : 'Введите email.',
      phone: validateRussianPhone(phone),
      password: validateTutorPassword(password),
      form: '',
    }
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.email || nextErrors.phone || nextErrors.password) return

    setIsLoading(true)
    const result = await registerTutor({
      name: name.trim(),
      email: email.trim(),
      phone,
      password,
    })
    setIsLoading(false)

    if (!result.ok) {
      setErrors({ ...nextErrors, form: result.error || 'Не удалось зарегистрироваться.' })
      return
    }

    window.sessionStorage.setItem('tutor-space:pending-email', email.trim())
    navigate('/confirm-email')
  }

  return (
    <div className="auth-content">
      <p className="eyebrow">Регистрация</p>
      <h1>Создать аккаунт репетитора</h1>
      <form className="form-grid one-column" onSubmit={submitRegistration}>
        <label>
          Имя
          <input aria-invalid={Boolean(errors.name)} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ольга" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          Email
          <input aria-invalid={Boolean(errors.email)} value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@example.com" />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          Телефон
          <input
            aria-invalid={Boolean(errors.phone)}
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(normalizeTutorPhoneInput(event.target.value))}
            placeholder="+79000000000"
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          Пароль
          <PasswordInput value={password} onChange={setPassword} hasError={Boolean(errors.password)} />
          <ul className="requirement-list" aria-label="Требования к паролю">
            {passwordRequirements.map((requirement) => (
              <li className={requirement.isMet ? 'met' : ''} key={requirement.id}>
                <span aria-hidden="true">{requirement.isMet ? '✓' : '•'}</span>
                {requirement.label}
              </li>
            ))}
          </ul>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        {errors.form && <p className="form-error">{errors.form}</p>}
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
        </button>
      </form>
      <div className="auth-links"><Link to="/login">Уже есть аккаунт</Link></div>
    </div>
  )
}

export function ConfirmEmailPage() {
  const [secondsLeft, setSecondsLeft] = useState(resendTimeoutSeconds)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(() => window.sessionStorage.getItem('tutor-space:pending-email') || '')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [secondsLeft])

  async function resendCode() {
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Введите email, чтобы отправить код повторно.')
      return
    }

    setIsLoading(true)
    const result = await resendTutorConfirmation(email.trim())
    setIsLoading(false)

    if (!result.ok) {
      setError(result.error || 'Не удалось отправить код повторно.')
      return
    }

    setSecondsLeft(resendTimeoutSeconds)
    setMessage('Код подтверждения отправлен повторно.')
  }

  return (
    <div className="auth-content success-state">
      <MailCheck size={42} />
      <p className="eyebrow">Почта почти готова</p>
      <h1>Подтвердите email</h1>
      <p>Мы отправили код подтверждения на email. После подтверждения можно войти в кабинет репетитора.</p>
      <label>
        Email для повторной отправки
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@example.com" />
      </label>
      <button
        className="secondary-button"
        disabled={secondsLeft > 0 || isLoading}
        type="button"
        onClick={resendCode}
      >
        {isLoading
          ? 'Отправляем...'
          : secondsLeft > 0 ? `Отправить код повторно через ${secondsLeft} сек.` : 'Отправить код повторно'}
      </button>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="success-message">{message}</p>}
      <Link className="primary-button" to="/login">Перейти ко входу</Link>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Введите email.')
      return
    }

    setIsLoading(true)
    const result = await sendPasswordRecoveryEmail(email.trim())
    setIsLoading(false)

    if (!result.ok) {
      setError(result.error || 'Не удалось отправить письмо восстановления.')
      return
    }

    setMessage('Письмо для восстановления пароля отправлено.')
  }

  return (
    <div className="auth-content">
      <p className="eyebrow">Восстановление</p>
      <h1>Вернуть доступ</h1>
      <form className="form-grid one-column" onSubmit={submitRecovery}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@example.com" />
        </label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="success-message">{message}</p>}
        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? 'Отправляем...' : 'Отправить ссылку'}
        </button>
      </form>
      <div className="auth-links"><Link to="/login">Назад ко входу</Link></div>
    </div>
  )
}
