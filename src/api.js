import axios from 'axios'

function normalizeApiBase(value) {
  if (!value) return '/api'
  const base = value.trim().replace(/\/+$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

// Vercel: задайте VITE_API_BASE_URL=https://<ваш-ngrok>.ngrok-free.app.
export const API_BASE_URL = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL,
)

export function clearAuthSession(redirect = true) {
  localStorage.removeItem('khan_access')
  localStorage.removeItem('khan_refresh')
  if (redirect && window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

function prepareRequest(config) {
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
}

export const publicApi = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })
publicApi.interceptors.request.use(prepareRequest)

const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })

api.interceptors.request.use((config) => {
  prepareRequest(config)
  const token = localStorage.getItem('khan_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = publicApi.post('/auth/refresh/', {
      refresh: localStorage.getItem('khan_refresh'),
    }).then(({ data }) => {
      localStorage.setItem('khan_access', data.access)
      return data.access
    }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {}
    const unauthorized = error.response?.status === 401
    const canRefresh = unauthorized && !original._retry && localStorage.getItem('khan_refresh')

    if (canRefresh) {
      original._retry = true
      try {
        const access = await refreshAccessToken()
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch {
        clearAuthSession()
        return Promise.reject(error)
      }
    }

    const timedOut = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      || /timeout/i.test(error.message || '')
    const networkUnavailable = !error.response && !timedOut && !axios.isCancel(error)

    // Таймаут отдельного долгого запроса не означает, что сессия недействительна.
    // Выходим только при настоящем 401 или когда соединение с backend оборвалось.
    if (unauthorized || networkUnavailable) clearAuthSession()
    return Promise.reject(error)
  },
)

export default api

/** Скачивание файла с авторизацией; blob работает стабильнее прямой media-ссылки в Safari. */
export async function downloadFile(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export async function downloadPdf(url, filename) {
  return downloadFile(url, filename)
}
