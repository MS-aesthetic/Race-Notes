// ============================================================================
// Edge Function: send-push (plan-v2.md WS-S) — SCAFFOLD (Deno)
//
// deploy:  supabase functions deploy send-push
// secrets: supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{"project_id":...}'
//
// Flow:
//  1. Verify caller JWT (supabase-js with the request's Authorization header).
//  2. Resolve targets: toUserId, or all members of toTeamId (minus sender).
//  3. Authorize: caller must be in_same_team() with every target.
//  4. Insert `notifications` rows (in-app feed / Realtime).
//  5. Fetch targets' push_tokens (service role), send via FCM HTTP v1
//     (OAuth2 token from the service account), prune UNREGISTERED tokens.
// ============================================================================

// @ts-nocheck — Deno runtime types; excluded from the app's tsconfig.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const payload = await req.json();
    // WS-S TODO: target resolution, in_same_team authorization, notifications
    // insert, FCM v1 fan-out, dead-token pruning.
    void payload;

    return new Response(JSON.stringify({ ok: false, error: 'WS-S scaffold — not implemented' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
