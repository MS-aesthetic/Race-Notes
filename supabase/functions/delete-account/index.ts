import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

type Membership = {
  team_id: string;
  role: 'owner' | 'member';
};

type StorageObject = {
  bucket_id: string;
  name: string;
};

function bannerMatchesObject(url: string | null, objectName: string): boolean {
  if (!url) return false;
  try {
    return decodeURIComponent(url).endsWith(`/${objectName}`);
  } catch {
    return url.endsWith(`/${objectName}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ ok: false, code: 'unauthorized' }, 401);
  }

  let body: { confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  if (body.confirmation !== 'DELETE') {
    return json({ ok: false, code: 'confirmation_required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: required Supabase secrets are missing');
    return json({ ok: false, code: 'server_misconfigured' }, 500);
  }

  const accessToken = authorization.slice('Bearer '.length);
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) {
    return json({ ok: false, code: 'unauthorized' }, 401);
  }

  const userId = callerData.user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Supabase Auth refuses to delete users who still own Storage objects.
    const { data: storageRows, error: storageLookupError } = await admin.rpc(
      'account_deletion_owned_storage_objects',
      { target_user: userId },
    );
    if (storageLookupError) throw new Error('storage_lookup_failed');
    const ownedObjects = (storageRows ?? []) as StorageObject[];

    // Remove stale banner links before deleting an owned team-banner object.
    const ownedBanners = ownedObjects.filter((row) => row.bucket_id === 'team_banners');
    if (ownedBanners.length) {
      const { data: teams, error: teamsError } = await admin.from('teams').select('id,banner_url');
      if (teamsError) throw new Error('team_banner_lookup_failed');
      for (const team of teams ?? []) {
        if (ownedBanners.some((object) => bannerMatchesObject(team.banner_url, object.name))) {
          const { error } = await admin.from('teams').update({ banner_url: null }).eq('id', team.id);
          if (error) throw new Error('team_banner_cleanup_failed');
        }
      }
    }

    const objectsByBucket = new Map<string, string[]>();
    for (const object of ownedObjects) {
      const paths = objectsByBucket.get(object.bucket_id) ?? [];
      paths.push(object.name);
      objectsByBucket.set(object.bucket_id, paths);
    }
    for (const [bucket, paths] of objectsByBucket) {
      for (let index = 0; index < paths.length; index += 1000) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 1000));
        if (error) throw new Error('storage_remove_failed');
      }
    }

    // Shared teams continue under another member. A one-person team is removed.
    const { data: membershipRows, error: membershipError } = await admin
      .from('team_members')
      .select('team_id,role')
      .eq('user_id', userId);
    if (membershipError) throw new Error('team_membership_lookup_failed');

    for (const membership of (membershipRows ?? []) as Membership[]) {
      const { data: remainingRows, error: remainingError } = await admin
        .from('team_members')
        .select('id,user_id,role,created_at')
        .eq('team_id', membership.team_id)
        .neq('user_id', userId)
        .order('created_at', { ascending: true });
      if (remainingError) throw new Error('team_successor_lookup_failed');
      const remaining = remainingRows ?? [];

      if (!remaining.length) {
        const { error } = await admin.from('teams').delete().eq('id', membership.team_id);
        if (error) throw new Error('empty_team_delete_failed');
      } else if (membership.role === 'owner' && !remaining.some((row) => row.role === 'owner')) {
        const { error } = await admin
          .from('team_members')
          .update({ role: 'owner' })
          .eq('id', remaining[0].id);
        if (error) throw new Error('team_owner_transfer_failed');
      }
    }

    const { error: cleanupError } = await admin.rpc('cleanup_account_references_for_deletion', {
      target_user: userId,
    });
    if (cleanupError) throw new Error('identity_cleanup_failed');

    // Revoke refresh sessions before deletion. If the final Auth deletion
    // fails, the client is told to discard only cached auth and sign in again;
    // racing data on the device stays intact so the idempotent flow can retry.
    const { error: signOutError } = await admin.auth.admin.signOut(accessToken, 'global');
    if (signOutError) throw new Error('session_revoke_failed');

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
    if (deleteError) {
      console.error('delete-account: Auth deletion failed after session revocation');
      return json({ ok: false, code: 'reauth_required' });
    }

    return json({ ok: true });
  } catch (error) {
    console.error('delete-account failed', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false, code: 'deletion_failed' }, 500);
  }
});
