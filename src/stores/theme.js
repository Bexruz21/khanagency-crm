import { defineStore } from 'pinia'

const KEY = 'khan_theme'

function apply(theme) {
  // 'system' — следуем за настройкой ОС
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: localStorage.getItem(KEY) || 'light', // 'light' | 'dark' | 'system'
  }),
  actions: {
    init() {
      apply(this.theme)
      // если выбран режим «как в системе» — реагируем на смену темы ОС
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'system') apply('system')
      })
    },
    set(theme) {
      this.theme = theme
      localStorage.setItem(KEY, theme)
      apply(theme)
    },
  },
})
