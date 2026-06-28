import React, { useState } from 'react';
import AuthView from './AuthView';
import ExportView from './ExportView';
import { User } from '@supabase/supabase-js';
import { AppUser } from '../lib/supabase';
import { Setup, ActiveSession } from '../types';

interface SettingsViewProps {
  user: User | null;
  profile: AppUser | null;
  onAuthChange: (user: User | null) => void;
  setup: Setup;
  activeSession: ActiveSession;
}

export default function SettingsView({ user, profile, onAuthChange, setup, activeSession }: SettingsViewProps) {
  const [subTab, setSubTab] = useState<'account' | 'export'>('account');

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30 text-xs font-mono uppercase tracking-wider">
        <button 
          onClick={() => setSubTab('account')}
          className={`flex-1 py-2 rounded-md transition-all ${subTab === 'account' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Account & Team
        </button>
        <button 
          onClick={() => setSubTab('export')}
          className={`flex-1 py-2 rounded-md transition-all ${subTab === 'export' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Export Data
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subTab === 'account' && <AuthView user={user} profile={profile} onAuthChange={onAuthChange} />}
        {subTab === 'export' && <ExportView setup={setup} activeSession={activeSession} />}
      </div>
    </div>
  );
}
