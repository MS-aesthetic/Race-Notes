// ============================================================================
// Push notification client (plan-v2.md WS-S) — SCAFFOLD
//
// Native (APK): @capacitor/push-notifications → FCM token.
// Web (PWA):   Firebase JS SDK messaging + VAPID key + firebase-messaging-sw.js
//              (coexists with the Workbox SW — spike this FIRST in WS-S).
// Tokens upsert into `push_tokens`; the `send-push` Edge Function fans out.
// Human setup required before WS-S: Firebase project, google-services.json,
// VAPID key, `supabase secrets set FCM_SERVICE_ACCOUNT_JSON=...`.
// ============================================================================

import { supabase } from './supabase';
import { AppNotificationType } from '../types';

/** Register this device for push and store the token. WS-S TODO:
 *  - Android 13+ runtime POST_NOTIFICATIONS permission
 *  - token refresh listener
 *  - Capacitor vs web branch */
export async function registerForPush(_userId: string): Promise<boolean> {
  console.warn('WS-S: registerForPush not implemented (scaffold)');
  return false;
}

/** Remove this device's token (call on sign-out). */
export async function unregisterPush(_userId: string): Promise<void> {
  console.warn('WS-S: unregisterPush not implemented (scaffold)');
}

/** Send a ping / come-here notification via the send-push Edge Function. */
export async function sendPush(opts: {
  toUserId?: string;
  toTeamId?: string;
  type: AppNotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push', { body: opts });
    if (error) { console.warn('sendPush error:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('sendPush failed', e);
    return false;
  }
}
