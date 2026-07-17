// прозрачный тон от яркого цвета — читается одинаково хорошо в светлой и тёмной теме
const tint = (c) => `color-mix(in srgb, ${c} 16%, transparent)`

export const TASK_STATUS = {
  todo: { label: 'К выполнению', color: 'var(--muted)', bg: tint('var(--muted)') },
  in_progress: { label: 'В работе', color: 'var(--sky)', bg: tint('var(--sky)') },
  review: { label: 'На проверке', color: 'var(--violet)', bg: tint('var(--violet)') },
  done: { label: 'Выполнено', color: 'var(--green)', bg: tint('var(--green)') },
  cancelled: { label: 'Отменено', color: 'var(--muted)', bg: tint('var(--muted)') },
}

export const PRIORITY = {
  low: { label: 'Низкий', color: 'var(--muted)', bg: tint('var(--muted)') },
  medium: { label: 'Средний', color: 'var(--sky)', bg: tint('var(--sky)') },
  high: { label: 'Высокий', color: 'var(--amber)', bg: tint('var(--amber)') },
  urgent: { label: 'Срочно', color: 'var(--red)', bg: tint('var(--red)') },
}

export const CONTENT_STATUS = {
  idea: { label: 'Идея', color: 'var(--muted)', bg: tint('var(--muted)') },
  approved: { label: 'Утверждено', color: 'var(--accent)', bg: tint('var(--accent)') },
  shooting: { label: 'Съёмка', color: 'var(--amber)', bg: tint('var(--amber)') },
  editing: { label: 'Монтаж', color: 'var(--sky)', bg: tint('var(--sky)') },
  review: { label: 'На проверке', color: 'var(--violet)', bg: tint('var(--violet)') },
  ready: { label: 'Готово', color: 'var(--green)', bg: tint('var(--green)') },
  published: { label: 'Опубликовано', color: 'var(--green)', bg: tint('var(--green)') },
}

export const CONTENT_FORMAT = {
  reels: 'Reels', post: 'Post', stories: 'Stories',
}

export const BRAND_STATUS = {
  lead: { label: 'Переговоры', color: 'var(--amber)', bg: tint('var(--amber)') },
  active: { label: 'В работе', color: 'var(--green)', bg: tint('var(--green)') },
  paused: { label: 'На паузе', color: 'var(--muted)', bg: tint('var(--muted)') },
  done: { label: 'Завершён', color: 'var(--accent)', bg: tint('var(--accent)') },
}

export const EXPENSE_CATEGORY = {
  content: 'Производство контента',
  shooting: 'Съёмка',
  editing: 'Монтаж',
  design: 'Дизайн',
  advertising: 'Реклама',
  bloggers: 'Блогеры',
  studio: 'Аренда студии',
  transport: 'Транспорт',
  props: 'Реквизит',
  contractors: 'Подрядчики',
  other: 'Другое',
}

export const EXPENSE_STATUS = {
  submitted: { label: 'На согласовании', color: 'var(--amber)', bg: tint('var(--amber)') },
  approved: { label: 'Одобрен', color: 'var(--sky)', bg: tint('var(--sky)') },
  rejected: { label: 'Отклонён', color: 'var(--red)', bg: tint('var(--red)') },
}

export const ROLE = {
  admin: 'Администратор', pm: 'Project Manager', employee: 'Сотрудник',
}

export function fmtDate(value, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  const opts = { day: '2-digit', month: 'short' }
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('ru-RU', opts).replace(',', ' ·')
}

export function compactDateTime(value) {
  if (!value) return ''
  if (/^\d{1,2}\.\d{1,2}(?:\s+\d{1,2}:\d{2})?$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const two = (number) => String(number).padStart(2, '0')
  return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`
}

export function maskCompactDateTime(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  let result = digits.slice(0, 2)
  if (digits.length > 2) result += `.${digits.slice(2, 4)}`
  if (digits.length > 4) result += ` ${digits.slice(4, 6)}`
  if (digits.length > 6) result += `:${digits.slice(6, 8)}`
  return result
}

export function allowCompactDateKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key) || /^\d$/.test(event.key)) return
  event.preventDefault()
}

export function allowPositiveIntegerKey(event) {
  if (event.ctrlKey || event.metaKey) return
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key) || /^\d$/.test(event.key)) return
  event.preventDefault()
}

export function positiveInteger(value, max = 120) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 3)
  if (!digits) return ''
  return String(Math.min(Number(digits), max))
}

export function fmtMoney(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('ru-RU') + ' сум'
}

export function formatSum(value) {
  if (value == null || value === '') return '—'
  const digits = String(Math.trunc(Number(value) || 0))
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} сум`
}

export function maskSum(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15)
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}

export function parseSum(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 15)
  return digits ? Number(digits) : 0
}

export function allowSumKey(event) {
  if (event.ctrlKey || event.metaKey) return
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key) || /^\d$/.test(event.key)) return
  event.preventDefault()
}
