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

export function fmtMoney(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('ru-RU') + ' сум'
}
