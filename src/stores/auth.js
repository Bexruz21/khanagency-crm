import { defineStore } from 'pinia'
import axios from 'axios'
import api from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    error: '',
  }),
  getters: {
    isAuthed: () => !!localStorage.getItem('khan_access'),
    canManage: (s) => ['admin', 'pm'].includes(s.user?.role),
  },
  actions: {
    async login(username, password) {
      this.loading = true
      this.error = ''
      try {
        const { data } = await axios.post('/api/auth/token/', { username, password })
        localStorage.setItem('khan_access', data.access)
        localStorage.setItem('khan_refresh', data.refresh)
        await this.fetchMe()
        return true
      } catch (e) {
        this.error = e.response?.status === 401
          ? 'Неверный логин или пароль'
          : 'Сервер недоступен. Запущен ли backend?'
        return false
      } finally {
        this.loading = false
      }
    },
    async fetchMe() {
      const { data } = await api.get('/users/me/')
      this.user = data
    },
    logout() {
      localStorage.removeItem('khan_access')
      localStorage.removeItem('khan_refresh')
      this.user = null
      window.location.href = '/login'
    },
  },
})
