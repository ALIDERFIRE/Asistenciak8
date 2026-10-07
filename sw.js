/* Service worker de AsistenciaK8: sólo notificaciones push.
   No guarda páginas en caché, así la app siempre carga la última versión. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  const llamado = d.tipo === 'llamado';
  e.waitUntil(self.registration.showNotification(d.titulo || 'Asistencia K8', {
    body: d.cuerpo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: (d.tipo || 'aviso') + '-' + (d.grupo || ''),
    renotify: true,
    requireInteraction: llamado,
    vibrate: llamado ? [700, 250, 700, 250, 700, 250, 1200] : [150, 80, 150],
    data: { url: '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const c of lista) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
