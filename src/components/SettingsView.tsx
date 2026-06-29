import React, { useState } from 'react';
import AuthView from './AuthView';
import ExportView from './ExportView';
import { User } from '@supabase/supabase-js';
import { AppUser } from '../lib/supabase';
import { Setup, ActiveSession, AppTheme } from '../types';

interface SettingsViewProps {
  user: User | null;
  profile: AppUser | null;
  onAuthChange: (user: User | null) => void;
  setup: Setup;
  activeSession: ActiveSession;
  theme: AppTheme;
  onThemeChange: (t: AppTheme) => void;
}

const ACCENT_PRESETS = [
  { label: 'Race Red',    hex: '#ffb3ac' },
  { label: 'Cobalt Blue', hex: '#82b4ff' },
  { label: 'Lap Green',   hex: '#88d982' },
  { label: 'Amber Gold',  hex: '#ffbf81' },
  { label: 'Purple',      hex: '#d4a0ff' },
  { label: 'Cyan',        hex: '#7de8e8' },
];

export default function SettingsView({ user, profile, onAuthChange, setup, activeSession, theme, onThemeChange }: SettingsViewProps) {
  const [subTab, setSubTab] = useState<'account' | 'appearance' | 'export'>('account');

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sub-tab bar */}
      <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30 text-xs font-mono uppercase tracking-wider">
        <button
          onClick={() => setSubTab('account')}
          className={`flex-1 py-2 rounded-md transition-all ${subTab === 'account' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Account
        </button>
        <button
          onClick={() => setSubTab('appearance')}
          className={`flex-1 py-2 rounded-md transition-all ${subTab === 'appearance' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Appearance
        </button>
        <button
          onClick={() => setSubTab('export')}
          className={`flex-1 py-2 rounded-md transition-all ${subTab === 'export' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subTab === 'account' && <AuthView user={user} profile={profile} onAuthChange={onAuthChange} />}

        {subTab === 'appearance' && (
          <div className="space-y-5 pb-8">
            {/* Header */}
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-lg">palette</span>
                <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">App Theme</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">Customize the look. Changes apply instantly across the app.</p>
            </div>

            {/* Light / Dark mode */}
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
              <label className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Color Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {(['dark', 'light'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => onThemeChange({ ...theme, mode })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme.mode === mode
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/50 bg-surface hover:border-outline'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-2xl"
                      style={{ fontVariationSettings: theme.mode === mode ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {mode === 'dark' ? 'dark_mode' : 'light_mode'}
                    </span>
                    <span className={`font-mono text-xs uppercase font-bold ${theme.mode === mode ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {mode}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
              <label className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Accent Color</label>

              {/* Preset swatches grid */}
              <div className="grid grid-cols-3 gap-2">
                {ACCENT_PRESETS.map(preset => {
                  const isActive = theme.accent.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => onThemeChange({ ...theme, accent: preset.hex })}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                        isActive ? 'border-2 border-white/40' : 'border-outline-variant/40 hover:border-outline'
                      }`}
                      style={{ backgroundColor: preset.hex + '22' }}
                    >
                      <span
                        className="w-5 h-5 rounded-full shrink-0 border-2"
                        style={{ backgroundColor: preset.hex, borderColor: isActive ? 'rgba(255,255,255,0.6)' : 'transparent' }}
                      />
                      <span className="font-mono text-[10px] text-on-surface uppercase truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom color picker */}
              <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/30">
                <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold shrink-0">Custom</label>
                <input
                  type="color"
                  value={theme.accent}
                  onChange={e => onThemeChange({ ...theme, accent: e.target.value })}
                  className="w-10 h-10 rounded border border-outline-variant cursor-pointer bg-transparent shrink-0"
                  title="Pick any accent color"
                />
                <span className="font-mono text-sm text-on-surface uppercase tracking-widest flex-1">{theme.accent.toUpperCase()}</span>
                <div className="w-8 h-8 rounded-full border-2 border-outline-variant shrink-0" style={{ backgroundColor: theme.accent }} />
              </div>
            </div>

            {/* Live preview strip */}
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-2">
              <label className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Live Preview</label>
              <div className="flex gap-2 flex-wrap items-center">
                <span
                  className="px-3 py-1 rounded-full text-xs font-mono font-bold"
                  style={{ backgroundColor: theme.accent + '22', color: theme.accent, border: `1px solid ${theme.accent}55` }}
                >
                  Active Label
                </span>
                <span className="px-3 py-1 rounded text-xs font-mono font-bold bg-surface border border-outline-variant text-on-surface">
                  Neutral
                </span>
                <button
                  className="px-3 py-1 rounded text-xs font-mono font-bold"
                  style={{ backgroundColor: theme.accent, color: '#1a0003' }}
                >
                  Button
                </button>
                <span className="font-mono text-xs font-bold" style={{ color: theme.accent }}>Data readout</span>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => onThemeChange({ mode: 'dark', accent: '#ffb3ac' })}
              className="w-full py-2 border border-outline-variant text-on-surface-variant font-mono text-xs uppercase rounded hover:border-outline transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {subTab === 'export' && <ExportView setup={setup} activeSession={activeSession} />}
      </div>
    </div>
  );
}
