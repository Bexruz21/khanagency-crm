import { defineStore } from 'pinia'

let nextId = 1

export const useToastStore = defineStore('toasts', {
  state: () => ({
    items: [], // {id, text, kind, link}
  }),
  actions: {
    push(text, kind = 'info', link = '') {
      const id = nextId++
      this.items.push({ id, text, kind, link })
      // просроченные висят дольше — их нужно заметить
      const ttl = kind === 'danger' ? 15000 : 8000
      setTimeout(() => this.remove(id), ttl)
      // не копим больше 5 на экране
      if (this.items.length > 5) this.items.shift()
    },
    remove(id) {
      const i = this.items.findIndex((t) => t.id === id)
      if (i !== -1) this.items.splice(i, 1)
    },
  },
})
