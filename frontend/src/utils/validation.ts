export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '')
}

export function normalizeTutorPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '')
  const withoutCountryPrefix = digits.startsWith('7') ? digits.slice(1) : digits
  return `+7${withoutCountryPrefix.slice(0, 10)}`
}

export function validateRussianPhone(value: string) {
  const normalized = normalizePhone(value)
  if (!normalized.startsWith('+7')) {
    return 'Телефон должен начинаться с +7.'
  }

  const digitsAfterPrefix = normalized.slice(2).replace(/\D/g, '')
  const allDigits = normalized.replace(/\D/g, '')
  if (allDigits.length > 11) {
    return 'В номере должно быть не больше 11 цифр, включая 7.'
  }

  if (digitsAfterPrefix.length !== 10) {
    return 'После +7 должно быть ровно 10 цифр.'
  }

  return ''
}

export function passwordRequirementStates(value: string) {
  return [
    {
      id: 'length',
      label: 'Не менее 10 символов',
      isMet: value.length >= 10,
    },
    {
      id: 'uppercase',
      label: 'Есть заглавная буква',
      isMet: /[A-ZА-ЯЁ]/.test(value),
    },
    {
      id: 'digit',
      label: 'Есть цифра',
      isMet: /\d/.test(value),
    },
  ]
}

export function validateTutorPassword(value: string, options: { optional?: boolean } = {}) {
  if (options.optional && value.length === 0) return ''
  if (value.length < 10) return 'Пароль должен содержать не менее 10 символов.'
  if (!/[A-ZА-ЯЁ]/.test(value)) return 'Добавьте хотя бы одну заглавную букву.'
  if (!/\d/.test(value)) return 'Добавьте хотя бы одну цифру.'
  return ''
}

export const allowedRussianEmailDomains = [
  'yandex.ru',
  'ya.ru',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'internet.ru',
] as const

export function getEmailDomain(value: string) {
  const email = value.trim().toLowerCase()
  const [, domain = ''] = email.split('@')
  return domain
}

export function validateTutorEmailDomain(value: string) {
  const email = value.trim()
  if (!email) return 'Введите email.'

  const domain = getEmailDomain(email)
  if (!domain || !email.includes('@')) {
    return 'Введите корректный email.'
  }

  if (!allowedRussianEmailDomains.includes(domain as (typeof allowedRussianEmailDomains)[number])) {
    return 'Для регистрации и входа используйте российскую почту: Яндекс или Mail.ru.'
  }

  return ''
}

export function validateHomeworkDeadline(lessonDate: string, deadline?: string) {
  if (!lessonDate || !deadline) return ''
  if (deadline < lessonDate) {
    return 'Дедлайн Д/З не может быть раньше даты урока.'
  }
  return ''
}
