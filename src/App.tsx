import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';
import { Setup, SessionRecord, ActiveSession, RaceWeekend, AppTheme, TireInventoryItem } from './types';
import {
  INITIAL_SETUP,
  INITIAL_SETUPS,
  INITIAL_WEEKENDS,
  INITIAL_ACTIVE_SESSION,
} from './data';

import { supabase, onAuthChange, fetchProfile, getUserTeam, AppUser } from './lib/supabase';
import { pushSetups, pushWeekends, pushActiveSession, pullAllData, mergeIntoLocalStorage, pullTodos, pushTodos } from './lib/sync';

import DashboardView from './components/DashboardView';
import SetupView from './components/SetupView';
import RaceWeekendView from './components/RaceWeekendView';
import SettingsView from './components/SettingsView';
import QuickReferenceView from './components/QuickReferenceView';
import ToDoView from './components/ToDoView';
import { Todo } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'todos'>('dashboard');
  const [setup, setSetup] = useState<Setup>(INITIAL_SETUP);
  const [savedSetups, setSavedSetups] = useState<Setup[]>(INITIAL_SETUPS);
  const [weekends, setWeekends] = useState<RaceWeekend[]>(INITIAL_WEEKENDS);
  const [activeSession, setActiveSession] = useState<ActiveSession>(INITIAL_ACTIVE_SESSION);
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('race_notes_todos');
    return saved ? JSON.parse(saved) : [];
  });

  const [tireInventory, setTireInventory] = useState<TireInventoryItem[]>(() => {
    const saved = localStorage.getItem('race_notes_tires');
    return saved ? JSON.parse(saved) : [];
  });

  const handleSaveTires = (updated: TireInventoryItem[]) => {
    setTireInventory(updated);
    localStorage.setItem('race_notes_tires', JSON.stringify(updated));
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('race_notes_theme');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { mode: 'dark', accent: '#ffb3ac' };
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
  }, [theme]);

  // ---- Auth & Cloud Sync State ----
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [team, setTeam] = useState<import('./types').Team | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  // Modal / forms tracking state
  const [showNewWeekendForm, setShowNewWeekendForm] = useState(false);
  const [newWeekendName, setNewWeekendName] = useState('');
  const [newWeekendTrack, setNewWeekendTrack] = useState('');
  const [newWeekendDate, setNewWeekendDate] = useState('');

  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [newSessionWeekendId, setNewSessionWeekendId] = useState(INITIAL_WEEKENDS[0]?.id || '');
  const [newSessionTrack, setNewSessionTrack] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionType, setNewSessionType] = useState('');
  const [newSessionCond, setNewSessionCond] = useState('');
  const [newSessionWeather, setNewSessionWeather] = useState('');

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
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
          const t = await getUserTeam(currentUser.id);
          setTeam(t);
        }
      } catch {
        // Supabase not configured yet – continue in offline mode
      }
      setAuthReady(true);
    };
    initAuth();

    const unsub = onAuthChange(async (newUser) => {
      setUser(newUser);
      if (newUser) {
        const p = await fetchProfile(newUser.id);
        setProfile(p);
        const t = await getUserTeam(newUser.id);
        setTeam(t);
      } else {
        setProfile(null);
        setTeam(null);
      }
    });
    return () => { unsub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // ---- Cloud sync: pull on login, push on data changes ----
  useEffect(() => {
    if (!user) return;

    // Pull cloud data and merge into localStorage
    const doPull = async () => {
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

      setSyncStatus('Synced');
      setTimeout(() => setSyncStatus(''), 3000);
    };

    doPull();
  }, [user]);

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

  const handleCreateNewWeekend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeekendName.trim() || !newWeekendTrack.trim()) return;

    const newWknd: RaceWeekend = {
      id: `wknd-${Date.now()}`,
      name: newWeekendName,
      track: newWeekendTrack,
      date: newWeekendDate || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      sessions: []
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

    const nextSession: ActiveSession = {
      name: newSessionName.toUpperCase() || 'SESSION',
      track: targetWeekend.track,
      setupUsed: setup.chassis.toUpperCase(),
      condition: newSessionCond || '',
      weather: newSessionWeather || '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      type: newSessionType.toUpperCase() || 'SESS',
      name: newSessionName || 'Session',
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
      time: nextSession.time,
      weather: nextSession.weather,
      setupUsed: nextSession.setupUsed,
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
    setNewSessionName('');
    setNewSessionType('');
    setNewSessionCond('');
    setNewSessionWeather('');
    setActiveTab('raceweekend');
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
    };
    setActiveSession(restoredSession);
  };

  return (
    <div className="h-full w-full bg-[#0e0e0e] text-on-surface font-sans flex flex-col items-center justify-start p-0" id="applet-main-body">

      {/* Main Core Layout Viewport Container suitable for PWA deployment */}
      <div
        id="viewport-chassis"
        className="w-full max-w-2xl mx-auto bg-background h-full flex flex-col shadow-none md:shadow-2xl md:border-x border-outline-variant/20"
      >
        {/* TopAppBar component with logo title & dual NEW entries triggers */}
        <header className="bg-surface w-full top-0 sticky border-b border-outline-variant z-40">
          <div className="flex justify-between items-center px-4 py-3 w-full">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Sync status indicator */}
              {syncStatus && (
                <span className={`font-mono text-[9px] uppercase tracking-wider ${
                  syncStatus === 'Synced' ? 'text-green-400' : 'text-on-surface-variant/60'
                }`}>
                  {syncStatus}
                </span>
              )}
              <button
                onClick={() => {
                  setNewWeekendName('');
                  setNewWeekendTrack('');
                  setNewWeekendDate(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
                  setShowNewWeekendForm(true);
                }}
                id="top-action-new-weekend"
                className="font-mono text-[10px] text-on-surface-variant hover:text-on-surface uppercase hover:bg-surface-container-high transition-colors px-2 py-1 active:opacity-80 border border-outline-variant/60 font-semibold rounded-sm"
              >
                + WEEKEND
              </button>
              <button
                onClick={() => {
                  if (weekends.length > 0) {
                    setNewSessionWeekendId(weekends[0].id);
                  }
                  setNewSessionName('');
                  setNewSessionType('');
                  setNewSessionCond('');
                  setNewSessionWeather('');
                  setShowNewSessionForm(true);
                }}
                id="top-action-new-session"
                className="font-mono text-[10px] text-primary hover:text-primary-fixed uppercase hover:bg-surface-container-high transition-colors px-2 py-1 active:opacity-80 border border-outline-variant/60 font-semibold rounded-sm"
              >
                + SESSION
              </button>
            </div>
          </div>
        </header>

        {/* Core Main Active Canvas Area */}
        <main className="flex-grow p-4 overflow-y-auto pb-6 custom-scrollbar">
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
                  setup={setup}
                  weekends={weekends}
                  team={team}
                  onStartNewWeekend={() => {
                    setNewWeekendName('');
                    setNewWeekendTrack('');
                    setNewWeekendDate(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
                    setShowNewWeekendForm(true);
                  }}
                  onStartNewSession={() => {
                    if (weekends.length > 0) {
                      setNewSessionWeekendId(weekends[0].id);
                    }
                    setNewSessionName('');
                    setNewSessionType('');
                    setNewSessionCond('');
                    setNewSessionWeather('');
                    setShowNewSessionForm(true);
                  }}
                  onEditSetup={() => setActiveTab('setups')}
                  onSelectSession={(rec, weekendId) => {
                    handleSelectRecentSession(rec, weekendId || '');
                    setActiveTab('raceweekend');
                  }}
                />
              )}

              {activeTab === 'setups' && (
                <SetupView
                  savedSetups={savedSetups}
                  activeSetupId={setup.id}
                  user={user}
                  tireInventory={tireInventory}
                  onSaveTires={handleSaveTires}
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
                  onUpdateSession={handleUpdateSession}
                  onSelectSession={(rec, weekendId) => handleSelectRecentSession(rec, weekendId)}
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
                />
              )}

              {activeTab === 'quickref' && (
                <QuickReferenceView />
              )}


              {activeTab === 'todos' && (
                <ToDoView 
                  todos={todos} 
                  onSaveTodos={(updated) => {
                    setTodos(updated);
                    localStorage.setItem('race_notes_todos', JSON.stringify(updated));
                    if (user) pushTodos(updated, user.id, setSyncStatus);
                  }} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Global Bottom Tab Navigation bar */}
        <nav
          className="bg-surface-container border-t border-outline-variant z-40 flex justify-around items-center h-16 px-2 sticky bottom-0 w-full flex-shrink-0"
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

          {/* To Do List Button */}
          <button onClick={() => setActiveTab('todos')}
            id="tab-btn-todos"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all cursor-pointer ${
              activeTab === 'todos' ? 'text-primary scale-105' : 'text-on-surface-variant/80 hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[20px]" 
                  style={{ fontVariationSettings: activeTab === 'todos' ? "'FILL' 1" : "'FILL' 0" }}>
              checklist
            </span>
            <span className="font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-wider">
              To Do
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
              <form onSubmit={handleCreateNewSession} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                    Select Race Weekend
                  </label>
                  <select
                    value={newSessionWeekendId}
                    onChange={(e) => {
                      setNewSessionWeekendId(e.target.value);
                      const selected = weekends.find(w => w.id === e.target.value);
                      if (selected) {
                        setNewSessionTrack(selected.track);
                      }
                    }}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                  >
                    {weekends.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.track})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                      Session Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Heat 1"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      className="w-full bg-[#141414] text-xs text-on-surface p-2 border border-outline-variant focus:border-primary rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                      Label Tag (Type)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      placeholder="e.g. H1"
                      value={newSessionType}
                      onChange={(e) => setNewSessionType(e.target.value)}
                      className="w-full bg-[#141414] text-xs text-on-surface p-2 border border-outline-variant focus:border-primary rounded font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                    Surface Conditions
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tacky Clay"
                    value={newSessionCond}
                    onChange={(e) => setNewSessionCond(e.target.value)}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2 border border-outline-variant focus:border-primary rounded"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#aca9a8] mb-1">
                    Weather Temp/Conditions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 78°F, Clear"
                    value={newSessionWeather}
                    onChange={(e) => setNewSessionWeather(e.target.value)}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2 border border-outline-variant focus:border-primary rounded"
                  />
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
                    INITIALIZE SESSION
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
