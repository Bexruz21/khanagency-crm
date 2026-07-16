import { defineStore } from 'pinia'
import api, { clearAuthSession, publicApi } from '../api'

let sessionPromise = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: localStorage.getItem('khan_access'),
    loading: false,
    initialized: false,
    error: '',
  }),
  getters: {
    isAuthed: (state) => !!state.accessToken,
    canManage: (s) => ['admin', 'pm'].includes(s.user?.role),
  },
  actions: {
    async login(username, password) {
      this.loading = true
      this.error = ''
      try {
        const { data } = await publicApi.post('/auth/token/', { username, password })
        localStorage.setItem('khan_access', data.access)
        localStorage.setItem('khan_refresh', data.refresh)
        this.accessToken = data.access
        await this.fetchMe()
        return true
      } catch (e) {
        this.error = e.response?.status === 401
          ? 'Неверный логин или пароль'
          : 'Сервер недоступен. Запущен ли backend?'
        return false
      } finally {
        this.loading = false
        this.initialized = true
      }
    },
    async fetchMe() {
      const { data } = await api.get('/users/me/')
      this.user = data
      this.initialized = true
    },
    async ensureSession() {
      if (this.user) {
        this.initialized = true
        return this.user
      }
      if (!localStorage.getItem('khan_access')) {
        this.initialized = true
        throw new Error('No access token')
      }
      if (!sessionPromise) {
        sessionPromise = this.fetchMe().finally(() => {
          sessionPromise = null
        })
      }
      return sessionPromise
    },
    logout() {
      this.user = null
      this.accessToken = null
      this.initialized = true
      clearAuthSession()
    },
  },
})
