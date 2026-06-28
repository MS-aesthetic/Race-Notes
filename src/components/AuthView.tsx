import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { signUp, signIn, signOut, AppUser } from '../lib/supabase';
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
              className="w-full bg-[#0e0e0e] border border-outline-variant/50 rounded-md px-3 py-2.5
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
            className="w-full bg-[#0e0e0e] border border-outline-variant/50 rounded-md px-3 py-2.5
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
            className="w-full bg-[#0e0e0e] border border-outline-variant/50 rounded-md px-3 py-2.5
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
          className="w-full py-2.5 px-4 bg-primary text-[#0e0e0e] font-mono text-xs font-bold 
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

      {/* Skip / offline notice */}
      <p className="text-[10px] text-on-surface-variant/50 text-center leading-relaxed font-mono">
        Your data stays on your device until you sign in.
        <br />
        Sign in to sync setups across all your devices.
      </p>
    </div>
  );
}
