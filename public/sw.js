self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || '쿠키앤모어 재고현황'
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
