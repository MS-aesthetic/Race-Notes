import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Setup, SessionRecord, ActiveSession, RaceWeekend, AppTheme, TireInventoryItem, AccountingEntry, ShoppingItem, Car, ShockSession, CAR_TYPES, MaintenanceComponent, MaintenanceLog, ChecklistTemplate, WeekendChecklist } from './types';
import {
  INITIAL_SETUP,
  INITIAL_SETUPS,
  INITIAL_WEEKENDS,
  INITIAL_ACTIVE_SESSION,
  INITIAL_CARS,
  INITIAL_SHOCK_SESSIONS,
} from './data';

import { supabase, onAuthChange, fetchProfile, getUserTeam, getTeamMembers, handleNativeAuthCallback, rememberLocalAccount, hasLocalAccount, AppUser } from './lib/supabase';
import AuthView from './components/AuthView';
import { pushSetups, pushWeekends, pushActiveSession, pullAllData, mergeIntoLocalStorage, pullTodos, pushTodos, deleteWeekendFromCloud, pushTires, pullTires, deleteTireFromCloud, pushCars, pullCars, deleteCarFromCloud, pushShockSessions, pullShockSessions, deleteShockSessionFromCloud, pushMaintenanceComponents, pullMaintenanceComponents, deleteMaintenanceComponentFromCloud, pushMaintenanceLogs, pullMaintenanceLogs, deleteMaintenanceLogFromCloud, pushChecklistTemplates, pullChecklistTemplates, deleteChecklistTemplateFromCloud, pushWeekendChecklists, pullWeekendChecklists } from './lib/sync';
import { registerForPush } from './lib/push';
import { syncTireLifecycle } from './lib/tireHistory';
import { normalizeSetup, normalizeSetups, pickLatestSetupForCar } from './lib/setupCompat';
import { formatPressureBlock, mirrorPressureBlockToTires, pressureBlockHasValue, resolveSessionPressureBlock, setupPressureBlock } from './lib/setupSteps';
import { materializeMainChecklist } from './lib/mainChecklist';
import { reconcileStarterTemplates } from './lib/checklists';
import { deriveReadableLightAccent, readableOnColor } from './lib/colorContrast';

import DashboardView from './components/DashboardView';
import SetupView from './components/SetupView';
import RaceWeekendView from './components/RaceWeekendView';
import type { NewSessionData, NewWeekendData } from './components/RaceWeekendView';
import { buildSessionNameFrom } from './lib/sessionSequence';
import SettingsView from './components/SettingsView';
import QuickReferenceView from './components/QuickReferenceView';
import TrackersView from './components/TrackersView';
import ContextStrip from './components/ContextStrip';
import HelpSheet from './components/ui/HelpSheet';
import { InfoToast } from './components/ui/UndoToast';
import { pickAutoWeekend, sortWeekends } from './lib/scope';
import { buildQuickServiceRecords, type QuickServiceOutcome, type QuickServiceRequest } from './lib/serviceLog';
import { useOnlineStatus } from './lib/saveStatus';
import { hasOpenSheets, isPopSuppressed } from './lib/backStack';
import { Todo } from './types';

const ACTIVE_WEEKEND_KEY = 'race_notes_active_weekend';

const normalizeTheme = (value: unknown): AppTheme => {
  const saved = (value && typeof value === 'object' ? value : {}) as Partial<AppTheme>;
  const fontSize: AppTheme['fontSize'] = saved.fontSize === 'xlarge' || saved.fontSize === 'xxlarge'
    ? 'xlarge'
    : 'large';
  return {
    mode: saved.mode === 'light' ? 'light' : 'dark',
    accent: typeof saved.accent === 'string' && saved.accent ? saved.accent : '#ffb3ac',
    fontSize,
  };
};

const applyActiveSessionToWeekends = (
  source: RaceWeekend[],
  updatedSession: ActiveSession,
): RaceWeekend[] => source.map((weekend) => {
  if (updatedSession.weekendId && weekend.id !== updatedSession.weekendId) return weekend;
  return {
    ...weekend,
    sessions: weekend.sessions.map((session) => {
      const matches = (updatedSession.id && session.id === updatedSession.id)
        || (!updatedSession.id
          && session.name.toUpperCase() === updatedSession.name.toUpperCase()
          && session.track.toLowerCase() === updatedSession.track.toLowerCase());
      if (!matches) return session;
      return {
        ...session,
        bestLap: `${updatedSession.bestLap}s`,
        avgLap: updatedSession.avgLap,
        finishPos: updatedSession.finishPos,
        gap: updatedSession.gap,
        maxRpm: updatedSession.maxRpm,
        leaderLap: updatedSession.leaderLap,
        leaderGap: updatedSession.leaderGap,
        diagnostics: { ...updatedSession.diagnostics },
        adjustments: [...updatedSession.adjustments],
        tires: updatedSession.tires ? { ...updatedSession.tires } : undefined,
        pressures: { ...updatedSession.pressures },
        pressureSourceNote: updatedSession.pressureSourceNote,
        competitionNotes: updatedSession.competitionNotes,
      };
    }),
  };
});

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers'>('dashboard');
  const [setup, setSetup] = useState<Setup>(INITIAL_SETUP);
  const [savedSetups, setSavedSetups] = useState<Setup[]>(INITIAL_SETUPS);
  const [weekends, setWeekends] = useState<RaceWeekend[]>(INITIAL_WEEKENDS);
  const [activeWeekendId, setActiveWeekendId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_WEEKEND_KEY)
  );
  const [activeSession, setActiveSession] = useState<ActiveSession>(INITIAL_ACTIVE_SESSION);
  const activeSessionRef = useRef(activeSession);
  const weekendsRef = useRef(weekends);
  const sessionCloudQueueRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { weekendsRef.current = weekends; }, [weekends]);
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('race_notes_todos');
    if (!saved) return [];
    const materialized = materializeMainChecklist(JSON.parse(saved));
    localStorage.setItem('race_notes_todos', JSON.stringify(materialized));
    return materialized;
  });

  const [accounting, setAccounting] = useState<AccountingEntry[]>(() => {
    try { const s = localStorage.getItem('race_notes_accounting'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [shopping, setShopping] = useState<ShoppingItem[]>(() => {
    try { const s = localStorage.getItem('race_notes_shopping'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [tireInventory, setTireInventory] = useState<TireInventoryItem[]>(() => {
    const saved = localStorage.getItem('race_notes_tires');
    return saved ? JSON.parse(saved) : [];
  });

  const handleSaveTires = (updated: TireInventoryItem[]) => {
    setTireInventory(updated);
    localStorage.setItem('race_notes_tires', JSON.stringify(updated));
    if (user) pushTires(updated, user.id);
  };

  const handleDeleteTireFromCloud = async (tireId: string) => {
    if (user) await deleteTireFromCloud(tireId);
  };

  // ── Cars & Garage ──────────────────────────────────────────────────────────
  const [cars, setCars] = useState<Car[]>(() => {
    try { const s = localStorage.getItem('race_notes_cars'); return s ? JSON.parse(s) : INITIAL_CARS; }
    catch { return INITIAL_CARS; }
  });

  const [activeCarId, setActiveCarId] = useState<string | null>(() => {
    return localStorage.getItem('race_notes_active_car');
  });

  // ── Checklists (WS-R) ────────────────────────────────────────────────
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>(() => {
    try { const s = localStorage.getItem('race_notes_checklist_templates'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [weekendChecklists, setWeekendChecklists] = useState<WeekendChecklist[]>(() => {
    try { const s = localStorage.getItem('race_notes_weekend_checklists'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ── Maintenance / ERP (WS-P) ──────────────────────────────────────────────
  const [maintenance, setMaintenance] = useState<MaintenanceComponent[]>(() => {
    try { const s = localStorage.getItem('race_notes_maintenance'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => {
    try { const s = localStorage.getItem('race_notes_maintenance_logs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [trackersSubTab, setTrackersSubTab] = useState<'checklist' | 'service' | 'templates' | 'accounting'>('checklist');

  // Lifted smasher/shock-session state (Decision 1: cloud sync)
  const [shockSessions, setShockSessions] = useState<ShockSession[]>(() => {
    try { const s = localStorage.getItem('race_notes_shock_graphs'); return s ? JSON.parse(s) : INITIAL_SHOCK_SESSIONS; }
    catch { return INITIAL_SHOCK_SESSIONS; }
  });

  const activeCar = cars.find(c => c.id === activeCarId) ?? null;
  const savedActiveSetup = setup.carId === activeCarId ? savedSetups.find(item => item.id === setup.id) ?? null : null;
  const activeCarSetup = savedActiveSetup ?? pickLatestSetupForCar(savedSetups, activeCarId);

  // ── [27] Help sheet, [37]/[5] info toast, [33] online status ──────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  useEffect(() => {
    if (!infoToast) return;
    const t = setTimeout(() => setInfoToast(null), 3000);
    return () => clearTimeout(t);
  }, [infoToast]);
  const isOnline = useOnlineStatus();

  // Auto-select first car if activeCarId is missing or dangling
  useEffect(() => {
    if (cars.length > 0 && (!activeCarId || !cars.find(c => c.id === activeCarId))) {
      handleSelectCar(cars[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, activeCarId]);

  const handleSaveCars = (updated: Car[]) => {
    setCars(updated);
    localStorage.setItem('race_notes_cars', JSON.stringify(updated));
    if (user) pushCars(updated, user.id, team?.id ?? null, setSyncStatus);
  };

  const handleSelectCar = (carId: string) => {
    // [37] Confirm the scope switch when the user actually changes car
    if (activeCarId && carId !== activeCarId && cars.length > 1) {
      const nextCar = cars.find(c => c.id === carId);
      if (nextCar) {
        const label = nextCar.name || `${nextCar.chassis} · ${nextCar.carType}`;
        setInfoToast(`Now viewing ${label} — setups, sessions & trackers switched.`);
      }
    }
    setActiveCarId(carId);
    localStorage.setItem('race_notes_active_car', carId);
    const nextSetup = pickLatestSetupForCar(savedSetups, carId);
    if (nextSetup) {
      setSetup(nextSetup);
      localStorage.setItem('race_notes_setup', JSON.stringify(nextSetup));
    }
  };

  const handleSaveShockSessions = (updated: ShockSession[]) => {
    if (user) {
      const remainingIds = new Set(updated.map(session => session.id));
      shockSessions
        .filter(session => !remainingIds.has(session.id))
        .forEach(session => deleteShockSessionFromCloud(session.id));
    }
    setShockSessions(updated);
    localStorage.setItem('race_notes_shock_graphs', JSON.stringify(updated));
    if (user) pushShockSessions(updated, user.id, setSyncStatus);
  };

  const handleSaveMaintenance = (updated: MaintenanceComponent[]) => {
    setMaintenance(updated);
    localStorage.setItem('race_notes_maintenance', JSON.stringify(updated));
    if (user) pushMaintenanceComponents(updated, user.id, setSyncStatus);
  };

  const handleSaveMaintenanceLogs = (updated: MaintenanceLog[]) => {
    setMaintenanceLogs(updated);
    localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(updated));
    if (user) pushMaintenanceLogs(updated, user.id, setSyncStatus);
  };

  const handleSaveChecklistTemplates = (updated: ChecklistTemplate[]) => {
    setChecklistTemplates(updated);
    localStorage.setItem('race_notes_checklist_templates', JSON.stringify(updated));
    if (user) pushChecklistTemplates(updated, user.id, setSyncStatus);
  };

  const handleSaveWeekendChecklists = (updated: WeekendChecklist[]) => {
    setWeekendChecklists(updated);
    localStorage.setItem('race_notes_weekend_checklists', JSON.stringify(updated));
    if (user) pushWeekendChecklists(updated, user.id, setSyncStatus);
  };

  // handleDeleteCar implemented in Phase 7 — stub here
  const handleDeleteCar = (carId: string) => {
    const sc = savedSetups.filter(s => s.carId === carId).length;
    const tc = tireInventory.filter(t => t.carId === carId).length;
    const shc = shockSessions.filter(s => s.carId === carId).length;
    if (sc + tc + shc > 0) {
      alert('Reassign or delete this car\'s data first.');
      return;
    }
    const updated = cars.filter(c => c.id !== carId);
    handleSaveCars(updated);
    deleteCarFromCloud(carId);
    if (activeCarId === carId) {
      const next = updated[0] ?? null;
      if (next) handleSelectCar(next.id);
      else { setActiveCarId(null); localStorage.removeItem('race_notes_active_car'); }
    }
  };

  // ── Clear All Data ────────────────────────────────────────────────────────────
  const handleClearAllData = async () => {
    const LOCAL_KEYS = [
      'race_notes_setup', 'race_notes_saved_setups', 'race_notes_weekends',
      'race_notes_active_session', 'race_notes_todos', 'race_notes_tires',
      'race_notes_accounting', 'race_notes_shopping', 'race_notes_cars',
      'race_notes_active_car', 'race_notes_shock_graphs',
      'race_notes_maintenance', 'race_notes_maintenance_logs',
      'race_notes_checklist_templates', 'race_notes_weekend_checklists',
      ACTIVE_WEEKEND_KEY,
    ];
    LOCAL_KEYS.forEach(k => localStorage.removeItem(k));

    // Wipe Supabase rows for this user
    if (user) {
      try {
        await Promise.all([
          supabase.from('weekends').delete().eq('user_id', user.id),
          supabase.from('setups').delete().eq('user_id', user.id),
          supabase.from('tire_inventory').delete().eq('user_id', user.id),
          supabase.from('cars').delete().eq('user_id', user.id),
          supabase.from('shock_sessions').delete().eq('user_id', user.id),
          supabase.from('todos').delete().eq('user_id', user.id),
        ]);
      } catch (e) { console.warn('Clear cloud data error:', e); }
    }

    // Reset all in-memory state
    setSavedSetups([]);
    setWeekends([]);
    setActiveWeekendId(null);
    setTireInventory([]);
    setCars([]);
    setShockSessions([]);
    setActiveCarId(null);
    setActiveSession(INITIAL_ACTIVE_SESSION);
    setTodos([]);
    setAccounting([]);
    setShopping([]);
    setMaintenance([]);
    setMaintenanceLogs([]);
    setChecklistTemplates([]);
    setWeekendChecklists([]);
    setSyncStatus('All data cleared');
  };

  // Count helpers for GarageView / delete guard
  const carSetupCount = (carId: string) => savedSetups.filter(s => s.carId === carId).length;
  const carTireCount = (carId: string) => tireInventory.filter(t => t.carId === carId).length;
  const carShockCount = (carId: string) => shockSessions.filter(s => s.carId === carId).length;

  // Initial Settings sub-tab (former header chip deep-links now live in the
  // ContextStrip / HelpSheet, so nothing sets this at runtime anymore)
  const [settingsSubTab] = useState<'account' | 'appearance' | 'export' | 'garage' | 'guide'>('garage');
  // Deep-link into SetupView sub-tabs from Dashboard
  const [setupSubTab, setSetupSubTab] = useState<'setups' | 'smasherloads' | 'tires'>('setups');

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('race_notes_theme');
      if (saved) {
        const normalized = normalizeTheme(JSON.parse(saved));
        localStorage.setItem('race_notes_theme', JSON.stringify(normalized));
        return normalized;
      }
    } catch {}
    return { mode: 'dark', accent: '#ffb3ac', fontSize: 'large' };
  });

  const handleThemeChange = (updated: AppTheme) => {
    const normalized = normalizeTheme(updated);
    setTheme(normalized);
    localStorage.setItem('race_notes_theme', JSON.stringify(normalized));
  };

  // Apply theme tokens to document root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.mode);
    // Stored accent stays untouched. Light mode gets only a derived rendered value.
    const renderedAccent = theme.mode === 'light'
      ? deriveReadableLightAccent(theme.accent, '#e1dedc')
      : theme.accent;
    root.style.setProperty('--color-primary', renderedAccent);
    root.style.setProperty('--color-primary-fixed-dim', renderedAccent);
    root.style.setProperty('--color-surface-tint', renderedAccent);
    root.style.setProperty('--color-on-primary', readableOnColor(renderedAccent));
    // UI scale — zoom (not root font-size) so it scales fixed-px utility
    // classes and rem-based ones uniformly, and renders identically on the
    // installed PWA (Chrome) vs the Capacitor APK (Android WebView) — both
    // Chromium, both respect `zoom` the same way.
    root.style.fontSize = '16px';
    const ZOOM: Record<AppTheme['fontSize'], number> = { standard: 1.15, large: 1.15, xlarge: 1.45, xxlarge: 1.45 };
    const zoom = ZOOM[theme.fontSize] ?? 1.15;
    root.style.setProperty('--ui-zoom', String(zoom));
  }, [theme]);

  // ---- Auth & Cloud Sync State ----
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [team, setTeam] = useState<import('./types').Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [hasLocalAcct, setHasLocalAcct] = useState<boolean>(() => hasLocalAccount());
  const [syncStatus, setSyncStatus] = useState('');
  const [pullDone, setPullDone] = useState(false); // initial cloud pull resolved — gates [4]
  const pullGenerationRef = useRef(0);

  // Wait for auth restoration and, when signed in, the settled cloud merge.
  // This prevents transient local starter seeds from racing team-visible data.
  useEffect(() => {
    if (!authReady || (user && !pullDone)) return;
    const reconciled = reconcileStarterTemplates(checklistTemplates);
    if (reconciled.seeded.length === 0 && reconciled.discardedIds.length === 0) return;
    setChecklistTemplates(reconciled.templates);
    localStorage.setItem('race_notes_checklist_templates', JSON.stringify(reconciled.templates));
    if (user) {
      if (reconciled.seeded.length > 0) pushChecklistTemplates(reconciled.seeded, user.id, setSyncStatus);
      reconciled.discardedIds.forEach(id => { void deleteChecklistTemplateFromCloud(id); });
    }
  }, [authReady, checklistTemplates, pullDone, user]);

  // ── "Saved" flash toast ──────────────────────────────────────────────────
  // Local-first writes are instant; this gives users clear, prominent
  // confirmation that their data was captured — even fully offline.
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashReadyRef = useRef(false);      // false until initial hydration settles
  const suppressPullRef = useRef(false);    // true during cloud pulls
  const flashSaved = () => {
    setSavedFlash(true);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1900);
  };
  // Enable flashes only after the initial localStorage hydration has settled,
  // so loading the app doesn't count as a "save".
  useEffect(() => {
    const t = setTimeout(() => { flashReadyRef.current = true; }, 800);
    return () => clearTimeout(t);
  }, []);
  // Fire on any change to the core datasets — covers every save path (online
  // or offline) without wiring each individual handler.
  useEffect(() => {
    if (!flashReadyRef.current || suppressPullRef.current) return;
    flashSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping, maintenance, maintenanceLogs, checklistTemplates, weekendChecklists]);

  // Auto-dismiss any sync status so a message can never get "stuck" on screen.
  // 'Syncing...' is left alone (it's replaced by 'Synced' when the pull finishes).
  useEffect(() => {
    if (!syncStatus || syncStatus === 'Syncing...') return;
    const t = setTimeout(() => setSyncStatus(''), 2500);
    return () => clearTimeout(t);
  }, [syncStatus]);

  // [15] Weekend/session creation modals now live in RaceWeekendView.
  // This one-shot action tells the Sessions tab to open a modal on arrival.
  const [rwInitialAction, setRwInitialAction] = useState<'new-session' | 'new-weekend' | null>(null);
  const continueToRunAfterWeekendRef = useRef(false);
  const openRaceWeekendAction = (action: 'new-session' | 'new-weekend') => {
    setRwInitialAction(action);
    setActiveTab('raceweekend');
  };

  const openWeekendForRun = () => {
    continueToRunAfterWeekendRef.current = true;
    openRaceWeekendAction('new-weekend');
  };

  // ── [29] Tab scroll preservation ───────────────────────────────────────────
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollPosRef = useRef<Record<string, number>>({});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(() => {
    // Read the target before AnimatePresence's exit clamps scrollTop to 0.
    const target = scrollPosRef.current[activeTab] ?? 0;
    const restore = () => { if (mainRef.current) mainRef.current.scrollTop = target; };
    const raf = requestAnimationFrame(restore);
    const t = setTimeout(restore, 250); // after the 180ms tab exit animation settles
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [activeTab]);

  // ── [29] Android back: sheets/modals close first (via useBackClosable —
  // the creation modals in RaceWeekendView register there too), then
  // non-dashboard tabs fall back to Dashboard, then exit. ────────────────────
  useEffect(() => {
    window.history.pushState({ __cc_root: true }, '');
    const onPop = () => {
      if (isPopSuppressed()) return;       // programmatic history.back() from a sheet
      if (hasOpenSheets()) return;         // the topmost sheet/modal consumes this pop
      if (activeTabRef.current !== 'dashboard') {
        setActiveTab('dashboard');
        window.history.pushState({ __cc_root: true }, '');
        return;
      }
      // Dashboard with nothing open: don't re-push — the next back exits.
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active weekend is device-local. Recover stale IDs and migrate legacy session selection.
  useEffect(() => {
    if (weekends.length === 0) {
      if (activeWeekendId) setActiveWeekendId(null);
      localStorage.removeItem(ACTIVE_WEEKEND_KEY);
      return;
    }
    if (activeWeekendId && weekends.some(w => w.id === activeWeekendId)) return;
    const nextId = activeSession.weekendId && weekends.some(w => w.id === activeSession.weekendId)
      ? activeSession.weekendId
      : weekends[0].id;
    setActiveWeekendId(nextId);
    localStorage.setItem(ACTIVE_WEEKEND_KEY, nextId);
  }, [weekends, activeWeekendId, activeSession.weekendId]);

  // ── [5] Auto-activate a nearby weekend on first load (one-shot). Runs after
  // the stale-ID effect above so its ±3-day pick wins the initial batch. ─────
  const didAutoWeekend = useRef(false);
  useEffect(() => {
    if (didAutoWeekend.current || weekends.length === 0) return;
    didAutoWeekend.current = true;
    if (activeWeekendId) return;
    const pick = pickAutoWeekend(weekends, new Date().toISOString());
    if (pick) {
      setActiveWeekendId(pick.id);
      localStorage.setItem(ACTIVE_WEEKEND_KEY, pick.id);
      setInfoToast(`Active: ${pick.name}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekends, activeWeekendId]);
  // Clock state matching real timing context
  const [timeStr, setTimeStr] = useState('11:20 AM');

  useEffect(() => {
    // Attempt load from localStorage for state durability if available
    const savedSetup = localStorage.getItem('race_notes_setup');
    const savedSetupsData = localStorage.getItem('race_notes_saved_setups');
    const savedWeekends = localStorage.getItem('race_notes_weekends');
    const savedActive = localStorage.getItem('race_notes_active_session');

    if (savedSetup) {
      try {
        const normalized = normalizeSetup(JSON.parse(savedSetup));
        setSetup(normalized);
        localStorage.setItem('race_notes_setup', JSON.stringify(normalized));
      } catch { /* ignore */ }
    }
    if (savedSetupsData) {
      try {
        const normalized = normalizeSetups(JSON.parse(savedSetupsData));
        setSavedSetups(normalized);
        localStorage.setItem('race_notes_saved_setups', JSON.stringify(normalized));
      } catch { /* ignore */ }
    }
    if (savedWeekends) {
      try {
        setWeekends(JSON.parse(savedWeekends));
      } catch { /* ignore */ }
    }
    if (savedActive) {
      try { setActiveSession(JSON.parse(savedActive)); } catch { /* ignore */ }
    }

    // Set interactive clock
    const updateTime = () => {
      const now = new Date();
      let hrs = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12 || 12;
      setTimeStr(`${hrs}:${mins} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // ---- Auth: restore session + subscribe to changes ----
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setPullDone(false);
        setUser(currentUser);
        if (currentUser) {
          rememberLocalAccount(currentUser);
          setHasLocalAcct(true);
          void registerForPush(currentUser.id);
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
          const t = await getUserTeam(currentUser.id);
          setTeam(t);
          if (t) {
            const members = await getTeamMembers(t.id);
            setTeamMembers(members);
          }
        }
      } catch {
        // Supabase unreachable (offline) – fall back to the local "registered
        // on this device" flag so the user isn't kicked out of a working
        // offline session. hasLocalAcct already reflects this from initial state.
      }
      setAuthReady(true);
    };
    initAuth();

    const unsub = onAuthChange(async (newUser) => {
      setPullDone(false);
      setUser(newUser);
      if (newUser) {
        // Only a *positive* session ever writes the local flag here. A null
        // newUser can mean "explicit sign-out" OR "offline token refresh
        // failed" – we don't want the latter to lock the user out, so
        // clearing the flag is left to the explicit signOut() call instead.
        rememberLocalAccount(newUser);
        setHasLocalAcct(true);
        void registerForPush(newUser.id);
        const p = await fetchProfile(newUser.id);
        setProfile(p);
        const t = await getUserTeam(newUser.id);
        setTeam(t);
        if (t) {
          const members = await getTeamMembers(t.id);
          setTeamMembers(members);
        }
      } else {
        setProfile(null);
        setTeam(null);
        setTeamMembers([]);
        setHasLocalAcct(hasLocalAccount());
      }
    });
    return () => { unsub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // ---- Auth: catch the Google sign-in deep link on native Android ----
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleNativeAuthCallback(url).catch(err =>
        console.warn('Native Google sign-in callback failed:', err)
      );
    });
    return () => { listenerPromise.then(l => l.remove()); };
  }, []);

  // ---- Cloud sync: pull on login, push on data changes ----
  useEffect(() => {
    const generation = ++pullGenerationRef.current;
    if (!user) {
      setPullDone(true);
      return () => { if (pullGenerationRef.current === generation) pullGenerationRef.current += 1; };
    }
    const pullUserId = user.id;
    const isCurrentPull = () => pullGenerationRef.current === generation;
    setPullDone(false);

    // Pull cloud data and merge into localStorage
    const doPull = async () => {
      suppressPullRef.current = true; // don't show "Saved" for cloud-pull state updates
      setSyncStatus('Syncing...');
      const data = await pullAllData(pullUserId, setSyncStatus);
      if (!isCurrentPull()) return;

      if (data.setups.length > 0) {
        mergeIntoLocalStorage('setups', data.setups, 'race_notes_saved_setups');
        setSavedSetups(prev => {
          const merged = [...prev];
          for (const cloud of data.setups) {
            const idx = merged.findIndex(s => s.id === cloud.id);
            if (idx >= 0) merged[idx] = cloud;
            else merged.push(cloud);
          }
          return merged;
        });
      }

      if (data.weekends.length > 0) {
        mergeIntoLocalStorage('weekends', data.weekends, 'race_notes_weekends');
        setWeekends(prev => {
          const merged = [...prev];
          for (const cloud of data.weekends) {
            const idx = merged.findIndex(w => w.id === cloud.id);
            if (idx >= 0) merged[idx] = cloud;
            else merged.push(cloud);
          }
          return merged;
        });
      }

      if (data.activeSession) {
        mergeIntoLocalStorage('activeSession', data.activeSession, 'race_notes_active_session');
        setActiveSession(data.activeSession);
      }

      const cloudTodos = await pullTodos(setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudTodos.length > 0) {
        setTodos(prev => {
          const cloudById = new Map(cloudTodos.map(todo => [todo.id, todo]));
          const hasNewerLocal = prev.some(local => {
            const cloud = cloudById.get(local.id);
            return !cloud || (local.updated_at || '') > (cloud.updated_at || '');
          });
          const merged = [...prev];
          for (const cloud of cloudTodos) {
            const index = merged.findIndex(local => local.id === cloud.id);
            if (index < 0) merged.push(cloud);
            else if ((cloud.updated_at || '') >= (merged[index].updated_at || '')) merged[index] = cloud;
          }
          const materialized = materializeMainChecklist(merged);
          localStorage.setItem('race_notes_todos', JSON.stringify(materialized));
          if (hasNewerLocal || JSON.stringify(materialized) !== JSON.stringify(merged)) {
            pushTodos(materialized, pullUserId, setSyncStatus);
          }
          return materialized;
        });
      } else if (todos.length > 0) {
        pushTodos(materializeMainChecklist(todos), pullUserId, setSyncStatus);
      }

      const cloudTires = await pullTires(pullUserId, setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudTires.length > 0) {
        setTireInventory(cloudTires);
        localStorage.setItem('race_notes_tires', JSON.stringify(cloudTires));
      }

      const cloudCars = await pullCars(pullUserId, setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudCars.length > 0) {
        setCars(cloudCars);
        localStorage.setItem('race_notes_cars', JSON.stringify(cloudCars));
        // Auto-select first car if no active car set yet
        const storedActive = localStorage.getItem('race_notes_active_car');
        if (!storedActive || !cloudCars.find(c => c.id === storedActive)) {
          handleSelectCar(cloudCars[0].id);
        }
      }

      const cloudShock = await pullShockSessions(pullUserId, setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudShock.length > 0) {
        setShockSessions(cloudShock);
        localStorage.setItem('race_notes_shock_graphs', JSON.stringify(cloudShock));
      }

      const cloudMaint = await pullMaintenanceComponents(setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudMaint.length > 0) {
        setMaintenance(cloudMaint);
        localStorage.setItem('race_notes_maintenance', JSON.stringify(cloudMaint));
      }
      const cloudMaintLogs = await pullMaintenanceLogs(setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudMaintLogs.length > 0) {
        setMaintenanceLogs(cloudMaintLogs);
        localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(cloudMaintLogs));
      }

      const cloudClTemplates = await pullChecklistTemplates(setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudClTemplates.length > 0) {
        setChecklistTemplates(prev => {
          const merged = [...prev];
          for (const cloud of cloudClTemplates) {
            const index = merged.findIndex(local => local.id === cloud.id);
            if (index < 0) merged.push(cloud);
            else if ((cloud.updatedAt || '') >= (merged[index].updatedAt || '')) merged[index] = cloud;
          }
          localStorage.setItem('race_notes_checklist_templates', JSON.stringify(merged));
          return merged;
        });
      }
      const cloudWkndChecklists = await pullWeekendChecklists(setSyncStatus);
      if (!isCurrentPull()) return;
      if (cloudWkndChecklists.length > 0) {
        setWeekendChecklists(cloudWkndChecklists);
        localStorage.setItem('race_notes_weekend_checklists', JSON.stringify(cloudWkndChecklists));
      }

      setSyncStatus('Synced');
      setTimeout(() => setSyncStatus(''), 3000);
      // Re-enable "Saved" flashes after pull-driven state settles.
      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);
    };

    doPull().catch(error => {
      if (!isCurrentPull()) return;
      console.warn('Cloud pull failed:', error);
      setSyncStatus('Offline — local data ready');
    }).finally(() => {
      if (!isCurrentPull()) return;
      setPullDone(true); // checklist reconciliation may now use merged/local data
      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);
    });
    return () => { if (pullGenerationRef.current === generation) pullGenerationRef.current += 1; };
  }, [user]);

  // ── One-time backfill: assign legacy data to a default car ────────────────
  // Runs once after the first login pull (or on initial local load if no user).
  // Guard with a ref so it never duplicates on re-renders.
  const didBackfill = useRef(false);

  useEffect(() => {
    if (didBackfill.current) return;
    if (cars.length > 0) { didBackfill.current = true; return; } // already has cars
    const hasLegacyData = savedSetups.length > 0 || tireInventory.length > 0 || shockSessions.length > 0;
    if (!hasLegacyData) { didBackfill.current = true; return; } // brand-new user

    didBackfill.current = true;

    const guessedType = savedSetups.find(s => s.carType)?.carType || CAR_TYPES[0];
    const guessedChassis = savedSetups.find(s => s.chassis)?.chassis || 'My Car';
    const now = new Date().toISOString();
    const defaultCar: Car = {
      id: `car-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: user?.id ?? 'local',
      teamId: team?.id ?? null,
      carType: guessedType,
      chassis: guessedChassis,
      division: '',
      createdAt: now,
      updatedAt: now,
    };

    // Stamp all legacy data with the default car id
    const stampedSetups = savedSetups.map(s => s.carId ? s : { ...s, carId: defaultCar.id });
    const stampedTires = tireInventory.map(t => t.carId ? t : { ...t, carId: defaultCar.id });
    const stampedShock = shockSessions.map(s => s.carId ? s : { ...s, carId: defaultCar.id });

    // Persist setups
    setSavedSetups(stampedSetups);
    localStorage.setItem('race_notes_saved_setups', JSON.stringify(stampedSetups));
    if (user) pushSetups(stampedSetups, user.id, setSyncStatus);

    // Persist tires
    setTireInventory(stampedTires);
    localStorage.setItem('race_notes_tires', JSON.stringify(stampedTires));
    if (user) pushTires(stampedTires, user.id, setSyncStatus);

    // Persist shock sessions
    handleSaveShockSessions(stampedShock);

    // Register car and select it
    handleSaveCars([defaultCar]);
    handleSelectCar(defaultCar.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSetups, tireInventory, shockSessions, cars]);

  // ── [4] Auto-create a first car for truly-empty accounts (one-shot) ───────
  // The backfill effect above owns the "legacy data, no cars" case; this one
  // handles brand-new/empty accounts so the app never lacks an active car.
  // Signed-in devices wait for the initial cloud pull so a 2nd device doesn't
  // create a duplicate before the cloud garage arrives.
  const didAutoCar = useRef(false);
  useEffect(() => {
    if (didAutoCar.current) return;
    if (!authReady) return;
    if (user && !pullDone) return;
    if (cars.length > 0) { didAutoCar.current = true; return; }
    const hasLegacyData = savedSetups.length > 0 || tireInventory.length > 0 || shockSessions.length > 0;
    if (hasLegacyData) return; // legacy backfill effect will create the car

    didAutoCar.current = true;
    const now = new Date().toISOString();
    const defaultCar: Car = {
      id: `car-${Date.now()}`,
      userId: user?.id ?? 'local',
      teamId: team?.id ?? null,
      carType: CAR_TYPES[0],
      chassis: 'My Car',
      division: '',
      name: 'My Car',
      createdAt: now,
      updatedAt: now,
    };
    const updated = [defaultCar];
    setCars(updated);
    localStorage.setItem('race_notes_cars', JSON.stringify(updated));
    if (user) pushCars(updated, user.id, team?.id ?? null, setSyncStatus);
    handleSelectCar(defaultCar.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, pullDone, cars, savedSetups, tireInventory, shockSessions]);

  const handleSaveSetups = (updatedSetups: Setup[], activeId?: string, preserveInfoToast = false) => {
    setSavedSetups(updatedSetups);
    localStorage.setItem('race_notes_saved_setups', JSON.stringify(updatedSetups));

    const nextActive = activeId ? updatedSetups.find(item => item.id === activeId) : null;
    if (activeId === '') {
      setSetup(INITIAL_SETUP);
      localStorage.removeItem('race_notes_setup');
    }
    if (nextActive) {
      const prior = savedSetups.find(item => item.id === nextActive.id);
      const activated = setup.id !== nextActive.id;
      const pressuresChanged = !prior || (['lf', 'rf', 'lr', 'rr'] as const).some(corner => prior[corner].tirePress !== nextActive[corner].tirePress);
      setSetup(nextActive);
      localStorage.setItem('race_notes_setup', JSON.stringify(nextActive));
      if (activated || pressuresChanged) {
        const pressures = setupPressureBlock(nextActive);
        const hasPressureSource = pressureBlockHasValue(pressures);
        const sourceNote = `Pressures carried from ${nextActive.chassis}`;
        handleUpdateSession(current => {
          const tireDetails = {
            lf: { ...current.tires?.lf, compound: nextActive.lf.tireComp || current.tires?.lf.compound || '', size: nextActive.lf.tireSize || current.tires?.lf.size || '', airPressure: pressures.lf },
            rf: { ...current.tires?.rf, compound: nextActive.rf.tireComp || current.tires?.rf.compound || '', size: nextActive.rf.tireSize || current.tires?.rf.size || '', airPressure: pressures.rf },
            lr: { ...current.tires?.lr, compound: nextActive.lr.tireComp || current.tires?.lr.compound || '', size: nextActive.lr.tireSize || current.tires?.lr.size || '', airPressure: pressures.lr },
            rr: { ...current.tires?.rr, compound: nextActive.rr.tireComp || current.tires?.rr.compound || '', size: nextActive.rr.tireSize || current.tires?.rr.size || '', airPressure: pressures.rr },
          };
          const tires = mirrorPressureBlockToTires(tireDetails, pressures);
          return { ...current, setupUsed: nextActive.chassis, pressures, tires, pressureSourceNote: hasPressureSource ? sourceNote : undefined };
        });
        if (hasPressureSource && !preserveInfoToast) setInfoToast(sourceNote);
        else if (!preserveInfoToast) setInfoToast(null);
      }
    }
    if (user) pushSetups(updatedSetups, user.id, setSyncStatus);
  };

  const handleUpdateSession = (update: ActiveSession | ((current: ActiveSession) => ActiveSession)) => {
    const updatedSession = typeof update === 'function' ? update(activeSessionRef.current) : update;
    const updatedWeekends = applyActiveSessionToWeekends(weekendsRef.current, updatedSession);

    // Refs serialize rapid updates before React renders; every external write happens once here.
    activeSessionRef.current = updatedSession;
    weekendsRef.current = updatedWeekends;
    setActiveSession(updatedSession);
    setWeekends(updatedWeekends);
    localStorage.setItem('race_notes_active_session', JSON.stringify(updatedSession));
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));

    if (user) {
      const userId = user.id;
      sessionCloudQueueRef.current = sessionCloudQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await Promise.all([
            pushActiveSession(updatedSession, userId),
            pushWeekends(updatedWeekends, userId),
          ]);
        });
    }
  };

  // Session weather helpers moved into RaceWeekendView ([15]).

  const handleActivateWeekend = (weekendId: string) => {
    const target = weekends.find(w => w.id === weekendId);
    if (!target) return;
    setActiveWeekendId(target.id);
    localStorage.setItem(ACTIVE_WEEKEND_KEY, target.id);
  };

  const handleDeleteMaintenanceComponent = (componentId: string) => {
    const deletedLogIds = maintenanceLogs.filter(log => log.componentId === componentId).map(log => log.id);
    handleSaveMaintenance(maintenance.filter(component => component.id !== componentId));
    handleSaveMaintenanceLogs(maintenanceLogs.filter(log => log.componentId !== componentId));
    if (user) {
      void Promise.all([
        deleteMaintenanceComponentFromCloud(componentId),
        ...deletedLogIds.map(deleteMaintenanceLogFromCloud),
      ]).then(results => {
        if (results.some(ok => !ok)) setSyncStatus('Cloud delete failed — retry online');
      });
    }
  };

  const handleDeleteChecklistTemplate = (templateId: string) => {
    const updated = checklistTemplates.filter(template => template.id !== templateId);
    handleSaveChecklistTemplates(updated);
    if (user) void deleteChecklistTemplateFromCloud(templateId).then(ok => {
      if (!ok) setSyncStatus('Cloud delete failed — retry online');
    });
  };

  // ── Create weekend ([15]: form lives in RaceWeekendView, data arrives here) ──

  const handleCreateNewWeekend = (data: NewWeekendData) => {
    if (!data.name.trim() || !data.track.trim()) return;

    const boundSetup = activeCarId
      ? savedSetups.find(s => s.id === data.setupId && s.carId === activeCarId) || null
      : null;

    const newWknd: RaceWeekend = {
      id: `wknd-${Date.now()}`,
      name: data.name,
      track: data.track,
      date: data.date || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      sessions: [],
      setupId: boundSetup?.id,
      setupName: boundSetup?.chassis,
    };

    setWeekends((prev) => {
      const updated = [newWknd, ...prev];
      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (user) pushWeekends(updated, user.id);
      return updated;
    });

    setActiveWeekendId(newWknd.id);
    localStorage.setItem(ACTIVE_WEEKEND_KEY, newWknd.id);
    setInfoToast(`Active: ${newWknd.name}`);
    if (continueToRunAfterWeekendRef.current) {
      continueToRunAfterWeekendRef.current = false;
      setRwInitialAction('new-session');
      setActiveTab('raceweekend');
    }
  };

  const handleCreateNewSession = (data: NewSessionData) => {
    // Sessions may only be created under the device-active weekend.
    if (!activeWeekendId || data.weekendId !== activeWeekendId) return;

    const targetWeekend = weekends.find(w => w.id === activeWeekendId);
    if (!targetWeekend) return;

    // Never use a setup from another active car as a run baseline.
    const sessionSetup = activeCarSetup;

    // Load setup baseline pressures as initial psi values for convenience
    const defaultPressures = setupPressureBlock(sessionSetup);

    const defaultTires = {
      lf: {
        compound: sessionSetup?.lf.tireComp || '',
        size: sessionSetup?.lf.tireSize || '',
        airPressure: defaultPressures.lf,
      },
      rf: {
        compound: sessionSetup?.rf.tireComp || '',
        size: sessionSetup?.rf.tireSize || '',
        airPressure: defaultPressures.rf,
      },
      lr: {
        compound: sessionSetup?.lr.tireComp || '',
        size: sessionSetup?.lr.tireSize || '',
        airPressure: defaultPressures.lr,
      },
      rr: {
        compound: sessionSetup?.rr.tireComp || '',
        size: sessionSetup?.rr.tireSize || '',
        airPressure: defaultPressures.rr,
      },
    };

    // [11] Prefill carried from the previous session wins over setup baselines
    const prefillPressures = formatPressureBlock(data.prefillPressures);
    const hasPrefillPressures = pressureBlockHasValue(prefillPressures);
    const initialPressures = hasPrefillPressures ? prefillPressures : defaultPressures;
    const initialTires = mirrorPressureBlockToTires(data.prefillTires ?? defaultTires, initialPressures);
    const pressureSourceNote = hasPrefillPressures
      ? data.pressureSourceNote
      : (pressureBlockHasValue(defaultPressures) && sessionSetup ? `Pressures carried from ${sessionSetup.chassis}` : undefined);

    // Auto-number session name (same convention as always)
    const sessionName = buildSessionNameFrom(targetWeekend.sessions, data.type);

    // Resolve time
    const resolvedTime = data.timeOfDay === 'current'
      ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : data.timeOfDay;

    const nextSession: ActiveSession = {
      sessionType: data.type,
      name: sessionName,
      track: targetWeekend.track,
      setupUsed: sessionSetup?.chassis || 'No setup baseline',
      condition: '',
      trackConditionPreset: data.trackCondition || undefined,
      conditionNotes: data.conditionNotes || undefined,
      weather: data.weather || '',
      time: resolvedTime,
      bestLap: '',
      avgLap: '',
      finishPos: '',
      gap: '',
      maxRpm: '',
      leaderLap: '',
      leaderGap: '',
      diagnostics: {
        cornerEntry: 'NEUTRAL',
        cornerEntryNotes: '',
        centerApex: 'NEUTRAL',
        centerApexNotes: '',
        cornerExit: 'NEUTRAL',
        cornerExitNotes: '',
      },
      adjustments: [],
      tires: initialTires,
      pressures: initialPressures,
      pressureSourceNote,
      competitionNotes: '',
      screenshots: []
    };

    const newRecord: SessionRecord = {
      id: `session-rec-${Date.now()}`,
      type: sessionName,
      sessionType: data.type,
      name: sessionName,
      track: targetWeekend.track,
      condition: '',
      trackConditionPreset: data.trackCondition || undefined,
      conditionNotes: data.conditionNotes || undefined,
      bestLap: '',
      avgLap: '',
      finishPos: '',
      gap: '',
      maxRpm: '',
      leaderLap: '',
      leaderGap: '',
      diagnostics: {
        cornerEntry: 'NEUTRAL',
        cornerEntryNotes: '',
        centerApex: 'NEUTRAL',
        centerApexNotes: '',
        cornerExit: 'NEUTRAL',
        cornerExitNotes: '',
      },
      adjustments: [],
      tires: initialTires,
      pressures: initialPressures,
      pressureSourceNote,
      competitionNotes: '',
      time: resolvedTime,
      weather: data.weather || '',
      setupUsed: sessionSetup?.chassis || 'No setup baseline',
      screenshots: []
    };

    nextSession.id = newRecord.id;
    nextSession.weekendId = data.weekendId;

    setWeekends((prev) => {
      const updated = prev.map(w => w.id === targetWeekend.id ? {
        ...w,
        sessions: [newRecord, ...w.sessions]
      } : w);
      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (user) pushWeekends(updated, user.id);
      
      // Sync tire lifecycle (heat cycles, usage dates) from updated weekend data
      const lifecycled = syncTireLifecycle(tireInventory, updated);
      setTireInventory(lifecycled);
      localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
      if (user) pushTires(lifecycled, user.id);
      
      return updated;
    });

    setActiveSession(nextSession);
    localStorage.setItem('race_notes_active_session', JSON.stringify(nextSession));
    if (pressureSourceNote) setInfoToast(pressureSourceNote);

    setActiveTab('raceweekend');
  };

  // Immediate delete — no confirm. Both RaceWeekendView and Dashboard wrap
  // this in the undo-toast pattern ([8]/[16]) — it fires only on commit.
  const deleteWeekendNow = (weekendId: string) => {
    const updated = weekends.filter(w => w.id !== weekendId);
    setWeekends(updated);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
    // Hard-delete from cloud so it doesn't come back on next sync pull
    deleteWeekendFromCloud(weekendId);
    if (user) pushWeekends(updated, user.id);
    if (activeWeekendId === weekendId) {
      const nextId = updated[0]?.id ?? null;
      setActiveWeekendId(nextId);
      if (nextId) localStorage.setItem(ACTIVE_WEEKEND_KEY, nextId);
      else localStorage.removeItem(ACTIVE_WEEKEND_KEY);
    }
    if (activeSession.weekendId === weekendId) {
      const cleared: ActiveSession = { ...INITIAL_ACTIVE_SESSION, weekendId: undefined };
      setActiveSession(cleared);
      localStorage.setItem('race_notes_active_session', JSON.stringify(cleared));
    }
    // Null out weekendId on any checklists that belonged to this weekend (preserve the lists)
    const updatedChecklists = weekendChecklists.map(c =>
      c.weekendId === weekendId ? { ...c, weekendId: undefined, weekendName: undefined } : c
    );
    handleSaveWeekendChecklists(updatedChecklists);
  };

  // [7] Dashboard hero quick-start: create a weekend at the most recent track
  // dated today (handleCreateNewWeekend auto-activates it), then deep-link
  // straight into the new-session flow on the Sessions tab.
  const handleQuickStartWeekend = () => {
    const track = sortWeekends(weekends, activeWeekendId).find(w => w.track)?.track || 'Home Track';
    const today = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    handleCreateNewWeekend({ name: `${track} — ${today}`, track, date: today });
    openRaceWeekendAction('new-session');
  };

  // [25] Quick service log from the Dashboard chip. Record building lives in
  // lib/serviceLog.ts; this just applies the state writes (local-first + push).
  const handleQuickService = (req: QuickServiceRequest): QuickServiceOutcome | null => {
    const component = maintenance.find(c => c.id === req.componentId);
    if (!component) return null;
    const activeWeekend = weekends.find(w => w.id === activeWeekendId) ?? null;
    const result = buildQuickServiceRecords(component, req, weekends, savedSetups, activeWeekend);
    handleSaveMaintenance(maintenance.map(c => (c.id === component.id ? result.updatedComponent : c)));
    handleSaveMaintenanceLogs([result.log, ...maintenanceLogs]);
    if (result.accountingEntry) {
      const updated = [result.accountingEntry, ...accounting];
      setAccounting(updated);
      localStorage.setItem('race_notes_accounting', JSON.stringify(updated));
    }
    return { result, prevComponent: component };
  };

  // Undo removes BOTH records and restores the component's service counter.
  const handleUndoQuickService = ({ result, prevComponent }: QuickServiceOutcome) => {
    handleSaveMaintenance(maintenance.map(c => (c.id === prevComponent.id ? prevComponent : c)));
    handleSaveMaintenanceLogs(maintenanceLogs.filter(l => l.id !== result.log.id));
    if (user) void deleteMaintenanceLogFromCloud(result.log.id).then(ok => {
      if (!ok) setSyncStatus('Cloud undo failed — retry online');
    });
    if (result.accountingEntry) {
      const entryId = result.accountingEntry.id;
      const updated = accounting.filter(e => e.id !== entryId);
      setAccounting(updated);
      localStorage.setItem('race_notes_accounting', JSON.stringify(updated));
    }
  };

  const handleDeleteSession = (weekendId: string, sessionId: string) => {
    // RaceWeekendView owns the undo window. This commit runs only after expiry.
    setWeekends(prev => {
      const updated = prev.map(w =>
        w.id === weekendId ? { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) } : w
      );
      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (user) pushWeekends(updated, user.id);

      setTireInventory(prevTires => {
        const lifecycled = syncTireLifecycle(prevTires, updated);
        localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
        if (user) pushTires(lifecycled, user.id);
        return lifecycled;
      });
      return updated;
    });

    if (activeSession.id === sessionId) {
      setActiveSession(prev => {
        const cleared = { ...prev, id: undefined, weekendId: undefined };
        localStorage.setItem('race_notes_active_session', JSON.stringify(cleared));
        return cleared;
      });
    }
  };

  const handleUpdateWeekend = (updated: RaceWeekend) => {
    const updatedList = weekends.map(w => w.id === updated.id ? updated : w);
    setWeekends(updatedList);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedList));
    if (user) pushWeekends(updatedList, user.id);
    
    // Sync tire lifecycle after weekend update (sessions may have changed)
    const lifecycled = syncTireLifecycle(tireInventory, updatedList);
    setTireInventory(lifecycled);
    localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
    if (user) pushTires(lifecycled, user.id);
  };

  const handleSelectRecentSession = (rec: SessionRecord, weekendId: string) => {
    handleActivateWeekend(weekendId);
    const currentCarSetup = activeCarSetup;
    const restoredPressures = resolveSessionPressureBlock(rec.pressures, rec.tires);
    const restoredTires = mirrorPressureBlockToTires(rec.tires || {
      lf: { compound: currentCarSetup?.lf.tireComp || '', size: currentCarSetup?.lf.tireSize || '', airPressure: '' },
      rf: { compound: currentCarSetup?.rf.tireComp || '', size: currentCarSetup?.rf.tireSize || '', airPressure: '' },
      lr: { compound: currentCarSetup?.lr.tireComp || '', size: currentCarSetup?.lr.tireSize || '', airPressure: '' },
      rr: { compound: currentCarSetup?.rr.tireComp || '', size: currentCarSetup?.rr.tireSize || '', airPressure: '' },
    }, restoredPressures);
    // Dynamically spawn details in modal or swap session
    const restoredSession: ActiveSession = {
      id: rec.id,
      weekendId: weekendId,
      name: rec.name.toUpperCase(),
      track: rec.track,
      setupUsed: rec.setupUsed || currentCarSetup?.chassis || 'No setup baseline',
      condition: rec.condition.toUpperCase(),
      weather: rec.weather || '76°F',
      time: rec.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bestLap: rec.bestLap.replace('s', ''),
      avgLap: rec.avgLap || '--.--',
      finishPos: rec.finishPos || 'P--',
      gap: rec.gap || 'Leader',
      maxRpm: rec.maxRpm || '9,000',
      leaderLap: rec.leaderLap || '14.00',
      leaderGap: rec.leaderGap || '+0.00',
      diagnostics: rec.diagnostics || {
        cornerEntry: 'NEUTRAL',
        cornerEntryNotes: '',
        centerApex: 'NEUTRAL',
        centerApexNotes: '',
        cornerExit: 'NEUTRAL',
        cornerExitNotes: '',
      },
      adjustments: rec.adjustments || [],
      tires: restoredTires,
      pressures: restoredPressures,
      pressureSourceNote: pressureBlockHasValue(restoredPressures) ? rec.pressureSourceNote : undefined,
      competitionNotes: rec.competitionNotes || 'Enter comments here...',
      screenshots: rec.screenshots || [],
      dynoPhotos: rec.dynoPhotos || [],
    };
    activeSessionRef.current = restoredSession;
    setActiveSession(restoredSession);
    localStorage.setItem('race_notes_active_session', JSON.stringify(restoredSession));
  };

  // ---- Auth gate: registration/sign-in is required to use the app. -------
  // `authReady` flips true as soon as the (local, non-blocking) session
  // check finishes. `hasLocalAcct` is our own durable flag (see
  // rememberLocalAccount) so a device that has signed in before keeps
  // working with no signal — only an explicit sign-out re-locks the gate.
  const isUnlocked = !!user || hasLocalAcct;

  if (!authReady) {
    return (
      <div className="h-full w-full bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-3xl animate-pulse">headset_mic</span>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-full w-full bg-surface text-on-surface font-sans flex flex-col items-center justify-start p-0" id="applet-auth-gate">
        <div
          id="viewport-chassis"
          className="w-full max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-background h-full flex flex-col shadow-none md:shadow-2xl md:border-x border-outline-variant/20"
        >
          <header className="bg-surface w-full top-0 sticky border-b border-outline-variant z-40">
            <div className="flex items-center gap-1.5 px-4 md:px-6 py-3">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
          </header>
          <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="w-full max-w-sm">
              <p className="text-center text-on-surface-variant text-xs leading-relaxed mb-6">
                Register or sign in to start tracking setups, sessions, and race weekends.
                <br />
                <span className="text-on-surface-variant/50">
                  Once you've signed in on this device, the app keeps working with no signal.
                </span>
              </p>
              <AuthView user={null} profile={null} onAuthChange={(u) => setUser(u)} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-surface text-on-surface font-sans flex flex-col items-center justify-start p-0" id="applet-main-body">

      {/* Main Core Layout Viewport Container suitable for PWA deployment */}
      <div
        id="viewport-chassis"
        className="w-full max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-background h-full flex flex-col shadow-none md:shadow-2xl md:border-x border-outline-variant/20"
      >
        {/* TopAppBar component with logo title & dual NEW entries triggers */}
        <header className="bg-surface w-full top-0 sticky border-b border-outline-variant z-40">
          <div className="flex flex-wrap justify-between items-center gap-y-1 px-4 md:px-6 py-3 w-full">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
            
            <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
              {/* Tuning Guide sheet ([27]) */}
              <button
                onClick={() => setHelpOpen(true)}
                aria-label="Tuning Guide"
                title="Tuning Guide"
                className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-1 px-2 min-h-12 rounded-full text-on-surface-variant hover:text-primary transition-colors text-center leading-tight"
              >
                <span className="material-symbols-outlined text-[20px]">menu_book</span>
                <span className="font-mono text-[11px] font-semibold">Tuning Guide</span>
              </button>
              {/* Sunlight / theme-mode toggle ([32]) */}
              <button
                onClick={() => handleThemeChange({ ...theme, mode: theme.mode === 'dark' ? 'light' : 'dark' })}
                aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme.mode === 'dark' ? 'Switch to light mode (sunlight)' : 'Switch to dark mode'}
                className="flex items-center justify-center min-w-12 min-h-12 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {theme.mode === 'dark' ? 'dark_mode' : 'light_mode'}
                </span>
              </button>
{/* Active-car chip moved into ContextStrip ([6]); +Session lives in RaceWeekendView */}
            </div>
          </div>
        </header>

        {/* [6] Context strip — which car & weekend everything is scoped to */}
        {(activeTab === 'dashboard' || activeTab === 'setups' || activeTab === 'raceweekend' || activeTab === 'trackers') && (
          <ContextStrip
            cars={cars}
            activeCarId={activeCarId}
            weekends={weekends}
            activeWeekendId={activeWeekendId}
            onSelectCar={handleSelectCar}
            onSelectWeekend={handleActivateWeekend}
            onNewWeekend={() => openRaceWeekendAction('new-weekend')}
          />
        )}

        {/* Single brief Saved / sync toast — bottom-center, above the nav bar.
            Only three states surface: local "Saved", initial "Syncing…", and
            "Synced". The chatty per-entity "X synced to cloud" push messages are
            intentionally NOT shown (they just quietly clear via the auto-dismiss
            effect) so users see at most one short confirmation per action. */}
        {(() => {
          const isBusy = !savedFlash && syncStatus === 'Syncing...';
          const isSynced = !savedFlash && syncStatus === 'Synced';
          if (!savedFlash && !isBusy && !isSynced) return null;
          // [33] Offline-aware: local saves still land, so say exactly that.
          const msg = savedFlash
            ? (isOnline ? 'Saved' : 'Offline — saved on device')
            : isBusy ? 'Syncing…' : 'Synced';
          const isSuccess = savedFlash || isSynced;
          return (
            <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] pointer-events-none px-4 w-full max-w-md flex justify-center">
              <div
                role="status"
                aria-live="polite"
                className={`flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl border-2 font-display font-bold text-sm tracking-wide animate-fade-in ${
                  isSuccess
                    ? 'bg-green-500 border-green-300 text-black'
                    : 'bg-surface-container border-outline-variant text-on-surface'
                }`}
                style={{ boxShadow: isSuccess ? '0 8px 30px rgba(34,197,94,0.45)' : undefined }}
              >
                <span className={`material-symbols-outlined text-xl ${isBusy ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {savedFlash && !isOnline ? 'cloud_off' : isSuccess ? 'check_circle' : isBusy ? 'progress_activity' : 'cloud'}
                </span>
                {msg}
              </div>
            </div>
          );
        })()}

        {/* Core Main Active Canvas Area */}
        <main
          ref={mainRef}
          onScroll={(e) => { scrollPosRef.current[activeTabRef.current] = e.currentTarget.scrollTop; }}
          className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto pb-6 custom-scrollbar"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  weekends={weekends}
                  savedSetups={savedSetups}
                  tireInventory={tireInventory}
                  todos={todos}
                  userId={user?.id}
                  team={team}
                  activeCarId={activeCarId}
                  activeWeekendId={activeWeekendId}
                  carCount={cars.length}
                  onStartNewWeekend={() => openRaceWeekendAction('new-weekend')}
                  onStartNewWeekendForRun={openWeekendForRun}
                  onStartNewSession={() => openRaceWeekendAction('new-session')}
                  onQuickStartWeekend={handleQuickStartWeekend}
                  onSelectSession={(rec, weekendId) => {
                    handleSelectRecentSession(rec, weekendId || '');
                    setActiveTab('raceweekend');
                  }}
                  onGoToSetups={() => setActiveTab('setups')}
                  onGoToSessions={() => setActiveTab('raceweekend')}
                  onGoToGarage={() => setActiveTab('settings')}
                  onGoToTodos={() => { setTrackersSubTab('checklist'); setActiveTab('trackers'); }}
                  onGoToTires={() => {
                    setSetupSubTab('tires');
                    setActiveTab('setups');
                  }}
                  onDeleteWeekend={deleteWeekendNow}
                  maintenance={maintenance}
                  onGoToService={() => { setTrackersSubTab('service'); setActiveTab('trackers'); }}
                  onQuickService={handleQuickService}
                  onUndoQuickService={handleUndoQuickService}
                />
              )}

              {activeTab === 'setups' && (
                <SetupView
                  savedSetups={savedSetups}
                  activeSetupId={setup.id}
                  user={user}
                  tireInventory={tireInventory}
                  onSaveTires={handleSaveTires}
                  onDeleteTireFromCloud={handleDeleteTireFromCloud}
                  activeCarId={activeCarId}
                  activeCar={activeCar}
                  shockSessions={shockSessions}
                  onSaveShockSessions={handleSaveShockSessions}
                  weekends={weekends}
                  initialSubTab={setupSubTab}
                  onSaveSetups={handleSaveSetups}
                  onInfo={setInfoToast}
                  onGoToGarage={() => setActiveTab('settings')}
                />
              )}

              {activeTab === 'raceweekend' && (
                <RaceWeekendView
                  session={activeSession}
                  weekends={weekends}
                  tireInventory={tireInventory}
                  savedSetups={savedSetups}
                  activeCarId={activeCarId}
                  onUpdateSession={handleUpdateSession}
                  onUpdateWeekend={handleUpdateWeekend}
                  onDeleteSession={handleDeleteSession}
                  onDeleteWeekend={deleteWeekendNow}
                  onSelectSession={(rec, weekendId) => handleSelectRecentSession(rec, weekendId)}
                  activeWeekendId={activeWeekendId}
                  onActivateWeekend={handleActivateWeekend}
                  onCreateWeekend={handleCreateNewWeekend}
                  onCreateSession={handleCreateNewSession}
                  activeSetup={activeCarSetup}
                  onUpdateActiveSetup={(updated) => handleSaveSetups(savedSetups.map(item => item.id === updated.id ? updated : item), updated.id)}
                  initialAction={rwInitialAction ?? undefined}
                  onInitialActionConsumed={() => setRwInitialAction(null)}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  user={user}
                  profile={profile}
                  onAuthChange={(u) => setUser(u)}
                  setup={setup}
                  savedSetups={savedSetups}
                  activeSession={activeSession}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  weekends={weekends}
                  todos={todos}
                  accounting={accounting}
                  cars={cars}
                  activeCarId={activeCarId}
                  onSelectCar={handleSelectCar}
                  onSaveCars={handleSaveCars}
                  onDeleteCar={handleDeleteCar}
                  setupCount={carSetupCount}
                  tireCount={carTireCount}
                  shockCount={carShockCount}
                  onStartWeekend={() => openRaceWeekendAction('new-weekend')}
                  initialSubTab={settingsSubTab}
                  onClearAllData={handleClearAllData}
                  tireInventory={tireInventory}
                />
              )}

              {/* [27] QuickRef tab removed — content now lives in the HelpSheet */}

              {activeTab === 'trackers' && (
                <TrackersView
                  todos={todos}
                  teamMembers={teamMembers}
                  currentUserId={user?.id ?? null}
                  weekends={weekends}
                  onSaveTodos={(updated) => {
                    setTodos(updated);
                    localStorage.setItem('race_notes_todos', JSON.stringify(updated));
                    if (user) pushTodos(updated, user.id, setSyncStatus);
                  }}
                  accounting={accounting}
                  onSaveAccounting={(updated) => {
                    setAccounting(updated);
                    localStorage.setItem('race_notes_accounting', JSON.stringify(updated));
                  }}
                  maintenance={maintenance}
                  onSaveMaintenance={handleSaveMaintenance}
                  onDeleteMaintenance={handleDeleteMaintenanceComponent}
                  maintenanceLogs={maintenanceLogs}
                  onSaveMaintenanceLogs={handleSaveMaintenanceLogs}
                  savedSetups={savedSetups}
                  activeCarId={activeCarId}
                  initialSubTab={trackersSubTab}
                  checklistTemplates={checklistTemplates}
                  starterTemplatesReady={authReady && (!user || pullDone)}
                  onSaveChecklistTemplates={handleSaveChecklistTemplates}
                  onDeleteChecklistTemplate={handleDeleteChecklistTemplate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Global Bottom Tab Navigation bar */}
        <nav
          className="bg-surface-container border-t border-outline-variant z-40 flex justify-around items-center h-16 md:h-[72px] px-2 md:px-6 lg:px-12 sticky bottom-0 w-full flex-shrink-0"
          id="global-bottom-nav-bar"
        >
          {/* Dashboard Button */}
          <button
            onClick={() => setActiveTab('dashboard')}
            id="tab-btn-dashboard"
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'dashboard' ? "'FILL' 1" : "'FILL' 0" }}
            >
              dashboard
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Dashboard
            </span>
          </button>

          {/* Setups Button */}
          <button
            onClick={() => setActiveTab('setups')}
            id="tab-btn-setups"
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'setups' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'setups' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings_input_component
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Setups
            </span>
          </button>

          {/* Race Weekend Button */}
          <button
            onClick={() => setActiveTab('raceweekend')}
            id="tab-btn-raceweekend"
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'raceweekend' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'raceweekend' ? "'FILL' 1" : "'FILL' 0" }}
            >
              timer
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Sessions
            </span>
          </button>

          {/* Trackers Button */}
          <button onClick={() => setActiveTab('trackers')}
            id="tab-btn-trackers"
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'trackers' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: activeTab === 'trackers' ? "'FILL' 1" : "'FILL' 0" }}>
              monitoring
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Trackers
            </span>
          </button>

          {/* [27] Reference tab removed — QuickRef opens via the header ? button */}

          {/* Settings Button */}
          <button
            onClick={() => setActiveTab('settings')}
            id="tab-btn-settings"
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'settings' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'settings' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Settings
            </span>
          </button>
        </nav>
      </div>

      {/* [27] Help & Reference sheet — replaces the Quick Reference tab */}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)}>
        <QuickReferenceView />
      </HelpSheet>

      {/* [37]/[5] Car-switch & auto-weekend info toast */}
      <InfoToast
        open={!!infoToast}
        title={infoToast ?? ''}
        onClose={() => setInfoToast(null)}
      />

    </div>
  );
}
