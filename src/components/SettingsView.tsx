import React, { useEffect, useState } from 'react';
import AuthView from './AuthView';
import ExportView from './ExportView';
import GarageView from './GarageView';
import GuideView from './GuideView';
import PrivacyPolicyView from './PrivacyPolicyView';
import BottomSheet from './ui/BottomSheet';
import { User } from '@supabase/supabase-js';
import { AppUser } from '../lib/supabase';
import { DELETE_ACCOUNT_CONFIRMATION, isDeleteAccountConfirmed } from '../lib/accountDeletion';
import { Setup, ActiveSession, AppTheme, RaceWeekend, AccountingEntry, Todo, Car, TireInventoryItem } from '../types';

export type SettingsSubTab = 'garage' | 'account' | 'appearance' | 'export' | 'guide';

interface SettingsViewProps {
  user: User | null;
  profile: AppUser | null;
  onAuthChange: (user: User | null) => void;
  setup: Setup;
  savedSetups?: Setup[];
  activeSession: ActiveSession;
  theme: AppTheme;
  onThemeChange: (t: AppTheme) => void;
  weekends?: RaceWeekend[];
  todos?: Todo[];
  accounting?: AccountingEntry[];
  // Car props
  cars: Car[];
  activeCarId: string | null;
  onSelectCar: (carId: string) => void;
  onSaveCars: (updated: Car[]) => void;
  onDeleteCar: (carId: string) => void;
  setupCount: (carId: string) => number;
  tireCount: (carId: string) => number;
  shockCount: (carId: string) => number;
  initialSubTab?: SettingsSubTab;
  subTabRequestKey?: number;
  onClearAllData?: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  tireInventory?: TireInventoryItem[];
  onStartWeekend?: () => void;
}

const ACCENT_PRESETS = [
  { label: 'Race Red',    hex: '#ffb3ac' },
  { label: 'Cobalt Blue', hex: '#82b4ff' },
  { label: 'Lap Green',   hex: '#88d982' },
  { label: 'Amber Gold',  hex: '#ffbf81' },
  { label: 'Purple',      hex: '#d4a0ff' },
  { label: 'Cyan',        hex: '#7de8e8' },
];

export default function SettingsView({ user, profile, onAuthChange, setup, savedSetups = [], activeSession, theme, onThemeChange, weekends = [], todos = [], accounting = [], cars, activeCarId, onSelectCar, onSaveCars, onDeleteCar, setupCount, tireCount, shockCount, initialSubTab, subTabRequestKey = 0, onClearAllData, onDeleteAccount, tireInventory = [], onStartWeekend }: SettingsViewProps) {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialSubTab ?? 'garage');
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=confirm, 2=clearing
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeDeleteSheet = () => {
    if (deletingAccount) return;
    setDeleteOpen(false);
    setDeletePhrase('');
    setDeleteError('');
  };

  const confirmDeleteAccount = async () => {
    if (!isDeleteAccountConfirmed(deletePhrase) || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await onDeleteAccount();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account deletion did not finish. Device data was kept. Sign in again and retry.');
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    setSubTab(initialSubTab ?? 'garage');
  }, [initialSubTab, subTabRequestKey]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sub-tab bar */}      
      <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30 text-xs font-mono uppercase tracking-wide overflow-x-auto">
        <button
          onClick={() => setSubTab('garage')}
          className={`flex-1 min-w-0 py-3 min-h-[44px] rounded-md transition-all whitespace-nowrap px-1 ${subTab === 'garage' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Garage
        </button>
        <button
          onClick={() => setSubTab('account')}
          className={`flex-1 min-w-0 py-3 min-h-[44px] rounded-md transition-all whitespace-nowrap px-1 ${subTab === 'account' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Account
        </button>
        <button
          onClick={() => setSubTab('appearance')}
          className={`flex-1 min-w-0 py-3 min-h-[44px] rounded-md transition-all whitespace-nowrap px-1 ${subTab === 'appearance' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Style
        </button>
        <button
          onClick={() => setSubTab('export')}
          className={`flex-1 min-w-0 py-3 min-h-[44px] rounded-md transition-all whitespace-nowrap px-1 ${subTab === 'export' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Export
        </button>
        <button
          onClick={() => setSubTab('guide')}
          className={`flex-1 min-w-0 py-3 min-h-[44px] rounded-md transition-all whitespace-nowrap px-1 ${subTab === 'guide' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60'}`}
        >
          Guide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subTab === 'garage' && (
          <GarageView
            cars={cars}
            activeCarId={activeCarId}
            onSelectCar={onSelectCar}
            onSaveCars={onSaveCars}
            onDeleteCar={onDeleteCar}
            setupCount={setupCount}
            tireCount={tireCount}
            shockCount={shockCount}
          />
        )}

        {subTab === 'account' && (
          <div className="flex flex-col gap-4 pb-8">
            <AuthView user={user} profile={profile} onAuthChange={onAuthChange} />

            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">privacy_tip</span>
                <h3 className="font-display font-bold uppercase text-sm tracking-wide">Privacy</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">
                See what data CREW CHIEF uses, where it is stored, and how to remove it.
              </p>
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="min-h-11 w-full rounded-lg border border-outline-variant px-3 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/10"
              >
                Privacy Policy
              </button>
            </div>

            {/* ── Danger Zone ──────────────────────────────────────────────── */}
            <div className="bg-surface-container border border-red-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-lg">warning</span>
                <h3 className="font-display font-bold uppercase text-sm text-red-400 tracking-wide">Danger Zone</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Clear racing records while keeping your login, or permanently delete the entire account.
              </p>

              {clearStep === 0 && (
                <button
                  onClick={() => setClearStep(1)}
                  className="w-full py-2 rounded-lg border border-red-500/50 text-red-400 font-mono text-xs uppercase tracking-wider hover:bg-red-500/10 transition-colors"
                >
                  Clear Racing Data
                </button>
              )}

              {clearStep === 1 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-mono text-red-400 text-center font-bold">Clear racing records but keep this account?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setClearStep(0)}
                      className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-mono text-xs uppercase tracking-wider hover:bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setClearStep(2);
                        await onClearAllData?.();
                        setClearStep(0);
                      }}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500 text-red-400 font-mono text-xs uppercase tracking-wider font-bold hover:bg-red-500/30 transition-colors"
                    >
                      Yes, Clear Records
                    </button>
                  </div>
                </div>
              )}

              {clearStep === 2 && (
                <p className="text-xs font-mono text-on-surface-variant text-center py-2">Clearing…</p>
              )}

              <div className="border-t border-red-500/20 pt-3">
                {user ? (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="min-h-11 w-full rounded-lg border border-red-500 bg-red-500/10 px-3 font-mono text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20"
                  >
                    Delete Account
                  </button>
                ) : (
                  <p className="text-[11px] font-mono text-on-surface-variant">
                    Connect and sign in to delete the cloud account. Offline records can still be cleared above.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
                <span className="font-mono text-xs text-on-surface-variant flex-1">Tap to pick any color</span>
                <div className="w-8 h-8 rounded-full border-2 border-outline-variant shrink-0" style={{ backgroundColor: theme.accent }} />
              </div>
            </div>

            {/* Font Size */}
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Font Size</label>
                <p className="text-[10px] font-mono text-on-surface-variant/60 mt-0.5">Scales all text and UI elements throughout the app.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'large',  icon: 'format_size', label: 'Default' },
                  { value: 'xlarge', icon: 'text_increase', label: 'Large' },
                ] as const).map(opt => {
                  const active = (theme.fontSize ?? 'large') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onThemeChange({ ...theme, fontSize: opt.value })}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-outline-variant/50 bg-surface hover:border-outline'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-2xl ${active ? 'text-primary' : 'text-on-surface-variant'}`}
                        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {opt.icon}
                      </span>
                      <span className={`font-mono text-xs uppercase font-bold ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => onThemeChange({ mode: 'dark', accent: '#ffb3ac', fontSize: 'large' })}
              className="w-full py-2 border border-outline-variant text-on-surface-variant font-mono text-xs uppercase rounded hover:border-outline transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {subTab === 'export' && <ExportView user={user} setup={setup} savedSetups={savedSetups} activeSession={activeSession} weekends={weekends} todos={todos} accounting={accounting} tireInventory={tireInventory} onStartWeekend={onStartWeekend} />}

        {subTab === 'guide' && <GuideView />}
      </div>

      <BottomSheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy">
        <PrivacyPolicyView />
      </BottomSheet>

      <BottomSheet open={deleteOpen} onClose={closeDeleteSheet} title="Delete Account">
        <div className="space-y-4 pb-2">
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-on-surface-variant">
            This permanently deletes your login, cloud records, owned uploads, and CREW CHIEF data on this device.
            It cannot be undone. If you own a shared team, another member becomes owner.
          </div>
          <label className="block space-y-2">
            <span className="font-mono text-xs text-on-surface-variant">
              Type <strong className="text-on-surface">{DELETE_ACCOUNT_CONFIRMATION}</strong> to confirm
            </span>
            <input
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              disabled={deletingAccount}
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 font-mono text-base text-on-surface outline-none focus:border-red-400"
              aria-label="Type DELETE to confirm account deletion"
            />
          </label>
          {deleteError && (
            <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {deleteError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeDeleteSheet}
              disabled={deletingAccount}
              className="min-h-11 rounded-lg border border-outline-variant px-3 font-mono text-xs uppercase text-on-surface-variant disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteAccount}
              disabled={!isDeleteAccountConfirmed(deletePhrase) || deletingAccount}
              className="min-h-11 rounded-lg border border-red-500 bg-red-500/20 px-3 font-mono text-xs font-bold uppercase text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deletingAccount ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
