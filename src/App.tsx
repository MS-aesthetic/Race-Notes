import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Setup, SessionRecord, ActiveSession, RaceWeekend, AppTheme, TireInventoryItem, AccountingEntry, ShoppingItem, Car, ShockSession, CAR_TYPES } from './types';
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
import { pushSetups, pushWeekends, pushActiveSession, pullAllData, mergeIntoLocalStorage, pullTodos, pushTodos, deleteWeekendFromCloud, pushTires, pullTires, deleteTireFromCloud, pushCars, pullCars, deleteCarFromCloud, pushShockSessions, pullShockSessions } from './lib/sync';

import DashboardView from './components/DashboardView';
import SetupView from './components/SetupView';
import RaceWeekendView from './components/RaceWeekendView';
import SettingsView from './components/SettingsView';
import QuickReferenceView from './components/QuickReferenceView';
import TrackersView from './components/TrackersView';
import { Todo } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers'>('dashboard');
  const [setup, setSetup] = useState<Setup>(INITIAL_SETUP);
  const [savedSetups, setSavedSetups] = useState<Setup[]>(INITIAL_SETUPS);
  const [weekends, setWeekends] = useState<RaceWeekend[]>(INITIAL_WEEKENDS);
  const [activeSession, setActiveSession] = useState<ActiveSession>(INITIAL_ACTIVE_SESSION);
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('race_notes_todos');
    return saved ? JSON.parse(saved) : [];
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

  // Lifted smasher/shock-session state (Decision 1: cloud sync)
  const [shockSessions, setShockSessions] = useState<ShockSession[]>(() => {
    try { const s = localStorage.getItem('race_notes_shock_graphs'); return s ? JSON.parse(s) : INITIAL_SHOCK_SESSIONS; }
    catch { return INITIAL_SHOCK_SESSIONS; }
  });

  const activeCar = cars.find(c => c.id === activeCarId) ?? null;

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
    setActiveCarId(carId);
    localStorage.setItem('race_notes_active_car', carId);
    // No data reload — views re-filter on activeCarId
  };

  const handleSaveShockSessions = (updated: ShockSession[]) => {
    setShockSessions(updated);
    localStorage.setItem('race_notes_shock_graphs', JSON.stringify(updated));
    if (user) pushShockSessions(updated, user.id, setSyncStatus);
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
    setTireInventory([]);
    setCars([]);
    setShockSessions([]);
    setActiveCarId(null);
    setActiveSession(INITIAL_ACTIVE_SESSION);
    setTodos([]);
    setAccounting([]);
    setShopping([]);
    setSyncStatus('All data cleared');
  };

  // Count helpers for GarageView / delete guard
  const carSetupCount = (carId: string) => savedSetups.filter(s => s.carId === carId).length;
  const carTireCount = (carId: string) => tireInventory.filter(t => t.carId === carId).length;
  const carShockCount = (carId: string) => shockSessions.filter(s => s.carId === carId).length;

  // Navigate to Settings → Garage from the active-car chip
  const [settingsSubTab, setSettingsSubTab] = useState<'account' | 'appearance' | 'export' | 'garage' | 'guide'>('account');

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('race_notes_theme');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { mode: 'dark', accent: '#ffb3ac', fontSize: 'standard' };
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
  }, [setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping]);

  // Auto-dismiss any sync status so a message can never get "stuck" on screen.
  // 'Syncing...' is left alone (it's replaced by 'Synced' when the pull finishes).
  useEffect(() => {
    if (!syncStatus || syncStatus === 'Syncing...') return;
    const t = setTimeout(() => setSyncStatus(''), 2500);
    return () => clearTimeout(t);
  }, [syncStatus]);

  // Modal / forms tracking state
  const [showNewWeekendForm, setShowNewWeekendForm] = useState(false);
  const [newWeekendName, setNewWeekendName] = useState('');
  const [newWeekendTrack, setNewWeekendTrack] = useState('');
  const [newWeekendDate, setNewWeekendDate] = useState('');

  // New weekend form — setup binding
  const [newWeekendSetupId, setNewWeekendSetupId] = useState('');

  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [newSessionWeekendId, setNewSessionWeekendId] = useState(INITIAL_WEEKENDS[0]?.id || '');
  const [newSessionTrack, setNewSessionTrack] = useState('');
  const [newSessionType, setNewSessionType] = useState<'Test' | 'Hot Laps' | 'Qualifying' | 'Heat Race' | 'Feature'>('Test');
  const [newSessionCond, setNewSessionCond] = useState('');
  const [newSessionTimeOfDay, setNewSessionTimeOfDay] = useState<'current' | 'Afternoon' | 'Evening' | 'Night'>('current');
  // Session weather fetch state
  const [sessionWeatherStr, setSessionWeatherStr] = useState('');
  const [sessionWeatherLoading, setSessionWeatherLoading] = useState(false);
  const [sessionWeatherError, setSessionWeatherError] = useState('');
  const [showSessionZipInput, setShowSessionZipInput] = useState(false);
  const [sessionZipCode, setSessionZipCode] = useState('');

  // Clock state matching real timing context
  const [timeStr, setTimeStr] = useState('11:20 AM');

  useEffect(() => {
    // Attempt load from localStorage for state durability if available
    const savedSetup = localStorage.getItem('race_notes_setup');
    const savedSetupsData = localStorage.getItem('race_notes_saved_setups');
    const savedWeekends = localStorage.getItem('race_notes_weekends');
    const savedActive = localStorage.getItem('race_notes_active_session');

    if (savedSetup) {
      try { setSetup(JSON.parse(savedSetup)); } catch { /* ignore */ }
    }
    if (savedSetupsData) {
      try { setSavedSetups(JSON.parse(savedSetupsData)); } catch { /* ignore */ }
    }
    if (savedWeekends) {
      try {
        const parsed = JSON.parse(savedWeekends);
        setWeekends(parsed);
        if (parsed.length > 0) {
          setNewSessionWeekendId(parsed[0].id);
        }
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
        setTodos(cloudTodos);
        localStorage.setItem('race_notes_todos', JSON.stringify(cloudTodos));
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

      setSyncStatus('Synced');
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

  // ── Session weather helpers ──────────────────────────────────────────────────

  const weatherCodeToStr = (code: number): string => {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Fog';
    if (code <= 29) return 'Rain';
    if (code <= 39) return 'Snow';
    if (code <= 59) return 'Drizzle';
    if (code <= 69) return 'Rain';
    if (code <= 79) return 'Snow';
    if (code <= 84) return 'Rain Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
  };

  const fetchSessionWeatherFromCoords = async (lat: number, lon: number) => {
    let location = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const gj = await geo.json();
      const city = gj.address?.city || gj.address?.town || gj.address?.village || gj.address?.county || '';
      const state = gj.address?.state_code || '';
      if (city || state) location = [city, state].filter(Boolean).join(', ');
    } catch { /* keep coords */ }
    const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`);
    const wj = await wr.json();
    const temp = Math.round(wj.current.temperature_2m);
    const cond = weatherCodeToStr(wj.current.weather_code);
    setSessionWeatherStr(`${temp}°F, ${cond} — ${location}`);
    setSessionWeatherLoading(false);
  };

  const handleSessionGPSWeather = () => {
    setSessionWeatherLoading(true); setSessionWeatherError(''); setSessionWeatherStr('');
    if (!navigator.geolocation) {
      setSessionWeatherError('GPS not available.'); setSessionWeatherLoading(false); setShowSessionZipInput(true); return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try { await fetchSessionWeatherFromCoords(pos.coords.latitude, pos.coords.longitude); }
        catch { setSessionWeatherError('Could not fetch weather.'); setSessionWeatherLoading(false); }
      },
      err => {
        setSessionWeatherError(err.code === 1 ? 'Location denied — enter zip code.' : 'Could not get location.');
        setSessionWeatherLoading(false); setShowSessionZipInput(true);
      },
      { timeout: 10000 }
    );
  };

  const handleSessionZipWeather = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionZipCode.trim()) return;
    setSessionWeatherLoading(true); setSessionWeatherError('');
    try {
      const gr = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${sessionZipCode.trim()}&country=US&format=json&limit=1`);
      const gj = await gr.json();
      if (!gj.length) { setSessionWeatherError('Zip not found.'); setSessionWeatherLoading(false); return; }
      await fetchSessionWeatherFromCoords(parseFloat(gj[0].lat), parseFloat(gj[0].lon));
      setShowSessionZipInput(false); setSessionZipCode('');
    } catch { setSessionWeatherError('Could not fetch weather.'); setSessionWeatherLoading(false); }
  };

  // ── Open session creation form ────────────────────────────────────────────────

  const handleOpenNewSessionForm = (preferWeekendId?: string) => {
    // Validate the preferred ID exists; fall back to most recent weekend
    const validIds = new Set(weekends.map(w => w.id));
    const candidate = preferWeekendId || activeSession.weekendId || newSessionWeekendId;
    const targetId = (candidate && validIds.has(candidate)) ? candidate : (weekends[weekends.length - 1]?.id ?? '');
    if (targetId) setNewSessionWeekendId(targetId);
    setNewSessionType('Test');
    setNewSessionCond('');
    setSessionWeatherStr('');
    setSessionWeatherError('');
    setShowSessionZipInput(false);
    setSessionZipCode('');
    setNewSessionTimeOfDay('current');
    setShowNewSessionForm(true);
  };

  // ── Session type → short code mapping ────────────────────────────────────────

  const SESSION_CODES: Record<string, string> = {
    'Test': 'Test',
    'Hot Laps': 'HL',
    'Qualifying': 'Qual',
    'Heat Race': 'Heat',
    'Feature': 'Feat.',
  };

  // ── Auto-number session name ─────────────────────────────────────────────────

  const buildSessionName = (type: string, weekendId: string): string => {
    const code = SESSION_CODES[type] ?? type;
    const weekend = weekends.find(w => w.id === weekendId);
    if (!weekend) return code;
    const existing = weekend.sessions.filter(s => s.name === code || s.name.startsWith(`${code} `));
    if (existing.length === 0) return code;
    return `${code} ${existing.length + 1}`;
  };

  const handleCreateNewWeekend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeekendName.trim() || !newWeekendTrack.trim()) return;

    const boundSetup = savedSetups.find(s => s.id === newWeekendSetupId) || null;

    const newWknd: RaceWeekend = {
      id: `wknd-${Date.now()}`,
      name: newWeekendName,
      track: newWeekendTrack,
      date: newWeekendDate || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
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

    setNewSessionWeekendId(newWknd.id);
    setNewSessionTrack(newWknd.track);
    setShowNewWeekendForm(false);
    // Open session form directly for convenience after weekend is made
    setShowNewSessionForm(true);
  };

  const handleCreateNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionWeekendId) return;

    const targetWeekend = weekends.find(w => w.id === newSessionWeekendId);
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

    // Auto-number session name
    const sessionName = buildSessionName(newSessionType, newSessionWeekendId);

    // Resolve time
    const resolvedTime = newSessionTimeOfDay === 'current'
      ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : newSessionTimeOfDay;

    const nextSession: ActiveSession = {
      sessionType: newSessionType,
      name: sessionName,
      track: targetWeekend.track,
      setupUsed: setup.chassis || 'Default Setup',
      condition: newSessionCond || '',
      weather: sessionWeatherStr || '',
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
      tires: defaultTires,
      pressures: defaultPressures,
      competitionNotes: '',
      screenshots: []
    };

    const newRecord: SessionRecord = {
      id: `session-rec-${Date.now()}`,
      type: sessionName,
      sessionType: newSessionType,
      name: sessionName,
      track: targetWeekend.track,
      condition: newSessionCond,
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
      tires: defaultTires,
      pressures: defaultPressures,
      competitionNotes: '',
      time: resolvedTime,
      weather: sessionWeatherStr || '',
      setupUsed: setup.chassis || 'Default Setup',
      screenshots: []
    };

    nextSession.id = newRecord.id;
    nextSession.weekendId = newSessionWeekendId;

    setWeekends((prev) => {
      const updated = prev.map(w => w.id === targetWeekend.id ? {
        ...w,
        sessions: [newRecord, ...w.sessions]
      } : w);
      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (user) pushWeekends(updated, user.id);
      return updated;
    });

    setActiveSession(nextSession);
    localStorage.setItem('race_notes_active_session', JSON.stringify(nextSession));

    setShowNewSessionForm(false);
    setNewSessionType('Test');
    setNewSessionCond('');
    setSessionWeatherStr('');
    setSessionWeatherError('');
    setShowSessionZipInput(false);
    setSessionZipCode('');
    setNewSessionTimeOfDay('current');
    setActiveTab('raceweekend');
  };

  const handleDeleteWeekend = (weekendId: string) => {
    if (!window.confirm('Delete this race weekend and all its sessions? This cannot be undone.')) return;
    const updated = weekends.filter(w => w.id !== weekendId);
    setWeekends(updated);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
    // Hard-delete from cloud so it doesn't come back on next sync pull
    deleteWeekendFromCloud(weekendId);
    if (user) pushWeekends(updated, user.id);
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
  };

  const handleUpdateWeekend = (updated: RaceWeekend) => {
    const updatedList = weekends.map(w => w.id === updated.id ? updated : w);
    setWeekends(updatedList);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedList));
    if (user) pushWeekends(updatedList, user.id);
  };

  const handleSelectRecentSession = (rec: SessionRecord, weekendId: string) => {
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
  };

  // ---- Auth gate: registration/sign-in is required to use the app. -------
  // `authReady` flips true as soon as the (local, non-blocking) session
  // check finishes. `hasLocalAcct` is our own durable flag (see
  // rememberLocalAccount) so a device that has signed in before keeps
  // working with no signal — only an explicit sign-out re-locks the gate.
  const isUnlocked = !!user || hasLocalAcct;

  if (!authReady) {
    return (
      <div className="h-full w-full bg-[#0e0e0e] flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-3xl animate-pulse">headset_mic</span>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-full w-full bg-[#0e0e0e] text-on-surface font-sans flex flex-col items-center justify-start p-0" id="applet-auth-gate">
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
    <div className="h-full w-full bg-[#0e0e0e] text-on-surface font-sans flex flex-col items-center justify-start p-0" id="applet-main-body">

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
            
            <div className="flex items-center gap-2">
              {/* Help / Guide */}
              <button
                onClick={() => { setSettingsSubTab('guide'); setActiveTab('settings'); }}
                aria-label="Open the how-to guide"
                title="How to use CREW CHIEF"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant/60 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">help</span>
              </button>
              {/* Active-car chip */}
              {activeCar ? (
                <button
                  onClick={() => { setSettingsSubTab('garage'); setActiveTab('settings'); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-wider font-bold hover:bg-primary/20 transition-colors"
                  title="Switch car in Garage"
                >
                  <span className="material-symbols-outlined text-[12px]">directions_car</span>
                  <span className="truncate max-w-[80px]">{activeCar.name || `${activeCar.chassis} · ${activeCar.carType}`}</span>
                </button>
              ) : cars.length === 0 ? (
                <button
                  onClick={() => { setSettingsSubTab('garage'); setActiveTab('settings'); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border border-outline-variant/50 text-on-surface-variant/60 font-mono text-[10px] uppercase tracking-wider hover:border-primary/40 hover:text-primary/70 transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">add</span>
                  Add Car
                </button>
              ) : null}
{/* +Session moved into RaceWeekendView as a prominent top-center button */}
            </div>
          </div>
        </header>

        {/* Single brief Saved / sync toast — bottom-center, above the nav bar.
            Only three states surface: local "Saved", initial "Syncing…", and
            "Synced". The chatty per-entity "X synced to cloud" push messages are
            intentionally NOT shown (they just quietly clear via the auto-dismiss
            effect) so users see at most one short confirmation per action. */}
        {(() => {
          const isBusy = !savedFlash && syncStatus === 'Syncing...';
          const isSynced = !savedFlash && syncStatus === 'Synced';
          if (!savedFlash && !isBusy && !isSynced) return null;
          const msg = savedFlash ? 'Saved' : isBusy ? 'Syncing…' : 'Synced';
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
                  {isSuccess ? 'check_circle' : isBusy ? 'progress_activity' : 'cloud'}
                </span>
                {msg}
              </div>
            </div>
          );
        })()}

        {/* Core Main Active Canvas Area */}
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto pb-6 custom-scrollbar">
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
                  onStartNewWeekend={() => {
                    setNewWeekendName('');
                    setNewWeekendTrack('');
                    setNewWeekendDate(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
                    setShowNewWeekendForm(true);
                  }}
                  onStartNewSession={() => handleOpenNewSessionForm()}
                  onSelectSession={(rec, weekendId) => {
                    handleSelectRecentSession(rec, weekendId || '');
                    setActiveTab('raceweekend');
                  }}
                  onSelectSetup={(setupId) => {
                    const found = savedSetups.find(s => s.id === setupId);
                    if (found) setSetup(found);
                    setActiveTab('setups');
                  }}
                  onGoToTodos={() => setActiveTab('trackers')}
                  onDeleteWeekend={handleDeleteWeekend}
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
                  user={user}
                  session={activeSession}
                  weekends={weekends}
                  tireInventory={tireInventory}
                  savedSetups={savedSetups}
                  onUpdateSession={handleUpdateSession}
                  onUpdateWeekend={handleUpdateWeekend}
                  onDeleteSession={handleDeleteSession}
                  onSelectSession={(rec, weekendId) => handleSelectRecentSession(rec, weekendId)}
                  onNewSession={() => handleOpenNewSessionForm(activeSession.weekendId)}
                  onNewWeekend={() => {
                    setNewWeekendName('');
                    setNewWeekendTrack('');
                    setNewWeekendDate(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
                    setShowNewWeekendForm(true);
                  }}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  user={user}
                  profile={profile}
                  onAuthChange={(u) => setUser(u)}
                  setup={setup}
                  activeSession={activeSession}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  weekends={weekends}
                  todos={todos}
                  accounting={accounting}
                  shopping={shopping}
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
                />
              )}

              {activeTab === 'quickref' && (
                <QuickReferenceView />
              )}


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
                  shopping={shopping}
                  onSaveShopping={(updated) => {
                    setShopping(updated);
                    localStorage.setItem('race_notes_shopping', JSON.stringify(updated));
                  }}
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

          {/* Reference Button */}
          <button
            onClick={() => setActiveTab('quickref')}
            id="tab-btn-quickref"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'quickref' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: activeTab === 'quickref' ? "'FILL' 1" : "'FILL' 0" }}
            >
              menu_book
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              Reference
            </span>
          </button>

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

      {/* NEW WEEKEND FORM DIALOG */}
      {showNewWeekendForm && (
        <div className="fixed inset-0 bg-[#000000d5] backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in shadow-2xl">
          <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface">
            <button
              onClick={() => setShowNewWeekendForm(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            
            <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
              <span className="material-symbols-outlined text-primary">calendar_today</span>
              <h3 className="font-display text-base font-bold uppercase text-on-surface tracking-wide">
                Create Race Weekend
              </h3>
            </div>

            <form onSubmit={handleCreateNewWeekend} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                  Weekend Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Knoxville Nationals"
                  value={newWeekendName}
                  onChange={(e) => setNewWeekendName(e.target.value)}
                  className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                  Track Name / Speedway
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Knoxville Raceway"
                  value={newWeekendTrack}
                  onChange={(e) => setNewWeekendTrack(e.target.value)}
                  className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                  Date Range
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. June 12-14, 2026"
                  value={newWeekendDate}
                  onChange={(e) => setNewWeekendDate(e.target.value)}
                  className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                />
              </div>

              {savedSetups.length > 0 && (
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                    Bind a Setup (optional)
                  </label>
                  <div className="relative">
                    <select
                      value={newWeekendSetupId}
                      onChange={e => setNewWeekendSetupId(e.target.value)}
                      className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded appearance-none pr-7"
                    >
                      <option value="">-- No setup selected --</option>
                      {/* Decision 3: filter to active car's setups */}
                      {savedSetups.filter(s => !activeCarId || s.carId === activeCarId).map(s => (
                        <option key={s.id} value={s.id}>{s.chassis}{s.carType ? ` (${s.carType})` : ''}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[14px]">expand_more</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 justify-end text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setShowNewWeekendForm(false)}
                  className="px-3 py-2 border border-outline-variant hover:bg-[#1a1a1a] text-on-surface-variant uppercase cursor-pointer rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary font-bold uppercase hover:bg-primary-fixed-dim cursor-pointer rounded"
                >
                  CREATE WEEKEND
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SESSION FORM DIALOG / DRAWER POPUP */}
      {showNewSessionForm && (
        <div className="fixed inset-0 bg-[#000000d5] backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in shadow-2xl">
          <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface">
            <button
              onClick={() => setShowNewSessionForm(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            
            <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
              <span className="material-symbols-outlined text-primary">add_circle</span>
              <h3 className="font-display text-base font-bold uppercase text-on-surface tracking-wide">
                Start New Logger Session
              </h3>
            </div>

            {weekends.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-on-surface-variant uppercase font-mono">No race weekends found.</p>
                <p className="text-[11px] text-[#aeaaae] mb-2">Create a Race Weekend event first to log sessions under it!</p>
                <button
                  onClick={() => {
                    setShowNewSessionForm(false);
                    setShowNewWeekendForm(true);
                  }}
                  className="px-4 py-2 bg-primary text-on-primary font-bold text-xs uppercase cursor-pointer rounded block w-full"
                >
                  Create Race Weekend
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateNewSession} className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                {/* Weekend selector */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Race Weekend</label>
                  <div className="relative">
                    <select
                      value={newSessionWeekendId}
                      onChange={(e) => {
                        setNewSessionWeekendId(e.target.value);
                        const selected = weekends.find(w => w.id === e.target.value);
                        if (selected) setNewSessionTrack(selected.track);
                      }}
                      className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded appearance-none pr-7"
                    >
                      {weekends.map((w) => (
                        <option key={w.id} value={w.id}>{w.name} ({w.track})</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[14px]">expand_more</span>
                  </div>
                </div>

                {/* Session type */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">Session Type</label>
                  <div className="grid grid-cols-5 gap-1">
                    {([
                      { key: 'Test', code: 'Test' },
                      { key: 'Hot Laps', code: 'HL' },
                      { key: 'Qualifying', code: 'Qual' },
                      { key: 'Heat Race', code: 'Heat' },
                      { key: 'Feature', code: 'Feat.' },
                    ] as const).map(({ key, code }) => (
                      <button
                        key={key}
                        type="button"
                        title={key}
                        onClick={() => setNewSessionType(key)}
                        className={`py-2 px-1 rounded border font-mono text-[10px] font-bold uppercase transition-all text-center leading-tight ${
                          newSessionType === key
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'border-outline-variant/50 text-on-surface-variant/70 hover:border-outline-variant'
                        }`}
                      >{code}</button>
                    ))}
                  </div>
                  {newSessionWeekendId && (
                    <p className="font-mono text-[10px] text-on-surface-variant/50 mt-1">
                      Will be named: <span className="text-primary font-bold">{buildSessionName(newSessionType, newSessionWeekendId)}</span>
                    </p>
                  )}
                </div>

                {/* Surface conditions */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">Surface Conditions</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tacky Clay"
                    value={newSessionCond}
                    onChange={(e) => setNewSessionCond(e.target.value)}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2 border border-outline-variant focus:border-primary rounded"
                  />
                </div>

                {/* Time of Day */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">Time of Day</label>
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      { value: 'current', label: 'Current Time' },
                      { value: 'Afternoon', label: 'Afternoon' },
                      { value: 'Evening', label: 'Evening' },
                      { value: 'Night', label: 'Night' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewSessionTimeOfDay(opt.value)}
                        className={`py-2 px-1 rounded border font-mono text-[9px] font-bold uppercase transition-all text-center leading-tight ${
                          newSessionTimeOfDay === opt.value
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'border-outline-variant/50 text-on-surface-variant/70 hover:border-outline-variant'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                {/* Weather */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">Weather (optional)</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={handleSessionGPSWeather}
                      disabled={sessionWeatherLoading}
                      className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[13px]">my_location</span>
                      {sessionWeatherLoading ? 'Fetching…' : 'GPS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSessionZipInput(v => !v)}
                      className={`flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded border transition-colors ${showSessionZipInput ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined text-[13px]">pin_drop</span>
                      Zip
                    </button>
                    {sessionWeatherStr && (
                      <button type="button" onClick={() => { setSessionWeatherStr(''); setSessionWeatherError(''); }} className="ml-auto text-[10px] font-mono text-on-surface-variant/50 hover:text-error">clear</button>
                    )}
                  </div>
                  {showSessionZipInput && (
                    <form onSubmit={handleSessionZipWeather} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="ZIP code"
                        value={sessionZipCode}
                        onChange={e => setSessionZipCode(e.target.value)}
                        className="flex-1 bg-[#141414] border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-xs text-on-surface outline-none"
                      />
                      <button type="submit" disabled={sessionWeatherLoading} className="bg-primary text-on-primary px-3 py-2 rounded font-mono text-[10px] font-bold uppercase disabled:opacity-50">
                        {sessionWeatherLoading ? '…' : 'Get'}
                      </button>
                    </form>
                  )}
                  {sessionWeatherError && <p className="font-mono text-[11px] text-red-400 mb-1">{sessionWeatherError}</p>}
                  {sessionWeatherStr ? (
                    <div className="bg-[#141414] border border-primary/30 rounded px-3 py-2 font-mono text-xs text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud</span>
                      {sessionWeatherStr}
                    </div>
                  ) : (
                    <p className="font-mono text-[10px] text-on-surface-variant/40 italic">No weather fetched — session will log without it.</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2 justify-end text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setShowNewSessionForm(false)}
                    className="px-3 py-2 border border-outline-variant hover:bg-[#1a1a1a] text-[#cac7c6] uppercase cursor-pointer rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary font-bold uppercase hover:bg-primary-fixed-dim cursor-pointer rounded"
                  >
                    START SESSION
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
