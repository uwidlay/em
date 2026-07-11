import { Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Tutor } from '../types/domain'
import {
  normalizeTutorPhoneInput,
  passwordRequirementStates,
  validateRussianPhone,
  validateTutorEmailDomain,
  validateTutorPassword,
} from '../utils/validation'

type Props = {
  tutor: Tutor
  onSaveSettings: (payload: { name: string; email: string; phone: string; password?: string }) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function SettingsPage({ tutor, onSaveSettings }: Props) {
  const [name, setName] = useState(tutor.name)
  const [email, setEmail] = useState(tutor.email)
  const [phone, setPhone] = useState(normalizeTutorPhoneInput(tutor.phone))
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string; form?: string }>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const passwordRequirements = useMemo(() => passwordRequirementStates(password), [password])

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = {
      name: name.trim() ? '' : 'Введите имя репетитора.',
      email: validateTutorEmailDomain(email),
      phone: validateRussianPhone(phone),
      password: validateTutorPassword(password, { optional: true }),
      form: '',
    }
    setErrors(nextErrors)
    setSuccessMessage('')
    if (nextErrors.name || nextErrors.email || nextErrors.phone || nextErrors.password) return

    setIsSaving(true)
    const result = await onSaveSettings({
      name: name.trim(),
      email: email.trim(),
      phone,
      password: password || undefined,
    })
    setIsSaving(false)

    if (!result.ok) {
      setErrors({ ...nextErrors, form: result.error || 'Не удалось сохранить настройки.' })
      return
    }

    setPassword('')
    setSuccessMessage(result.message || 'Настройки сохранены.')
  }

  return (
    <section className="page-section narrow-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">SCR-011</p>
          <h2>Настройки профиля</h2>
        </div>
      </div>
      <form className="form-grid one-column" onSubmit={submitSettings}>
        <label>
          Имя
          <input aria-invalid={Boolean(errors.name)} value={name} onChange={(event) => setName(event.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          Email
          <input aria-invalid={Boolean(errors.email)} value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          Телефон
          <input
            aria-invalid={Boolean(errors.phone)}
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(normalizeTutorPhoneInput(event.target.value))}
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          Новый пароль
          <div className="password-field">
            <input
              value={password}
              aria-invalid={Boolean(errors.password)}
              onChange={(event) => setPassword(event.target.value)}
              type={isPasswordVisible ? 'text' : 'password'}
              placeholder="Оставьте пустым, если не меняете"
            />
            <button
              aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
              className="password-toggle"
              type="button"
              onClick={() => setIsPasswordVisible((current) => !current)}
            >
              {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="field-hint">Оставьте поле пустым, если не меняете пароль.</span>
          {password.length > 0 && (
            <ul className="requirement-list" aria-label="Требования к новому паролю">
              {passwordRequirements.map((requirement) => (
                <li className={requirement.isMet ? 'met' : ''} key={requirement.id}>
                  <span aria-hidden="true">{requirement.isMet ? '✓' : '•'}</span>
                  {requirement.label}
                </li>
              ))}
            </ul>
          )}
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        {errors.form && <p className="form-error">{errors.form}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
      </form>
    </section>
  )
}
