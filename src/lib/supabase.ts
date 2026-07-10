import { createClient, User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Team, TeamProfile } from '../types';

// ---------------------------------------------------------------------------
// Supabase client singleton – reads keys from Vite env vars (VITE_ prefix)
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE + detectSessionInUrl let the web build finish the Google OAuth
    // round-trip automatically when Supabase redirects back with ?code=...
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// Custom URL scheme (registered in AndroidManifest.xml) used to bounce back
// into the native Android app after the system browser finishes Google sign-in.
export const NATIVE_AUTH_CALLBACK_URL = 'nimbus.engineering.crewchief://auth-callback';

// ---------------------------------------------------------------------------
// Local "has this device ever registered/signed in" flag.
//
// Crew Chief is local-first and must keep working at the track with no
// signal. Supabase sessions carry a JWT that expires (~1hr) and normally
// tries to refresh over the network; if that refresh fails while offline we
// don't want to boot the user back to the sign-in screen. This flag is our
// own durable record, separate from Supabase's live session, that this
// device has completed registration/login at least once. It's only cleared
// on an explicit sign-out.
// ---------------------------------------------------------------------------
export const REGISTERED_USER_KEY = 'race_notes_registered_user';

export function rememberLocalAccount(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(
      REGISTERED_USER_KEY,
      JSON.stringify({ id: user.id, email: user.email })
    );
  } else {
    window.localStorage.removeItem(REGISTERED_USER_KEY);
  }
}

export function hasLocalAccount(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem(REGISTERED_USER_KEY);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppUser {
  id: string;
  email: string | undefined;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  role?: 'owner' | 'member';
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Sign up with email + password + display name */
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up failed – no user returned');

  // Create a profile row
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    display_name: displayName,
    created_at: new Date().toISOString(),
  });
  if (profileError) console.warn('Profile creation warning:', profileError.message);

  return data;
}

/** Sign in with email + password */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign in / register with Google.
 * - Web: redirects the whole page to Google, then back to the app.
 * - Native (Android/Capacitor): opens the system browser via @capacitor/browser
 *   and skips the in-app redirect; the round trip is completed by
 *   `handleNativeAuthCallback` when the app catches the custom-scheme deep link.
 */
export async function signInWithGoogle() {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative ? NATIVE_AUTH_CALLBACK_URL : window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: isNative,
    },
  });
  if (error) throw error;

  if (isNative && data?.url) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: data.url });
  }
}

/**
 * Finish the native Google OAuth round trip. Call this from the
 * `App` plugin's `appUrlOpen` listener with the deep-link URL it hands back.
 * No-op if the URL isn't our auth callback scheme.
 */
export async function handleNativeAuthCallback(url: string): Promise<boolean> {
  if (!url.startsWith(NATIVE_AUTH_CALLBACK_URL)) return false;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) throw error;
    return true;
  } finally {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {});
  }
}

/** Sign out. This is the only thing that clears the local "registered on
 * this device" flag – losing network access should never sign someone out. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  rememberLocalAccount(null);
}

/** Get the current session (returns null if not logged in) */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get the current user (returns null if not logged in) */
export function getCurrentUser(): User | null {
  return supabase.auth.getUser() ? null : null; // will be used via onAuthStateChange
}

/** Listen for auth state changes (login, logout, token refresh) */
export function onAuthChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

/** Fetch a user profile by ID */
export async function fetchProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  };
}

/** Search profiles by display name or email (for sharing) */
export async function searchProfiles(query: string): Promise<AppUser[]> {
  if (!query || query.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);
  if (error || !data) return [];
  return data.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    email: p.email as string,
    displayName: p.display_name as string | null,
    avatarUrl: p.avatar_url as string | null,
    createdAt: p.created_at as string,
  }));
}

export async function shareSetup(setupId: string, sharedBy: string, sharedWithEmail: string) {
  // First, find the user by email
  const profiles = await searchProfiles(sharedWithEmail);
  const targetProfile = profiles.find(p => p.email?.toLowerCase() === sharedWithEmail.toLowerCase());

  if (!targetProfile) {
    throw new Error('User with this email not found.');
  }

  const { error } = await supabase.from('shared_setups').insert({
    setup_id: setupId,
    shared_by: sharedBy,
    shared_with: targetProfile.id,
    permission: 'view'
  });

  if (error) throw error;
}

export async function shareWeekend(weekendId: string, sharedBy: string, sharedWithEmail: string) {
  // First, find the user by email
  const profiles = await searchProfiles(sharedWithEmail);
  const targetProfile = profiles.find(p => p.email?.toLowerCase() === sharedWithEmail.toLowerCase());

  if (!targetProfile) {
    throw new Error('User with this email not found.');
  }

  const { error } = await supabase.from('shared_weekends').insert({
    weekend_id: weekendId,
    shared_by: sharedBy,
    shared_with: targetProfile.id,
    permission: 'view'
  });

  if (error) throw error;
}

export async function createTeam(teamName: string, userId: string): Promise<Team> {
  const teamId = crypto.randomUUID();
  const { error: teamError } = await supabase
    .from('teams')
    .insert({ id: teamId, name: teamName });

  if (teamError) throw new Error(`Team insert failed: ${teamError.message}`);

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: userId,
      role: 'owner',
    });

  if (memberError) {
    await supabase.from('teams').delete().eq('id', teamId);
    throw new Error(`Member assignment failed: ${memberError.message}`);
  }

  return {
    id: teamId,
    name: teamName,
    created_at: new Date().toISOString()
  };
}

export async function leaveTeam(teamId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('team_members').delete().match({ team_id: teamId, user_id: userId });
  return !error;
}

export async function deleteTeam(teamId: string): Promise<boolean> {
  // Deleting the team cascades to team_members via ON DELETE CASCADE
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) {
    console.warn('deleteTeam error:', error.message);
    return false;
  }
  return true;
}

export async function removeTeamMember(teamId: string, memberUserId: string): Promise<boolean> {
  const { error } = await supabase.from('team_members').delete().match({ team_id: teamId, user_id: memberUserId });
  return !error;
}

export async function getUserTeamRole(teamId: string, userId: string): Promise<'owner' | 'member' | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .match({ team_id: teamId, user_id: userId })
    .maybeSingle();
  if (error || !data) return null;
  return data.role as 'owner' | 'member';
}

export async function uploadTeamBanner(teamId: string, file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${teamId}-${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage.from('team_banners').upload(filePath, file);
  if (uploadError) return null;

  const { data } = supabase.storage.from('team_banners').getPublicUrl(filePath);
  if (!data?.publicUrl) return null;

  await supabase.from('teams').update({ banner_url: data.publicUrl }).eq('id', teamId);
  return data.publicUrl;
}

export async function getUserTeam(userId: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, teams(*)')
    .eq('user_id', userId);
    
  if (error) {
    console.warn('getUserTeam error:', error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const raw = Array.isArray(data[0].teams) ? data[0].teams[0] : data[0].teams;
  if (!raw) return null;
  const t = raw as Record<string, unknown>;
  return {
    id: t.id as string,
    name: t.name as string,
    banner_url: t.banner_url as string | undefined,
    created_at: t.created_at as string,
    profile: (t.profile_data as TeamProfile) || undefined,
  };
}

export async function getTeamMembers(teamId: string): Promise<AppUser[]> {
  const { data } = await supabase.from('team_members').select('user_id, role').eq('team_id', teamId);
  if (!data) return [];
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', data.map(m => m.user_id));
  return (profiles || []).map((p: any) => {
    const membership = data.find(m => m.user_id === p.id);
    return {
      id: p.id, email: p.email, displayName: p.display_name, avatarUrl: p.avatar_url, createdAt: p.created_at,
      role: membership?.role as ('owner' | 'member' | undefined)
    };
  });
}

export async function updateTeamProfile(teamId: string, profile: TeamProfile): Promise<boolean> {
  const { error } = await supabase
    .from('teams')
    .update({ profile_data: profile })
    .eq('id', teamId);
  if (error) { console.warn('updateTeamProfile error:', error.message); return false; }
  return true;
}

export async function addTeamMember(teamId: string, memberEmail: string): Promise<boolean> {
  const profiles = await searchProfiles(memberEmail);
  const target = profiles.find(p => p.email?.toLowerCase() === memberEmail.toLowerCase());
  if (!target) return false;

  const { error } = await supabase.from('team_members').insert({
    team_id: teamId, user_id: target.id, role: 'member'
  });
  return !error;
}
