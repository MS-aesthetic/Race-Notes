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
import { pushSetups, pushWeekends, pushActiveSession, pullAllData, mergeIntoLocalStorage, pullTodos, pushTodos, deleteWeekendFromCloud, pushTires, pullTires, deleteTireFromCloud, pushCars, pullCars, deleteCarFromCloud, pushShockSessions, pullShockSessions, pushMaintenanceComponents, pullMaintenanceComponents, deleteMaintenanceComponentFromCloud, pushMaintenanceLogs, pullMaintenanceLogs, deleteMaintenanceLogFromCloud, pushChecklistTemplates, pullChecklistTemplates, deleteChecklistTemplateFromCloud, pushWeekendChecklists, pullWeekendChecklists } from './lib/sync';
import { registerForPush } from './lib/push';
import { syncTireLifecycle } from './lib/tireHistory';
import { normalizeSetup, normalizeSetups } from './lib/setupCompat';
import { materializeMainChecklist } from './lib/mainChecklist';

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
import { pickAutoWeekend } from './lib/scope';
import { useOnlineStatus } from './lib/saveStatus';
import { hasOpenSheets, isPopSuppressed } from './lib/backStack';
import { Todo } from './types';

const ACTIVE_WEEKEND_KEY = 'race_notes_active_weekend';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers'>('dashboard');
  const [setup, setSetup] = useState<Setup>(INITIAL_SETUP);
  const [savedSetups, setSavedSetups] = useState<Setup[]>(INITIAL_SETUPS);
  const [weekends, setWeekends] = useState<RaceWeekend[]>(INITIAL_WEEKENDS);
  const [activeWeekendId, setActiveWeekendId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_WEEKEND_KEY)
  );
  const [activeSession, setActiveSession] = useState<ActiveSession>(INITIAL_ACTIVE_SESSION);
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
    // No data reload — views re-filter on activeCarId
  };

  const handleSaveShockSessions = (updated: ShockSession[]) => {
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
      if (saved) return JSON.parse(saved);
    } catch {}
    return { mode: 'dark', accent: '#ffb3ac', fontSize: 'large' };
  });

  const handleThemeChange = (updated: AppTheme) => {
    setTheme(updated);
    localStorage.setItem('race_notes_theme', JSON.stringify(updated));
  };

  // Apply theme tokens to document root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.mode);
    const hex = theme.accent;
    root.style.setProperty('--color-primary', hex);
    root.style.setProperty('--color-primary-fixed-dim', hex);
    root.style.setProperty('--color-surface-tint', hex);
    // Derive on-primary contrast colour
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    root.style.setProperty('--color-on-primary', luma > 160 ? '#1a0003' : '#ffffff');
    // UI scale — zoom (not root font-size) so it scales fixed-px utility
    // classes and rem-based ones uniformly, and renders identically on the
    // installed PWA (Chrome) vs the Capacitor APK (Android WebView) — both
    // Chromium, both respect `zoom` the same way.
    root.style.fontSize = '16px';
    const ZOOM: Record<AppTheme['fontSize'], number> = { standard: 1, large: 1.15, xlarge: 1.45, xxlarge: 1.7 };
    root.style.setProperty('--ui-zoom', String(ZOOM[theme.fontSize] ?? 1));
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
  const openRaceWeekendAction = (action: 'new-session' | 'new-weekend') => {
    setRwInitialAction(action);
    setActiveTab('raceweekend');
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
    if (!user) return;

    // Pull cloud data and merge into localStorage
    const doPull = async () => {
      suppressPullRef.current = true; // don't show "Saved" for cloud-pull state updates
      setSyncStatus('Syncing...');
      const data = await pullAllData(user.id, setSyncStatus);

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
            pushTodos(materialized, user.id, setSyncStatus);
          }
          return materialized;
        });
      } else if (todos.length > 0) {
        pushTodos(materializeMainChecklist(todos), user.id, setSyncStatus);
      }

      const cloudTires = await pullTires(user.id, setSyncStatus);
      if (cloudTires.length > 0) {
        setTireInventory(cloudTires);
        localStorage.setItem('race_notes_tires', JSON.stringify(cloudTires));
      }

      const cloudCars = await pullCars(user.id, setSyncStatus);
      if (cloudCars.length > 0) {
        setCars(cloudCars);
        localStorage.setItem('race_notes_cars', JSON.stringify(cloudCars));
        // Auto-select first car if no active car set yet
        const storedActive = localStorage.getItem('race_notes_active_car');
        if (!storedActive || !cloudCars.find(c => c.id === storedActive)) {
          handleSelectCar(cloudCars[0].id);
        }
      }

      const cloudShock = await pullShockSessions(user.id, setSyncStatus);
      if (cloudShock.length > 0) {
        setShockSessions(cloudShock);
        localStorage.setItem('race_notes_shock_graphs', JSON.stringify(cloudShock));
      }

      const cloudMaint = await pullMaintenanceComponents(setSyncStatus);
      if (cloudMaint.length > 0) {
        setMaintenance(cloudMaint);
        localStorage.setItem('race_notes_maintenance', JSON.stringify(cloudMaint));
      }
      const cloudMaintLogs = await pullMaintenanceLogs(setSyncStatus);
      if (cloudMaintLogs.length > 0) {
        setMaintenanceLogs(cloudMaintLogs);
        localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(cloudMaintLogs));
      }

      const cloudClTemplates = await pullChecklistTemplates(setSyncStatus);
      if (cloudClTemplates.length > 0) {
        setChecklistTemplates(cloudClTemplates);
        localStorage.setItem('race_notes_checklist_templates', JSON.stringify(cloudClTemplates));
      }
      const cloudWkndChecklists = await pullWeekendChecklists(setSyncStatus);
      if (cloudWkndChecklists.length > 0) {
        setWeekendChecklists(cloudWkndChecklists);
        localStorage.setItem('race_notes_weekend_checklists', JSON.stringify(cloudWkndChecklists));
      }

      setSyncStatus('Synced');
      setPullDone(true); // gates [4] auto-create so a 2nd device can't duplicate
      setTimeout(() => setSyncStatus(''), 3000);
      // Re-enable "Saved" flashes after pull-driven state settles.
      setTimeout(() => { suppressPullRef.current = false; }, 800);
    };

    doPull();
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

  const saveSetup = (updatedSetup: Setup) => {
    setSetup(updatedSetup);
    localStorage.setItem('race_notes_setup', JSON.stringify(updatedSetup));

    // Cloud sync
    if (user) {
      const merged = savedSetups.map(s => s.id === updatedSetup.id ? updatedSetup : s);
      if (!merged.find(s => s.id === updatedSetup.id)) merged.push(updatedSetup);
      pushSetups(merged, user.id, setSyncStatus);
    }
    
    // Auto sync setup baseline tire pressures to the active logging view for engineering consistency
    setActiveSession((prev) => {
      const livePressures = {
        lf: `${updatedSetup.lf.tirePress} psi`,
        rf: `${updatedSetup.rf.tirePress} psi`,
        lr: `${updatedSetup.lr.tirePress} psi`,
        rr: `${updatedSetup.rr.tirePress} psi`,
      };
      const liveTires = {
        lf: {
          compound: updatedSetup.lf.tireComp || prev.tires?.lf.compound || '',
          size: updatedSetup.lf.tireSize || prev.tires?.lf.size || '',
          airPressure: `${updatedSetup.lf.tirePress} psi`,
        },
        rf: {
          compound: updatedSetup.rf.tireComp || prev.tires?.rf.compound || '',
          size: updatedSetup.rf.tireSize || prev.tires?.rf.size || '',
          airPressure: `${updatedSetup.rf.tirePress} psi`,
        },
        lr: {
          compound: updatedSetup.lr.tireComp || prev.tires?.lr.compound || '',
          size: updatedSetup.lr.tireSize || prev.tires?.lr.size || '',
          airPressure: `${updatedSetup.lr.tirePress} psi`,
        },
        rr: {
          compound: updatedSetup.rr.tireComp || prev.tires?.rr.compound || '',
          size: updatedSetup.rr.tireSize || prev.tires?.rr.size || '',
          airPressure: `${updatedSetup.rr.tirePress} psi`,
        },
      };
      const updated = {
        ...prev,
        pressures: livePressures,
        tires: liveTires,
      };
      localStorage.setItem('race_notes_active_session', JSON.stringify(updated));
      return updated;
    });

    setActiveTab('dashboard');
  };

  const handleUpdateSession = (updatedSession: ActiveSession) => {
    setActiveSession(updatedSession);
    localStorage.setItem('race_notes_active_session', JSON.stringify(updatedSession));

    // Cloud sync
    if (user) {
      pushActiveSession(updatedSession, user.id);
    }

    // Also update this session's entry structure inside weekends state log to sync them!
    setWeekends((prev) => {
      const updated = prev.map((wknd) => {
        // If we know the weekend ID, match tightly
        if (updatedSession.weekendId && wknd.id !== updatedSession.weekendId) return wknd;

        const updatedSessions = wknd.sessions.map((s) => {
          if ((updatedSession.id && s.id === updatedSession.id) || (!updatedSession.id && s.name.toUpperCase() === updatedSession.name.toUpperCase() && s.track.toLowerCase() === updatedSession.track.toLowerCase())) {
            return {
              ...s,
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
              competitionNotes: updatedSession.competitionNotes,
            };
          }
          return s;
        });

        return {
          ...wknd,
          sessions: updatedSessions,
        };
      });

      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (user) pushWeekends(updated, user.id);
      return updated;
    });
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

    const boundSetup = savedSetups.find(s => s.id === data.setupId) || null;

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
  };

  const handleCreateNewSession = (data: NewSessionData) => {
    // Sessions may only be created under the device-active weekend.
    if (!activeWeekendId || data.weekendId !== activeWeekendId) return;

    const targetWeekend = weekends.find(w => w.id === activeWeekendId);
    if (!targetWeekend) return;

    // Load setup baseline pressures as initial psi values for convenience
    const defaultPressures = {
      lf: `${setup.lf.tirePress} psi`,
      rf: `${setup.rf.tirePress} psi`,
      lr: `${setup.lr.tirePress} psi`,
      rr: `${setup.rr.tirePress} psi`,
    };

    const defaultTires = {
      lf: {
        compound: setup.lf.tireComp || 'D20',
        size: setup.lf.tireSize || '82.0"',
        airPressure: `${setup.lf.tirePress} psi`,
      },
      rf: {
        compound: setup.rf.tireComp || 'D20',
        size: setup.rf.tireSize || '84.0"',
        airPressure: `${setup.rf.tirePress} psi`,
      },
      lr: {
        compound: setup.lr.tireComp || 'D60',
        size: setup.lr.tireSize || '86.0"',
        airPressure: `${setup.lr.tirePress} psi`,
      },
      rr: {
        compound: setup.rr.tireComp || 'D60',
        size: setup.rr.tireSize || '88.0"',
        airPressure: `${setup.rr.tirePress} psi`,
      },
    };

    // [11] Prefill carried from the previous session wins over setup baselines
    const initialPressures = data.prefillPressures ?? defaultPressures;
    const initialTires = data.prefillTires ?? defaultTires;

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
      setupUsed: setup.chassis || 'Default Setup',
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
      competitionNotes: '',
      time: resolvedTime,
      weather: data.weather || '',
      setupUsed: setup.chassis || 'Default Setup',
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

    setActiveTab('raceweekend');
  };

  // Immediate delete — no confirm. RaceWeekendView wraps this in the undo
  // toast pattern; Dashboard keeps the window.confirm wrapper below.
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

  const handleDeleteWeekend = (weekendId: string) => {
    if (!window.confirm('Delete this race weekend and all its sessions? This cannot be undone.')) return;
    deleteWeekendNow(weekendId);
  };

  const handleDeleteSession = (weekendId: string, sessionId: string) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    const updated = weekends.map(w =>
      w.id === weekendId ? { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) } : w
    );
    setWeekends(updated);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
    if (user) pushWeekends(updated, user.id);
    // If we just deleted the active session, clear weekendId so view resets
    if (activeSession.id === sessionId) {
      setActiveSession(prev => ({ ...prev, id: undefined, weekendId: undefined }));
    }
    
    // Sync tire lifecycle after session deletion
    const lifecycled = syncTireLifecycle(tireInventory, updated);
    setTireInventory(lifecycled);
    localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
    if (user) pushTires(lifecycled, user.id);
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
    // Dynamically spawn details in modal or swap session
    const restoredSession: ActiveSession = {
      id: rec.id,
      weekendId: weekendId,
      name: rec.name.toUpperCase(),
      track: rec.track,
      setupUsed: rec.setupUsed || setup.chassis.toUpperCase(),
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
      tires: rec.tires || {
        lf: { compound: setup.lf.tireComp || '', size: setup.lf.tireSize || '', airPressure: rec.pressures?.lf || '10.0 psi' },
        rf: { compound: setup.rf.tireComp || '', size: setup.rf.tireSize || '', airPressure: rec.pressures?.rf || '11.0 psi' },
        lr: { compound: setup.lr.tireComp || '', size: setup.lr.tireSize || '', airPressure: rec.pressures?.lr || '8.00 psi' },
        rr: { compound: setup.rr.tireComp || '', size: setup.rr.tireSize || '', airPressure: rec.pressures?.rr || '8.00 psi' },
      },
      pressures: rec.pressures || {
        lf: '12.5 psi',
        rf: '14.0 psi',
        lr: '11.5 psi',
        rr: '13.5 psi',
      },
      competitionNotes: rec.competitionNotes || 'Enter comments here...',
      screenshots: rec.screenshots || [],
      dynoPhotos: rec.dynoPhotos || [],
    };
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
          <div className="flex justify-between items-center px-4 md:px-6 py-3 w-full">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Help / Reference sheet ([27]) */}
              <button
                onClick={() => setHelpOpen(true)}
                aria-label="Open help & reference"
                title="Help & quick reference"
                className="flex items-center justify-center min-w-12 min-h-12 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">help</span>
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
                  onActivateWeekend={handleActivateWeekend}
                  onStartNewWeekend={() => openRaceWeekendAction('new-weekend')}
                  onStartNewSession={() => openRaceWeekendAction('new-session')}
                  onSelectSession={(rec, weekendId) => {
                    handleSelectRecentSession(rec, weekendId || '');
                    setActiveTab('raceweekend');
                  }}
                  onSelectSetup={(setupId) => {
                    const found = savedSetups.find(s => s.id === setupId);
                    if (found) setSetup(found);
                    setActiveTab('setups');
                  }}
                  onGoToTodos={() => { setTrackersSubTab('checklist'); setActiveTab('trackers'); }}
                  onGoToTires={() => {
                    setSetupSubTab('tires');
                    setActiveTab('setups');
                  }}
                  onDeleteWeekend={handleDeleteWeekend}
                  maintenance={maintenance}
                  onGoToService={() => { setTrackersSubTab('service'); setActiveTab('trackers'); }}
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
                  onSaveSetups={(updatedSetups, activeId) => {
                    setSavedSetups(updatedSetups);
                    localStorage.setItem('race_notes_saved_setups', JSON.stringify(updatedSetups));
                    if (user) pushSetups(updatedSetups, user.id, setSyncStatus);
                    
                    if (activeId) {
                      const active = updatedSetups.find(s => s.id === activeId);
                      if (active) {
                        setSetup(active);
                        localStorage.setItem('race_notes_setup', JSON.stringify(active));
                        
                        // Auto sync setup baseline tire pressures to the active logging view for engineering consistency
                        setActiveSession((prev) => {
                          const livePressures = {
                            lf: `${active.lf.tirePress || '10.0'} psi`,
                            rf: `${active.rf.tirePress || '11.0'} psi`,
                            lr: `${active.lr.tirePress || '8.0'} psi`,
                            rr: `${active.rr.tirePress || '8.0'} psi`,
                          };
                          const liveTires = {
                            lf: {
                              tireId: prev.tires?.lf.tireId || '',
                              compound: active.lf.tireComp || prev.tires?.lf.compound || '',
                              size: active.lf.tireSize || prev.tires?.lf.size || '',
                              durometer: prev.tires?.lf.durometer || '',
                              airPressure: `${active.lf.tirePress || '10.0'} psi`,
                              backSpacing: prev.tires?.lf.backSpacing || '',
                            },
                            rf: {
                              tireId: prev.tires?.rf.tireId || '',
                              compound: active.rf.tireComp || prev.tires?.rf.compound || '',
                              size: active.rf.tireSize || prev.tires?.rf.size || '',
                              durometer: prev.tires?.rf.durometer || '',
                              airPressure: `${active.rf.tirePress || '11.0'} psi`,
                              backSpacing: prev.tires?.rf.backSpacing || '',
                            },
                            lr: {
                              tireId: prev.tires?.lr.tireId || '',
                              compound: active.lr.tireComp || prev.tires?.lr.compound || '',
                              size: active.lr.tireSize || prev.tires?.lr.size || '',
                              durometer: prev.tires?.lr.durometer || '',
                              airPressure: `${active.lr.tirePress || '8.0'} psi`,
                              backSpacing: prev.tires?.lr.backSpacing || '',
                            },
                            rr: {
                              tireId: prev.tires?.rr.tireId || '',
                              compound: active.rr.tireComp || prev.tires?.rr.compound || '',
                              size: active.rr.tireSize || prev.tires?.rr.size || '',
                              durometer: prev.tires?.rr.durometer || '',
                              airPressure: `${active.rr.tirePress || '8.0'} psi`,
                              backSpacing: prev.tires?.rr.backSpacing || '',
                            },
                          };
                          const updated = {
                            ...prev,
                            setupUsed: active.chassis.toUpperCase(),
                            pressures: livePressures,
                            tires: liveTires,
                          };
                          localStorage.setItem('race_notes_active_session', JSON.stringify(updated));
                          return updated;
                        });
                      }
                    }
                  }}
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
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'dashboard' ? "'FILL' 1" : "'FILL' 0" }}
            >
              dashboard
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              Dashboard
            </span>
          </button>

          {/* Setups Button */}
          <button
            onClick={() => setActiveTab('setups')}
            id="tab-btn-setups"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'setups' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'setups' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings_input_component
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              Setups
            </span>
          </button>

          {/* Race Weekend Button */}
          <button
            onClick={() => setActiveTab('raceweekend')}
            id="tab-btn-raceweekend"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'raceweekend' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'raceweekend' ? "'FILL' 1" : "'FILL' 0" }}
            >
              timer
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              Sessions
            </span>
          </button>

          {/* Trackers Button */}
          <button onClick={() => setActiveTab('trackers')}
            id="tab-btn-trackers"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'trackers' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: activeTab === 'trackers' ? "'FILL' 1" : "'FILL' 0" }}>
              monitoring
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              Trackers
            </span>
          </button>

          {/* [27] Reference tab removed — QuickRef opens via the header ? button */}

          {/* Settings Button */}
          <button
            onClick={() => setActiveTab('settings')}
            id="tab-btn-settings"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'settings' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'settings' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
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
