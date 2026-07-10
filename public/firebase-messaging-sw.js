/* Firebase Cloud Messaging service worker (WS-S).
 * Handles background/data push for the PWA. Runs at its OWN scope
 * (/firebase-cloud-messaging-push-scope) so it never collides with the
 * Workbox precache SW registered at '/'. Config is hardcoded because a
 * service worker cannot read Vite env vars. These are public web-app keys. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCcnX-G3PrSEN9SuGHIz8SZT9ghJFERjaw',
  authDomain: 'crew-chief-5fb7c.firebaseapp.com',
  projectId: 'crew-chief-5fb7c',
  storageBucket: 'crew-chief-5fb7c.firebasestorage.app',
  messagingSenderId: '293733704638',
  appId: '1:293733704638:web:b5d729bf41c6932c598fef',
});

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
