/* Firebase Cloud Messaging service worker (WS-S).
 * Handles background/data push for the PWA. Runs at its OWN scope
 * (/firebase-cloud-messaging-push-scope) so it never collides with the
 * Workbox precache SW registered at '/'.
 *
 * NOTE: no keys are hardcoded here. The Firebase web config is passed in at
 * registration time via the `?config=` query param (see registerWeb() in
 * src/lib/push.ts), which reads it from VITE_FIREBASE_CONFIG_JSON (.env.local).
 * The browser persists the registration URL, so the config is available when
 * the SW is later woken to handle a background push. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

try {
  const cfg = new URL(self.location).searchParams.get('config');
  if (cfg) {
    firebase.initializeApp(JSON.parse(cfg));
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'CREW CHIEF';
      const body = (payload.notification && payload.notification.body) || '';
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {},
      });
    });
  }
} catch (e) {
  // Missing/invalid config — SW still installs; background push just won't init.
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
