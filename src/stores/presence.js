import { defineStore } from 'pinia'

export const usePresenceStore = defineStore('presence', {
  state: () => ({
    byUser: {},
  }),
  actions: {
    applySnapshot(users) {
      for (const user of users || []) {
        this.byUser[user.user_id] = user
      }
    },
    applyChange(user) {
      if (user?.user_id) this.byUser[user.user_id] = user
    },
    reset() {
      this.byUser = {}
    },
  },
})
