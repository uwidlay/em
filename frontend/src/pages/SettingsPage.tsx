import { Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Tutor } from '../types/domain'
import {
  normalizeTutorPhoneInput,
  passwordRequirementStates,
  validateRussianPhone,
  validateTutorPassword,
} from '../utils/validation'

type Props = {
  tutor: Tutor
}

export function SettingsPage({ tutor }: Props) {
  const [phone, setPhone] = useState(normalizeTutorPhoneInput(tutor.phone))
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({})
  const [isSaved, setIsSaved] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const passwordRequirements = useMemo(() => passwordRequirementStates(password), [password])

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = {
      phone: validateRussianPhone(phone),
      password: validateTutorPassword(password, { optional: true }),
    }
    setErrors(nextErrors)
    setIsSaved(false)
    if (nextErrors.phone || nextErrors.password) return
    setIsSaved(true)
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
        <label>Имя<input defaultValue={tutor.name} /></label>
        <label>Email<input defaultValue={tutor.email} type="email" /></label>
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
        {isSaved && <p className="success-message">Настройки сохранены в mock-состоянии.</p>}
        <button className="primary-button" type="submit">Сохранить настройки</button>
      </form>
    </section>
  )
}
