import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { signUp, signIn, signOut, signInWithGoogle, AppUser } from '../lib/supabase';
import TeamView from './TeamView';

interface AuthViewProps {
  user: User | null;
  profile: AppUser | null;
  onAuthChange: (user: User | null) => void;
}

type AuthMode = 'login' | 'register' | 'profile';

export default function AuthView({ user, profile, onAuthChange }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(user ? 'profile' : 'login');
  const [authMode, setAuthMode] = useState<'profile' | 'team'>('profile');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Reset when user changes externally
  React.useEffect(() => {
    setMode(user ? 'profile' : 'login');
    setError('');
    setSuccess('');
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      setSuccess('Logged in successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName.trim());
      setSuccess('Account created! Check your email to confirm.');
      setMode('login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // Web: the browser is about to navigate away to Google.
      // Native: the system browser opens; loading resets once we return.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      onAuthChange(null);
      setMode('login');
      setEmail('');
      setPassword('');
    } catch {
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  // ---- Profile / Logged-in view ----
  if (mode === 'profile' && user) {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-base text-on-surface uppercase tracking-tight">
              {profile?.displayName || 'Racer'}
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">{user.email}</p>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
            PRO
          </span>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30 gap-0.5">
          <button
            onClick={() => setAuthMode('profile')}
            className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
              authMode === 'profile'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-on-surface-variant/60 hover:text-on-surface-variant'
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setAuthMode('team')}
            className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
              authMode === 'team'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-on-surface-variant/60 hover:text-on-surface-variant'
            }`}
          >
            Team
          </button>
        </div>

        {/* Account Tab */}
        {authMode === 'profile' && (
          <div className="flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-outline-variant/30 rounded-lg p-3">
                <p className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">Account</p>
                <p className="text-sm font-bold text-on-surface font-mono">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div className="bg-surface border border-outline-variant/30 rounded-lg p-3">
                <p className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">Sync</p>
                <p className="text-sm font-bold text-green-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Active
                </p>
              </div>
            </div>

            {/* Cloud info */}
            <div className="bg-surface-container border border-outline-variant/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-lg">cloud_done</span>
                <span className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">
                  Cloud Storage Active
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                Your setups, session logs, and weekend data sync automatically
                across all your devices. Data stays available offline.
              </p>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red-900/20 border border-red-800/40 text-red-400 
                         font-mono text-xs uppercase tracking-wider rounded-md
                         hover:bg-red-900/30 transition-colors active:opacity-80
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        )}

        {/* Team Tab */}
        {authMode === 'team' && (
          <TeamView user={user} />
        )}
      </div>
    );
  }

  // ---- Login / Register form ----
  return (
    <div className="flex flex-col gap-5">
      {/* Mode toggle */}
      <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30">
        <button
          onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
          className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
            mode === 'login'
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-on-surface-variant/60 hover:text-on-surface-variant'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
          className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
            mode === 'register'
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-on-surface-variant/60 hover:text-on-surface-variant'
          }`}
        >
          Register
        </button>
      </div>

      {/* Form */}
      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-3">
        {mode === 'register' && (
          <div>
            <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1 tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your racing name"
              className="w-full bg-surface-container border border-outline-variant/50 rounded-md px-3 py-2.5
                         text-sm text-on-surface placeholder:text-on-surface-variant/40
                         focus:border-primary/50 focus:outline-none font-mono"
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1 tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="racer@example.com"
            required
            className="w-full bg-surface-container border border-outline-variant/50 rounded-md px-3 py-2.5
                       text-sm text-on-surface placeholder:text-on-surface-variant/40
                       focus:border-primary/50 focus:outline-none font-mono"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1 tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-surface-container border border-outline-variant/50 rounded-md px-3 py-2.5
                       text-sm text-on-surface placeholder:text-on-surface-variant/40
                       focus:border-primary/50 focus:outline-none font-mono"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="flex items-center gap-1.5 text-red-400 text-xs font-mono">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-green-400 text-xs font-mono">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-primary text-on-primary font-mono text-xs font-bold 
                     uppercase tracking-wider rounded-md
                     hover:brightness-110 transition-all active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {loading
            ? 'Please wait...'
            : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-outline-variant/30" />
        <span className="text-[10px] font-mono uppercase text-on-surface-variant/50 tracking-wider">or</span>
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>

      {/* Google sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-surface border border-outline-variant/50 text-on-surface
                   font-mono text-xs font-bold uppercase tracking-wider rounded-md
                   flex items-center justify-center gap-2
                   hover:bg-surface-container transition-colors active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.4 35.3 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.1-5.4 6.6l6.3 5.2C39.9 36.9 44 31.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
        </svg>
        {loading ? 'Please wait...' : 'Continue with Google'}
      </button>

      {/* Skip / offline notice */}
      <p className="text-[10px] text-on-surface-variant/50 text-center leading-relaxed font-mono">
        Your data stays on your device until you sign in.
        <br />
        Sign in to sync setups across all your devices.
      </p>
    </div>
  );
}
