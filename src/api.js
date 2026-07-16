import axios from 'axios'

function normalizeApiBase(value) {
  if (!value) return '/api'
  const base = value.trim().replace(/\/+$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

// Vercel: задайте VITE_API_BASE_URL=https://<ваш-ngrok>.ngrok-free.app.
// Без переменной используется same-origin /api (например, через vercel.json rewrite).
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

    // Нет ответа — backend/ngrok недоступен. 401 без refresh — сессия недействительна.
    if ((unauthorized || !error.response) && !axios.isCancel(error)) clearAuthSession()
    return Promise.reject(error)
  },
)

export default api

/** Скачивание PDF с авторизацией */
export async function downloadPdf(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(data)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
