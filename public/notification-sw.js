self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.link || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const current = clients.find((client) => new URL(client.url).origin === self.location.origin)
      if (current) {
        if ('navigate' in current) await current.navigate(target)
        return current.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
