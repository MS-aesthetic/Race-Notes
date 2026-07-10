// send-push — WS-S. Server half of the push pipe.
// Auth'd invoke: verifies the caller shares a team with the target, inserts
// notification rows, and fans out FCM HTTP v1 sends to the target's device
// tokens, pruning dead tokens. FCM auth uses the FCM_SERVICE_ACCOUNT_JSON
// secret (Google JWT-bearer grant, signed via Web Crypto — no heavy SDK).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationInput {
  title: string;
  body: string;
  data?: Record<string, string>;
}
interface Payload {
  toUserId?: string;
  toTeamId?: string;
  notification: NotificationInput;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// --- Google service-account access token (scope: firebase.messaging) ---------
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Caller identity (RLS-scoped client using the caller's JWT).
  const asCaller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const callerId = userData.user.id;

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request', detail: 'invalid JSON' }, 400);
  }
  const hasUser = !!payload.toUserId;
  const hasTeam = !!payload.toTeamId;
  if (hasUser === hasTeam) return json({ error: 'bad_request', detail: 'exactly one of toUserId/toTeamId required' }, 400);
  if (!payload.notification?.title || !payload.notification?.body) {
    return json({ error: 'bad_request', detail: 'notification.title and .body required' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Resolve target recipients.
  let targetUserIds: string[] = [];
  if (hasUser) {
    const { data: shared } = await admin.rpc('in_same_team', { user_a: callerId, user_b: payload.toUserId });
    if (!shared) return json({ error: 'forbidden' }, 403);
    targetUserIds = [payload.toUserId!];
  } else {
    const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', payload.toTeamId);
    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
    const { data: callerRow } = await admin
      .from('team_members')
      .select('user_id')
      .eq('team_id', payload.toTeamId)
      .eq('user_id', callerId)
      .maybeSingle();
    if (!callerRow) return json({ error: 'forbidden' }, 403);
    targetUserIds = ids.filter((id: string) => id !== callerId);
  }

  const fromName = (userData.user.user_metadata?.full_name as string) || '';

  // Insert in-app notification rows.
  const notifRows = targetUserIds.map((toUser) => ({
    id: `notif-${crypto.randomUUID()}`,
    to_user: toUser,
    from_user: callerId,
    from_user_name: fromName,
    team_id: payload.toTeamId ?? null,
    type: (payload.notification.data?.type as string) || 'ping',
    title: payload.notification.title,
    body: payload.notification.body,
    data: payload.notification.data ?? {},
  }));
  if (notifRows.length) await admin.from('notifications').insert(notifRows);

  // Gather device tokens for all targets.
  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('token')
    .in('user_id', targetUserIds.length ? targetUserIds : ['__none__']);
  const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);

  let sent = 0;
  let failed = 0;
  const pruned: string[] = [];

  if (tokens.length) {
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    if (!saRaw) return json({ error: 'server_misconfigured', detail: 'FCM_SERVICE_ACCOUNT_JSON not set' }, 500);
    const sa = JSON.parse(saRaw);
    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    for (const token of tokens) {
      const message = {
        message: {
          token,
          notification: { title: payload.notification.title, body: payload.notification.body },
          data: payload.notification.data ?? {},
        },
      };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (r.ok) {
        sent++;
      } else {
        failed++;
        const errBody = await r.json().catch(() => ({}));
        const status = errBody?.error?.status;
        if (r.status === 404 || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
          await admin.from('push_tokens').delete().eq('token', token);
          pruned.push(token);
        }
      }
    }
  }

  return json({ ok: true, targets: targetUserIds.length, sent, failed, pruned: pruned.length });
});
