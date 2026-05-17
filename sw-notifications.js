self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: '📰 Novo artigo publicado',
      body: event.data ? event.data.text() : 'Já saiu um novo artigo no VICIADO COMENTA.'
    };
  }

  const title = String(payload.title || '📰 Novo artigo publicado');
  const body = String(payload.body || 'Já saiu um novo artigo no VICIADO COMENTA.');
  const url = String(payload.url || '/');

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/assets/favicon.svg',
      badge: payload.badge || '/assets/favicon.svg',
      tag: payload.articleKey || url,
      data: {
        url
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }

        return null;
      })
  );
});
