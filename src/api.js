import axios from 'axios'

// const api = axios.create({ baseURL: '/api' })
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('khan_access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry && localStorage.getItem('khan_refresh')) {
      original._retry = true
      try {
        const { data } = await axios.post('/api/auth/refresh/', {
          refresh: localStorage.getItem('khan_refresh'),
        })
        localStorage.setItem('khan_access', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.removeItem('khan_access')
        localStorage.removeItem('khan_refresh')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
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
