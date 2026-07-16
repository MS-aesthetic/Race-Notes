/**
 * Push registration — WS-S. Client half of the push pipe.
 *
 * Native (Android) uses @capacitor/push-notifications (FCM under the hood via
 * google-services.json). Web/PWA uses Firebase JS messaging + a VAPID key and
 * the dedicated firebase-messaging-sw.js service worker.
 *
 * Tokens are stored in the `push_tokens` table (owner-only RLS). This is LIVE
 * data, not part of the local-first sync loop, so it does NOT go through
 * sync.ts. Notification DELIVERY/fan-out happens server-side in the
 * `send-push` Edge Function.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'race_notes_device_id';

export interface PushNotificationInput {
  title: string;
  body: string;
  /** FCM v1 notification data values must be strings. */
  data?: Record<string, string>;
}

function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'server';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function upsertToken(userId: string, token: string, platform: 'android' | 'web'): Promise<void> {
  const { error } = await supabase.from('push_tokens').upsert(
    {
      token,
      user_id: userId,
      platform,
      device_id: getDeviceId(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) console.warn('[push] token upsert failed:', error.message);
}

// ---------------------------------------------------------------------------
// Native (Capacitor / Android)
// ---------------------------------------------------------------------------

let nativeListenersBound = false;

async function registerNative(userId: string): Promise<void> {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return; // user declined — silent no-op

  if (!nativeListenersBound) {
    nativeListenersBound = true;
    await PushNotifications.addListener('registration', (t) => {
      void upsertToken(userId, t.value, 'android');
    });
    await PushNotifications.addListener('registrationError', (e) => {
      console.warn('[push] native registration error:', JSON.stringify(e));
    });
  }
  await PushNotifications.register();
}

// ---------------------------------------------------------------------------
// Web (Firebase JS messaging + PWA service worker)
// ---------------------------------------------------------------------------

async function registerWeb(userId: string): Promise<void> {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  const configRaw = env.VITE_FIREBASE_CONFIG_JSON;
  const vapidKey = env.VITE_FIREBASE_VAPID_KEY;
  if (!configRaw || !vapidKey) return; // not configured — no-op
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return; // unsupported environment — no-op
  }

  const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
  if (!(await isSupported())) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return; // declined — no-op

  const { initializeApp, getApps } = await import('firebase/app');
  const config = JSON.parse(configRaw) as Record<string, string>;
  const app = getApps().length ? getApps()[0] : initializeApp(config);

  // Register at FCM's own scope so it never clobbers the Workbox root SW ('/').
  // Pass the Firebase web config in the URL so no keys are hardcoded in the SW
  // source file (the browser persists this registration URL for later wakeups).
  const swUrl = `/firebase-messaging-sw.js?config=${encodeURIComponent(configRaw)}`;
  const swReg = await navigator.serviceWorker.register(swUrl, {
    scope: '/firebase-cloud-messaging-push-scope',
  });
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: swReg });
  if (token) await upsertToken(userId, token, 'web');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Send a team-targeted notification without ever blocking a local save. */
export async function sendPush(
  target: { toUserId: string } | { toTeamId: string },
  notification: PushNotificationInput,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: { ...target, notification },
    });
    if (error) console.warn('[push] send-push failed:', error.message);
  } catch (error) {
    console.warn('[push] send-push failed (non-fatal):', (error as Error).message);
  }
}

/** Register this device for push and store its token. Safe to call repeatedly;
 *  all failure paths (unsupported, denied, offline) resolve as silent no-ops. */
export async function registerForPush(userId: string): Promise<void> {
  if (!userId) return;
  try {
    if (Capacitor.isNativePlatform()) await registerNative(userId);
    else await registerWeb(userId);
  } catch (e) {
    console.warn('[push] registerForPush failed (non-fatal):', (e as Error).message);
  }
}

/** Remove this device's token. MUST run while the session is still valid
 *  (owner-only RLS), i.e. before supabase.auth.signOut() destroys it. */
export async function unregisterPush(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) {
      await supabase.from('push_tokens').delete().eq('user_id', userId).eq('device_id', getDeviceId());
    }
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();
      nativeListenersBound = false;
    }
  } catch (e) {
    console.warn('[push] unregisterPush failed (non-fatal):', (e as Error).message);
  }
}
