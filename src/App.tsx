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

import { supabase, onAuthChange, fetchProfile, getUserTeam, getTeamMembers, handleNativeAuthCallback, rememberLocalAccount, hasLocalAccount, deleteAccount as deleteCloudAccount, AppUser } from './lib/supabase';
import AuthView from './components/AuthView';
import { pushSetups, pushWeekends, pushActiveSession, pullAllData, pullTodos, pushTodos, pushTires, pullTires, deleteTireFromCloud, pushCars, pullCars, pushShockSessions, pullShockSessions, pushMaintenanceComponents, pullMaintenanceComponents, pushMaintenanceLogs, pullMaintenanceLogs, pushChecklistTemplates, pullChecklistTemplates, pushWeekendChecklists, pullWeekendChecklists, deleteTeamSharedRecordFromCloud, type SyncStatus } from './lib/sync';
import { registerForPush, sendPush } from './lib/push';
import { syncTireLifecycle } from './lib/tireHistory';
import { makeBlankSetup, normalizeSetup, normalizeSetups, pickLatestSetupForCar, pickWeekendSourceSetup } from './lib/setupCompat';
import { captureSetupSnapshot, displayVersionLabel, finishWeekendLifecycle, getSetupEditability, isSetupLocked, isWeekendFinished, lifecycleLabel, mergeTimestampedRecords, selectRaceWeekendSetupForSelection, startWeekendLifecycle } from './lib/setupLifecycle';
import { formatPressureBlock, mirrorPressureBlockToTires, pressureBlockHasValue, resolveSessionPressureBlock, setupPressureBlock } from './lib/setupSteps';
import { applyQuickAdjust, resolveQuickAdjustTarget, type QuickAdjustCommand } from './lib/quickAdjust';
import { materializeMainChecklist } from './lib/mainChecklist';
import { KEEP_ADDED_ITEMS_KEY, reconcileMaintenanceChecklist, resetMainChecklist } from './lib/checklistMaintenance';
import { shouldPullOnResume } from './lib/resumePull';
import { reconcileStarterTemplates } from './lib/checklists';
import { deriveReadableLightAccent, readableOnColor } from './lib/colorContrast';

import DashboardView from './components/DashboardView';
import SetupView, { SETUP_NOTICE_COPY } from './components/SetupView';
import RaceWeekendView from './components/RaceWeekendView';
import type { NewSessionData, NewWeekendData } from './components/RaceWeekendView';
import { buildSessionNameFrom } from './lib/sessionSequence';
import SettingsView, { type SettingsSubTab } from './components/SettingsView';
import QuickReferenceView from './components/QuickReferenceView';
import GuideView from './components/GuideView';
import TrackersView from './components/TrackersView';
import ContextStrip from './components/ContextStrip';
import HelpSheet from './components/ui/HelpSheet';
import UndoToast from './components/ui/UndoToast';
import { pickAutoWeekend, sortWeekends } from './lib/scope';
import { buildQuickServiceRecords, type QuickServiceOutcome, type QuickServiceRequest } from './lib/serviceLog';
import { hasOpenSheets, isPopSuppressed } from './lib/backStack';
import { useUndoableDelete } from './lib/undo';
import { isAppGuideSection } from './lib/helpRouting';
import { resolveRaceDayCreationTarget } from './lib/raceDayGate';
import { clearCrewChiefLocalData } from './lib/accountDeletion';
import { ACCOUNTING_DRAFT_KEY } from './lib/accountingDraft';
import {
  buildOwnerCatchupKey,
  discardSoloOnlyTeamDeletes,
  enqueuePendingPersonalTireDelete,
  enqueuePendingTeamDelete,
  pendingTeamDeletesForAccount,
  readPendingTeamDeletes,
  readPendingPersonalTireDeletes,
  removePendingTeamDelete,
  removePendingPersonalTireDelete,
  resolveSyncOwnerId,
  type TeamSharedSyncTable,
} from './lib/teamDataOwnership';
import { Todo } from './types';
import { detectAssignmentChanges } from './lib/assignmentNotify';

const ACTIVE_WEEKEND_KEY = 'race_notes_active_weekend';
const INFO_DEDUPE_MS = 5000;
const SUCCESS_TOAST_MS = 1500;
const SAVED_FEEDBACK_INTERVAL_MS = 30_000;
type NotificationStatus = SyncStatus | 'syncing';

export type SavedFeedbackController = {
  markDirty: () => void;
  flush: () => boolean;
  isDirty: () => boolean;
};

export const createSavedFeedbackController = (announceSaved: () => void): SavedFeedbackController => {
  let dirty = false;
  return {
    markDirty: () => { dirty = true; },
    flush: () => {
      if (!dirty) return false;
      dirty = false;
      announceSaved();
      return true;
    },
    isDirty: () => dirty,
  };
};

type SavedFeedbackBoundaryTargets = {
  documentTarget: {
    readonly visibilityState: string;
    addEventListener: (type: 'visibilitychange', listener: () => void) => void;
    removeEventListener: (type: 'visibilitychange', listener: () => void) => void;
  };
  windowTarget: {
    addEventListener: (type: 'pagehide', listener: () => void) => void;
    removeEventListener: (type: 'pagehide', listener: () => void) => void;
    setInterval: (callback: () => void, delay: number) => number;
    clearInterval: (handle: number) => void;
  };
  addNativeListener?: (listener: (state: { isActive: boolean }) => void) => Promise<{ remove: () => Promise<void> }>;
};

export const installSavedFeedbackBoundaries = (
  flushSavedBoundary: () => boolean,
  targets: SavedFeedbackBoundaryTargets,
): (() => void) => {
  const onVisibilityChange = () => {
    if (targets.documentTarget.visibilityState === 'hidden') flushSavedBoundary();
  };
  const onPageHide = () => { flushSavedBoundary(); };
  const intervalHandle = targets.windowTarget.setInterval(flushSavedBoundary, SAVED_FEEDBACK_INTERVAL_MS);
  targets.documentTarget.addEventListener('visibilitychange', onVisibilityChange);
  targets.windowTarget.addEventListener('pagehide', onPageHide);
  const nativeListener = targets.addNativeListener?.(({ isActive }) => {
    if (!isActive) flushSavedBoundary();
  });

  return () => {
    targets.documentTarget.removeEventListener('visibilitychange', onVisibilityChange);
    targets.windowTarget.removeEventListener('pagehide', onPageHide);
    targets.windowTarget.clearInterval(intervalHandle);
    if (nativeListener) void nativeListener.then(listener => listener.remove());
  };
};

export const flushSavedFeedbackOnTabChange = (
  previousTab: string,
  nextTab: string,
  flushSavedBoundary: () => boolean,
): boolean => previousTab !== nextTab && flushSavedBoundary();

const isOnlineNow = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(isOnlineNow());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
};

type InfoCopyContext = {
  label?: string;
  name?: string;
  version?: string;
  finalLabel?: string;
  currentLabel?: string;
};

const INFO_COPY = {
  minimumSetups: () => SETUP_NOTICE_COPY.minimumSetups,
  'car-switch': ({ label }: InfoCopyContext) => `Now viewing ${label || 'selected car'} — setups, runs & trackers switched.`,
  'car-has-data': () => 'Reassign or delete this car\'s data first.',
  'car-delete-queued': ({ label }: InfoCopyContext) => `${label || 'Car'} and linked records removed from this device. Any queued cloud deletion will retry until confirmed.`,
  'active-weekend': ({ name }: InfoCopyContext) => `Active: ${name || 'Race Day'}`,
  'pressure-source': ({ label }: InfoCopyContext) => `Pressures carried from ${label || 'selected setup'}`,
  'finished-weekend-read-only': () => 'Finished Race Days are view-only.',
  'quick-adjust-target': () => 'Quick Adjust is unavailable for this run.',
  'quick-adjust-result': () => 'Quick Adjust could not be saved.',
  'finished-weekend-inactive': () => 'Finished Race Days stay in history and cannot be made active.',
  'missing-car': () => 'Add a car before starting a Race Day.',
  'race-day-active': ({ name, version }: InfoCopyContext) => `Active: ${name || 'Race Day'} · ${version || 'Current Setup'}`,
  'missing-weekend-log': () => 'Race Day setup is missing or locked. Restore it before logging a run.',
  'missing-weekend-adjust': () => 'Race Day setup is missing. Restore it before logging or adjusting a run.',
  'missing-weekend-finish': () => 'Race Day setup is missing. Restore it before finishing this Race Day.',
  'weekend-finished': ({ name, finalLabel, currentLabel }: InfoCopyContext) => `${name || 'Race Day'} finished. ${finalLabel || 'Final Setup'} saved; ${currentLabel || 'Current Setup'} is ready.`,
  'finished-run-history': () => 'Finished runs stay in history and cannot be loaded for editing.',
  'missing-weekend-load': () => 'Race Day setup is missing or locked. Restore it before loading this run.',
  'setup-copy': ({ label }: InfoCopyContext) => `Copied from ${label || 'selected setup'}`,
  'attachment-sign-in': () => 'Please sign in to attach files.',
  'upload-failed': () => 'Upload failed.',
  'setup-report-shared': () => 'Setup PDF shared.',
  'setup-report-downloaded': () => 'Setup PDF downloaded.',
  'setup-report-failed': () => 'Setup PDF could not be shared.',
  'race-day-report-shared': () => 'Race Day PDF shared.',
  'race-day-report-downloaded': () => 'Race Day PDF downloaded.',
  'race-day-report-failed': () => 'Race Day PDF could not be shared.',
  'four-bar-save-failed': () => 'Four-bar change could not be saved.',
  'clear-device-only': () => 'Device data cleared. Shared team data will re-download on next sync.',
  'clear-everywhere': () => 'Your records are queued for deletion. Team records you do not own remain in cloud.',
  'operation-failed': () => 'That action could not be completed.',
} as const;

type InfoReason = keyof typeof INFO_COPY;
type InfoNotice = { reason: InfoReason; context?: InfoCopyContext };

const resolveInfoCopy = ({ reason, context = {} }: InfoNotice): string => INFO_COPY[reason](context);

const componentInfoNotice = (message: string): InfoNotice => {
  if (message === 'minimumSetups') return { reason: 'minimumSetups' };
  if (message.startsWith('Copied from ')) return { reason: 'setup-copy', context: { label: message.slice('Copied from '.length) } };
  if (message === 'Please sign in to attach files.') return { reason: 'attachment-sign-in' };
  if (message === 'Upload failed.') return { reason: 'upload-failed' };
  if (message === 'Setup PDF shared.') return { reason: 'setup-report-shared' };
  if (message === 'Setup PDF downloaded.') return { reason: 'setup-report-downloaded' };
  if (message.includes('Setup PDF')) return { reason: 'setup-report-failed' };
  if (message === 'Race Day PDF shared.') return { reason: 'race-day-report-shared' };
  if (message === 'Race Day PDF downloaded.') return { reason: 'race-day-report-downloaded' };
  if (message.includes('Race Day PDF')) return { reason: 'race-day-report-failed' };
  if (message.includes('Four-bar')) return { reason: 'four-bar-save-failed' };
  if (message.includes('missing') && message.includes('logging or adjusting a run')) return { reason: 'missing-weekend-adjust' };
  return { reason: 'operation-failed' };
};

const THEME_SCALE_MIGRATION_VERSION = 1 as const;

const normalizeTheme = (value: unknown): AppTheme => {
  const saved = (value && typeof value === 'object' ? value : {}) as {
    mode?: unknown;
    accent?: unknown;
    fontSize?: unknown;
    scaleMigrationVersion?: unknown;
  };
  const rawFontSize = saved.fontSize;
  const isLegacyScale = saved.scaleMigrationVersion !== THEME_SCALE_MIGRATION_VERSION;
  const fontSize: AppTheme['fontSize'] = rawFontSize === 'xlarge' || rawFontSize === 'xxlarge'
    ? 'xlarge'
    : rawFontSize === 'large' && !isLegacyScale
      ? 'large'
      : 'standard';
  return {
    mode: saved.mode === 'light' ? 'light' : 'dark',
    accent: typeof saved.accent === 'string' && saved.accent ? saved.accent : '#ffb3ac',
    fontSize,
    scaleMigrationVersion: THEME_SCALE_MIGRATION_VERSION,
  };
};

const applyActiveSessionToWeekends = (
  source: RaceWeekend[],
  updatedSession: ActiveSession,
): RaceWeekend[] => source.map((weekend) => {
  if (updatedSession.weekendId && weekend.id !== updatedSession.weekendId) return weekend;
  let changed = false;
  const sessions = weekend.sessions.map((session) => {
    const matches = (updatedSession.id && session.id === updatedSession.id)
      || (!updatedSession.id
        && session.name.toUpperCase() === updatedSession.name.toUpperCase()
        && session.track.toLowerCase() === updatedSession.track.toLowerCase());
    if (!matches) return session;
    changed = true;
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
  });
  if (!changed) return weekend;
  return {
    ...weekend,
    sessions,
    updatedAt: new Date().toISOString(),
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
  const skipWeekendRecoveryRef = useRef(false);
  const [activeSession, setActiveSession] = useState<ActiveSession>(INITIAL_ACTIVE_SESSION);
  const activeSessionRef = useRef(activeSession);
  const weekendsRef = useRef(weekends);
  const savedSetupsRef = useRef(savedSetups);
  const sessionCloudQueueRef = useRef<Promise<void>>(Promise.resolve());
  const quickAdjustSequenceRef = useRef(0);
  const savedFeedbackControllerRef = useRef<SavedFeedbackController | null>(null);
  const flashSavedRef = useRef<() => void>(() => undefined);
  const previousSavedFeedbackTabRef = useRef(activeTab);
  const markSavedDirty = () => { savedFeedbackControllerRef.current?.markDirty(); };
  const flushSavedBoundary = () => savedFeedbackControllerRef.current?.flush() ?? false;
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { weekendsRef.current = weekends; }, [weekends]);
  useEffect(() => { savedSetupsRef.current = savedSetups; }, [savedSetups]);
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('race_notes_todos');
    if (!saved) return [];
    const materialized = materializeMainChecklist(JSON.parse(saved));
    localStorage.setItem('race_notes_todos', JSON.stringify(materialized));
    return materialized;
  });
  const prevTodosForNotifyRef = useRef<Todo[]>(todos);

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
  const tireInventoryRef = useRef(tireInventory);
  useEffect(() => { tireInventoryRef.current = tireInventory; }, [tireInventory]);

  const handleSaveTires = (updated: TireInventoryItem[]) => {
    setTireInventory(updated);
    localStorage.setItem('race_notes_tires', JSON.stringify(updated));
    markSavedDirty();
    if (user) pushTires(updated, user.id, setSyncStatus);
  };

  const handleDeleteTireFromCloud = async (tireId: string) => {
    if (!user) return;
    enqueuePendingPersonalTireDelete(window.localStorage, {
      accountId: user.id,
      tireId,
      queuedAt: new Date().toISOString(),
    });
    setDeleteReplayVersion(version => version + 1);
  };

  // ── Cars & Garage ──────────────────────────────────────────────────────────
  const [cars, setCars] = useState<Car[]>(() => {
    try { const s = localStorage.getItem('race_notes_cars'); return s ? JSON.parse(s) : INITIAL_CARS; }
    catch { return INITIAL_CARS; }
  });
  const carsRef = useRef(cars);
  useEffect(() => { carsRef.current = cars; }, [cars]);

  const [activeCarId, setActiveCarId] = useState<string | null>(() => {
    return localStorage.getItem('race_notes_active_car');
  });
  const activeCarIdRef = useRef(activeCarId);
  useEffect(() => { activeCarIdRef.current = activeCarId; }, [activeCarId]);
  const carUndo = useUndoableDelete<Car>();
  const garageAutoSelectSuppressionRef = useRef<string | null>(null);

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
  const maintenanceRef = useRef(maintenance);
  useEffect(() => { maintenanceRef.current = maintenance; }, [maintenance]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => {
    try { const s = localStorage.getItem('race_notes_maintenance_logs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const maintenanceLogsRef = useRef(maintenanceLogs);
  useEffect(() => { maintenanceLogsRef.current = maintenanceLogs; }, [maintenanceLogs]);
  const [trackersSubTab, setTrackersSubTab] = useState<'checklist' | 'service' | 'templates' | 'accounting'>('checklist');

  // Lifted smasher/shock-session state (Decision 1: cloud sync)
  const [shockSessions, setShockSessions] = useState<ShockSession[]>(() => {
    try { const s = localStorage.getItem('race_notes_shock_graphs'); return s ? JSON.parse(s) : INITIAL_SHOCK_SESSIONS; }
    catch { return INITIAL_SHOCK_SESSIONS; }
  });
  const shockSessionsRef = useRef(shockSessions);
  useEffect(() => { shockSessionsRef.current = shockSessions; }, [shockSessions]);

  const activeCar = cars.find(c => c.id === activeCarId) ?? null;
  const pendingCarId = carUndo.pending?.id ?? null;
  const selectedWeekend = activeWeekendId ? weekends.find(item => item.id === activeWeekendId) ?? null : null;
  const activeWeekend = selectedWeekend && !isWeekendFinished(selectedWeekend) ? selectedWeekend : null;
  const resolveWeekendSetup = (weekend: RaceWeekend | null | undefined): Setup | null => {
    if (!weekend) return null;
    if (!weekend.activeSetupId) return null;
    const candidate = savedSetupsRef.current.find(item => item.id === weekend.activeSetupId) ?? null;
    if (!candidate
      || isSetupLocked(candidate, weekendsRef.current)
      || candidate.lifecycleRole !== 'weekend'
      || candidate.weekendId !== weekend.id) return null;
    return candidate;
  };
  const activeWeekendSetup = resolveWeekendSetup(activeWeekend);
  const savedActiveSetup = setup.carId === activeCarId ? savedSetups.find(item => item.id === setup.id) ?? null : null;
  const activeCarSetup = savedActiveSetup ?? pickLatestSetupForCar(savedSetups, activeCarId);
  const raceWeekendSetup = selectRaceWeekendSetupForSelection(
    activeWeekendId,
    selectedWeekend,
    activeWeekendSetup,
    activeCarSetup,
  );

  // ── [27] Help sheet, [37]/[5] info toast, [33] online status ──────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState<string | undefined>();
  const openHelp = (section?: string) => {
    setHelpSection(section);
    setHelpOpen(true);
  };
  const appGuideHelp = isAppGuideSection(helpSection);
  const [infoToast, setInfoToast] = useState<InfoNotice | null>(null);
  const notificationHeaderRef = useRef<HTMLElement | null>(null);
  const [notificationTop, setNotificationTop] = useState(116);
  useEffect(() => {
    if (!infoToast) return;
    const t = setTimeout(() => {
      infoToastRef.current = null;
      setInfoToast(null);
    }, 3000);
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

  const handleSaveCars = (updated: Car[], expectedAccountId?: string | null) => {
    const notifySaved = typeof (expectedAccountId as unknown) === 'boolean'
      ? expectedAccountId as unknown as boolean
      : true;
    if (typeof (expectedAccountId as unknown) === 'boolean') expectedAccountId = undefined;
    const currentAccountId = userRef.current?.id ?? null;
    if (expectedAccountId !== undefined && currentAccountId !== expectedAccountId) return;
    if (currentAccountId) {
      const remainingIds = new Set(updated.map(car => car.id));
      carsRef.current
        .filter(car => !remainingIds.has(car.id))
        .forEach(car => queueSharedCloudDelete('cars', car.id, false, currentAccountId));
    }
    carsRef.current = updated;
    setCars(updated);
    localStorage.setItem('race_notes_cars', JSON.stringify(updated));
    if (notifySaved) markSavedDirty();
    const currentSyncOwnerId = syncOwnerIdRef.current;
    if (currentSyncOwnerId) pushCars(updated, currentSyncOwnerId, teamRef.current?.id ?? null, setSyncStatus);
  };

  const handleSaveGarageCars = (visibleUpdated: Car[]) => {
    if (!pendingCarId) {
      handleSaveCars(visibleUpdated);
      return;
    }
    const canonicalCars = carsRef.current;
    const visibleById = new Map(visibleUpdated.map(car => [car.id, car]));
    const canonicalIds = new Set(canonicalCars.map(car => car.id));
    const addedCar = visibleUpdated.find(car => !canonicalIds.has(car.id)) ?? null;
    if (canonicalCars.length === 1
      && canonicalCars[0].id === pendingCarId
      && activeCarIdRef.current === pendingCarId
      && visibleUpdated.length === 1
      && addedCar) {
      // Garage Add auto-selects when its filtered list was empty. Suppress only
      // that same-stack callback; a later deliberate selection must still work.
      garageAutoSelectSuppressionRef.current = addedCar.id;
      queueMicrotask(() => {
        if (garageAutoSelectSuppressionRef.current === addedCar.id) {
          garageAutoSelectSuppressionRef.current = null;
        }
      });
    }
    const reconciled = canonicalCars
      .map(car => car.id === pendingCarId ? car : visibleById.get(car.id) ?? car)
      .concat(visibleUpdated.filter(car => !canonicalIds.has(car.id)));
    handleSaveCars(reconciled);
  };

  const handleSelectCar = (carId: string) => {
    // [37] Confirm the scope switch when the user actually changes car
    const currentActiveCarId = activeCarIdRef.current;
    const currentCars = carsRef.current;
    if (currentActiveCarId && carId !== currentActiveCarId && currentCars.length > 1) {
      const nextCar = currentCars.find(c => c.id === carId);
      if (nextCar) {
        const label = nextCar.name || `${nextCar.chassis} · ${nextCar.carType}`;
        showInfo({ reason: 'car-switch', context: { label } });
      }
    }
    activeCarIdRef.current = carId;
    setActiveCarId(carId);
    localStorage.setItem('race_notes_active_car', carId);
    const nextSetup = pickLatestSetupForCar(savedSetupsRef.current, carId);
    if (nextSetup) {
      setSetup(nextSetup);
      localStorage.setItem('race_notes_setup', JSON.stringify(nextSetup));
    }
  };

  const handleSaveShockSessions = (updated: ShockSession[], notifySaved = true) => {
    if (user) {
      const remainingIds = new Set(updated.map(session => session.id));
      shockSessions
        .filter(session => !remainingIds.has(session.id))
        .forEach(session => queueSharedCloudDelete('shock_sessions', session.id));
    }
    setShockSessions(updated);
    localStorage.setItem('race_notes_shock_graphs', JSON.stringify(updated));
    if (notifySaved) markSavedDirty();
    if (syncOwnerId) pushShockSessions(updated, syncOwnerId, setSyncStatus);
  };

  const handleSaveMaintenance = (updated: MaintenanceComponent[]) => {
    if (user) {
      const remainingIds = new Set(updated.map(component => component.id));
      maintenance
        .filter(component => !remainingIds.has(component.id))
        .forEach(component => queueSharedCloudDelete('maintenance_components', component.id));
    }
    setMaintenance(updated);
    localStorage.setItem('race_notes_maintenance', JSON.stringify(updated));
    markSavedDirty();
    if (syncOwnerId) pushMaintenanceComponents(updated, syncOwnerId, setSyncStatus);
  };

  const handleSaveTodos = (updated: Todo[], notifySaved = true) => {
    const previousTodos = prevTodosForNotifyRef.current;
    prevTodosForNotifyRef.current = updated;
    if (user) {
      const remainingIds = new Set(updated.map(todo => todo.id));
      todos
        .filter(todo => !remainingIds.has(todo.id))
        .forEach(todo => queueSharedCloudDelete('todos', todo.id));
    }
    setTodos(updated);
    localStorage.setItem('race_notes_todos', JSON.stringify(updated));
    if (notifySaved) markSavedDirty();
    if (syncOwnerId) pushTodos(updated, syncOwnerId, setSyncStatus);
    if (user && teamMembers && teamMembers.length > 1) {
      for (const change of detectAssignmentChanges(previousTodos, updated)) {
        if (change.assignedTo === user.id) continue;
        if (!teamMembers.some(member => member.id === change.assignedTo)) continue;
        const body = change.taskDesc
          ? `${change.taskText} — ${change.taskDesc}`.slice(0, 160)
          : change.taskText.slice(0, 160);
        void sendPush({ toUserId: change.assignedTo }, {
          title: `${profile?.displayName || 'A teammate'} assigned you a task`,
          body,
          data: {
            type: 'task_assigned',
            todoId: change.todoId,
            itemId: change.itemId,
            route: 'trackers/checklist',
          },
        });
      }
    }
  };

  const handleSelectGarageCar = (carId: string) => {
    if (garageAutoSelectSuppressionRef.current === carId) {
      garageAutoSelectSuppressionRef.current = null;
      return;
    }
    handleSelectCar(carId);
  };

  const handleSaveMaintenanceLogs = (updated: MaintenanceLog[]) => {
    if (user) {
      const remainingIds = new Set(updated.map(log => log.id));
      maintenanceLogs
        .filter(log => !remainingIds.has(log.id))
        .forEach(log => queueSharedCloudDelete('maintenance_logs', log.id));
    }
    setMaintenanceLogs(updated);
    localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(updated));
    markSavedDirty();
    if (syncOwnerId) pushMaintenanceLogs(updated, syncOwnerId, setSyncStatus);
  };

  const handleSaveChecklistTemplates = (updated: ChecklistTemplate[]) => {
    if (user) {
      const remainingIds = new Set(updated.map(template => template.id));
      checklistTemplates
        .filter(template => !remainingIds.has(template.id))
        .forEach(template => queueSharedCloudDelete('checklist_templates', template.id));
    }
    setChecklistTemplates(updated);
    localStorage.setItem('race_notes_checklist_templates', JSON.stringify(updated));
    markSavedDirty();
    if (syncOwnerId) pushChecklistTemplates(updated, syncOwnerId, setSyncStatus);
  };

  const handleSaveWeekendChecklists = (updated: WeekendChecklist[]) => {
    if (user) {
      const remainingIds = new Set(updated.map(checklist => checklist.id));
      weekendChecklists
        .filter(checklist => !remainingIds.has(checklist.id))
        .forEach(checklist => queueSharedCloudDelete('weekend_checklists', checklist.id));
    }
    setWeekendChecklists(updated);
    localStorage.setItem('race_notes_weekend_checklists', JSON.stringify(updated));
    markSavedDirty();
    if (syncOwnerId) pushWeekendChecklists(updated, syncOwnerId, setSyncStatus);
  };

  const handleDeleteCar = (carId: string) => {
    const car = carsRef.current.find(item => item.id === carId);
    if (!car) return;
    const accountId = userRef.current?.id ?? null;
    const label = car.name || `${car.chassis} · ${car.carType}`;
    carUndo.requestDelete({
      id: car.id,
      label,
      item: car,
      // Pending deletes are Garage-render-only. Undo restores visibility with no writes.
      removeFromState: () => {},
      restoreToState: () => {},
      commit: () => {
        // A delayed delete must never apply a prior account's intent to new account data.
        if (userRef.current?.id !== accountId) return;
        const latestCars = carsRef.current;
        const selectedCar = latestCars.find(item => item.id === carId);
        if (!selectedCar) return;

        // Resolve every dependency from canonical refs at commit time. The order
        // below is also the cloud-delete dependency order; cars always run last.
        const latestSetups = savedSetupsRef.current;
        const removedSetupIds = new Set<string>(latestSetups.filter(item => item.carId === carId).map(item => item.id));
        const retainedSetups = latestSetups
          .filter(item => !removedSetupIds.has(item.id))
          .map(item => item.sourceSetupId && removedSetupIds.has(item.sourceSetupId)
            ? { ...item, sourceSetupId: undefined }
            : item);
        const latestTires = tireInventoryRef.current;
        const removedTires = latestTires.filter(item => item.carId === carId);
        const retainedTires = latestTires.filter(item => item.carId !== carId);
        const latestShocks = shockSessionsRef.current;
        const removedShocks = latestShocks.filter(item => item.carId === carId);
        const retainedShocks = latestShocks.filter(item => item.carId !== carId);
        const latestMaintenance = maintenanceRef.current;
        const removedComponents = latestMaintenance.filter(item => item.scope === 'car' && item.carId === carId);
        const removedComponentIds = new Set(removedComponents.map(item => item.id));
        const retainedMaintenance = latestMaintenance.filter(item => !removedComponentIds.has(item.id));
        const latestLogs = maintenanceLogsRef.current;
        const removedLogs = latestLogs.filter(item => removedComponentIds.has(item.componentId));
        const retainedLogs = latestLogs.filter(item => !removedComponentIds.has(item.componentId));
        const retainedCars = latestCars.filter(item => item.id !== carId);
        const currentOwnerId = syncOwnerIdRef.current;

        const repairedWeekends = weekendsRef.current.map(weekend => {
          let changed = false;
          const repaired = { ...weekend };
          for (const key of ['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'] as const) {
            if (repaired[key] && removedSetupIds.has(repaired[key]!)) {
              delete repaired[key];
              changed = true;
            }
          }
          return changed ? repaired : weekend;
        });
        if (repairedWeekends.some((weekend, index) => weekend !== weekendsRef.current[index])) {
          weekendsRef.current = repairedWeekends;
          setWeekends(repairedWeekends);
          localStorage.setItem('race_notes_weekends', JSON.stringify(repairedWeekends));
          if (currentOwnerId) void pushWeekends(repairedWeekends, currentOwnerId, setSyncStatus);
        }

        removedSetupIds.forEach(id => queueSharedCloudDelete('setups', id, false, accountId));
        savedSetupsRef.current = retainedSetups;
        setSavedSetups(retainedSetups);
        localStorage.setItem('race_notes_saved_setups', JSON.stringify(retainedSetups));
        if (currentOwnerId) void pushSetups(retainedSetups, currentOwnerId, setSyncStatus);

        if (accountId) {
          removedTires.forEach(item => enqueuePendingPersonalTireDelete(window.localStorage, {
            accountId,
            tireId: item.id,
            queuedAt: new Date().toISOString(),
          }));
          if (removedTires.length > 0) setDeleteReplayVersion(version => version + 1);
        }
        tireInventoryRef.current = retainedTires;
        setTireInventory(retainedTires);
        localStorage.setItem('race_notes_tires', JSON.stringify(retainedTires));
        if (accountId) void pushTires(retainedTires, accountId, setSyncStatus);

        removedShocks.forEach(item => queueSharedCloudDelete('shock_sessions', item.id, false, accountId));
        shockSessionsRef.current = retainedShocks;
        setShockSessions(retainedShocks);
        localStorage.setItem('race_notes_shock_graphs', JSON.stringify(retainedShocks));
        if (currentOwnerId) void pushShockSessions(retainedShocks, currentOwnerId, setSyncStatus);

        removedLogs.forEach(item => queueSharedCloudDelete('maintenance_logs', item.id, false, accountId));
        maintenanceLogsRef.current = retainedLogs;
        setMaintenanceLogs(retainedLogs);
        localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(retainedLogs));
        if (currentOwnerId) void pushMaintenanceLogs(retainedLogs, currentOwnerId, setSyncStatus);

        removedComponents.forEach(item => queueSharedCloudDelete('maintenance_components', item.id, false, accountId));
        maintenanceRef.current = retainedMaintenance;
        setMaintenance(retainedMaintenance);
        localStorage.setItem('race_notes_maintenance', JSON.stringify(retainedMaintenance));
        if (currentOwnerId) void pushMaintenanceComponents(retainedMaintenance, currentOwnerId, setSyncStatus);

        queueSharedCloudDelete('cars', carId, false, accountId);
        carsRef.current = retainedCars;
        setCars(retainedCars);
        localStorage.setItem('race_notes_cars', JSON.stringify(retainedCars));
        if (currentOwnerId) void pushCars(retainedCars, currentOwnerId, teamRef.current?.id ?? null, setSyncStatus);

        // Keep the active car/setup through Undo; choose replacements only now.
        if (activeCarIdRef.current === carId) {
          const nextCar = retainedCars[0] ?? null;
          activeCarIdRef.current = nextCar?.id ?? null;
          setActiveCarId(nextCar?.id ?? null);
          if (nextCar) localStorage.setItem('race_notes_active_car', nextCar.id);
          else localStorage.removeItem('race_notes_active_car');
          const nextSetup = nextCar ? pickLatestSetupForCar(retainedSetups, nextCar.id) : null;
          setSetup(nextSetup ?? INITIAL_SETUP);
          if (nextSetup) localStorage.setItem('race_notes_setup', JSON.stringify(nextSetup));
          else localStorage.removeItem('race_notes_setup');
        }
        if (!isTerminalSyncStatus(syncStatusRef.current)) {
          showInfo({ reason: 'car-delete-queued', context: { label } });
        }
      },
    });
  };

  // ── Clear All Data ────────────────────────────────────────────────────────────
  const clearAllDataModeRef = useRef<'device-only' | 'everywhere'>('device-only');
  const handleClearAllData = async () => {
    // Clear All owns deletion now; cancel the render-only car slot without committing it.
    carUndo.undo();
    const mode = clearAllDataModeRef.current;
    const isResolvedTeam = !!(user && teamResolved && team);
    const resolvedMode = isResolvedTeam ? mode : 'legacy';
    const sharedRows: Array<[TeamSharedSyncTable, string[]]> = [
      ['setups', savedSetups.map(item => item.id)],
      ['race_weekends', weekends.map(item => item.id)],
      ['todos', todos.map(item => item.id)],
      ['cars', cars.map(item => item.id)],
      ['shock_sessions', shockSessions.map(item => item.id)],
      ['maintenance_components', maintenance.map(item => item.id)],
      ['maintenance_logs', maintenanceLogs.map(item => item.id)],
      ['checklist_templates', checklistTemplates.map(item => item.id)],
      ['weekend_checklists', weekendChecklists.map(item => item.id)],
    ];
    // Clearing a device must not erase team data. When membership is unresolved,
    // retain solo-only intents until resolution proves the account is solo.
    if (user && (!teamResolved || !team)) {
      sharedRows.forEach(([table, ids]) => {
        ids.forEach(id => queueSharedCloudDelete(table, id, true));
      });
    }
    if (user && resolvedMode !== 'device-only') {
      if (isResolvedTeam && syncOwnerId === user.id) {
        sharedRows.forEach(([table, ids]) => {
          ids.forEach(id => queueSharedCloudDelete(table, id, false, user.id));
        });
        pushSetups([], user.id, setSyncStatus);
        pushWeekends([], user.id, setSyncStatus);
        pushTodos([], user.id, setSyncStatus);
        pushCars([], user.id, team.id, setSyncStatus);
        pushShockSessions([], user.id, setSyncStatus);
        pushMaintenanceComponents([], user.id, setSyncStatus);
        pushMaintenanceLogs([], user.id, setSyncStatus);
        pushChecklistTemplates([], user.id, setSyncStatus);
        pushWeekendChecklists([], user.id, setSyncStatus);
      }
      tireInventory.forEach(item => {
        enqueuePendingPersonalTireDelete(window.localStorage, {
          accountId: user.id,
          tireId: item.id,
          queuedAt: new Date().toISOString(),
        });
      });
      if (isResolvedTeam) pushTires([], user.id, setSyncStatus);
      setDeleteReplayVersion(version => version + 1);
    }

    const LOCAL_KEYS = [
      'race_notes_setup', 'race_notes_saved_setups', 'race_notes_weekends',
      'race_notes_active_session', 'race_notes_todos', 'race_notes_tires',
      'race_notes_accounting', ACCOUNTING_DRAFT_KEY, 'race_notes_shopping', 'race_notes_cars',
      'race_notes_active_car', 'race_notes_shock_graphs',
      'race_notes_maintenance', 'race_notes_maintenance_logs',
      'race_notes_checklist_templates', 'race_notes_weekend_checklists',
      ACTIVE_WEEKEND_KEY,
    ];
    LOCAL_KEYS.forEach(k => localStorage.removeItem(k));

    // Reset all in-memory state
    carsRef.current = [];
    activeCarIdRef.current = null;
    setSavedSetups([]);
    setWeekends([]);
    setActiveWeekendId(null);
    setTireInventory([]);
    setCars([]);
    setShockSessions([]);
    setActiveCarId(null);
    setActiveSession(INITIAL_ACTIVE_SESSION);
    prevTodosForNotifyRef.current = [];
    setTodos([]);
    setAccounting([]);
    setShopping([]);
    setMaintenance([]);
    setMaintenanceLogs([]);
    setChecklistTemplates([]);
    setWeekendChecklists([]);
    markSavedDirty();
    if (isResolvedTeam) {
      showInfo({ reason: resolvedMode === 'device-only' ? 'clear-device-only' : 'clear-everywhere' });
    } else {
      showComponentInfo('All data cleared');
    }
  };

  const handleDeleteAccount = async () => {
    await deleteCloudAccount();
    clearCrewChiefLocalData(window.localStorage);
    setUser(null);
    setProfile(null);
    setTeam(null);
    setTeamMembers([]);
    setHasLocalAcct(false);
    window.location.reload();
  };

  // Count helpers for GarageView / delete guard
  const carSetupCount = (carId: string) => savedSetups.filter(s => s.carId === carId).length;
  const carTireCount = (carId: string) => tireInventory.filter(t => t.carId === carId).length;
  const carShockCount = (carId: string) => shockSessions.filter(s => s.carId === carId).length;
  const carMaintenanceComponentCount = (carId: string) => maintenance.filter(item => item.scope === 'car' && item.carId === carId).length;
  const carMaintenanceLogCount = (carId: string) => {
    const componentIds = new Set(maintenance.filter(item => item.scope === 'car' && item.carId === carId).map(item => item.id));
    return maintenanceLogs.filter(item => componentIds.has(item.componentId)).length;
  };

  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('garage');
  const [settingsViewKey, setSettingsViewKey] = useState(0);
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
    return { mode: 'dark', accent: '#ffb3ac', fontSize: 'standard', scaleMigrationVersion: THEME_SCALE_MIGRATION_VERSION };
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
    const ZOOM: Record<AppTheme['fontSize'], number> = { standard: 1, large: 1.15, xlarge: 1.45 };
    const zoom = ZOOM[theme.fontSize];
    root.style.setProperty('--ui-zoom', String(zoom));
  }, [theme]);

  // ---- Auth & Cloud Sync State ----
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [team, setTeam] = useState<import('./types').Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<AppUser[] | null>(null);
  const [teamResolved, setTeamResolved] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [nativeAuthError, setNativeAuthError] = useState<{ id: number; message: string } | null>(null);
  const [hasLocalAcct, setHasLocalAcct] = useState<boolean>(() => hasLocalAccount());
  const [syncStatus, setSyncStatusState] = useState<NotificationStatus | null>(null);
  const syncStatusRef = useRef<NotificationStatus | null>(null);
  const isTerminalSyncStatus = (status: NotificationStatus | null): boolean => (
    status === 'deferred-delete-retrying' || status === 'sync-error'
  );
  const setSyncStatus = (next: NotificationStatus) => {
    if (isTerminalSyncStatus(next)) clearSavedFlash();
    if (isTerminalSyncStatus(next) && infoToastRef.current?.reason === 'car-delete-queued') {
      infoToastRef.current = null;
      setInfoToast(null);
    }
    const current = syncStatusRef.current;
    const resolved = isTerminalSyncStatus(current) && !isTerminalSyncStatus(next) ? current : next;
    syncStatusRef.current = resolved;
    setSyncStatusState(resolved);
  };
  const clearTransientSyncStatus = () => {
    const current = syncStatusRef.current;
    const resolved = isTerminalSyncStatus(current) ? current : null;
    syncStatusRef.current = resolved;
    setSyncStatusState(resolved);
  };
  const acknowledgeSyncStatus = () => {
    clearSavedFlash();
    syncStatusRef.current = null;
    setSyncStatusState(null);
  };
  const [pullDone, setPullDone] = useState(false); // initial cloud pull resolved — gates [4]
  const [authGeneration, setAuthGeneration] = useState(0);
  const [deleteReplayVersion, setDeleteReplayVersion] = useState(0);
  const [resumePullVersion, setResumePullVersion] = useState(0);
  const authGenerationRef = useRef(0);
  const authIdentityRef = useRef<string | null>(null);
  const syncOwnerId = resolveSyncOwnerId(user?.id, team?.id, teamMembers, teamResolved);
  const userRef = useRef<User | null>(user);
  const teamRef = useRef(team);
  const syncOwnerIdRef = useRef(syncOwnerId);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { teamRef.current = team; }, [team]);
  useEffect(() => { syncOwnerIdRef.current = syncOwnerId; }, [syncOwnerId]);
  const sharedOwnerCatchupRef = useRef<string | null>(null);
  const advanceAuthIdentity = (nextUser: User | null): number => {
    const nextId = nextUser?.id ?? null;
    userRef.current = nextUser;
    authIdentityRef.current = nextId;
    authGenerationRef.current += 1;
    setAuthGeneration(authGenerationRef.current);
    sharedOwnerCatchupRef.current = null;
    return authGenerationRef.current;
  };
  const queueSharedCloudDelete = (
    table: TeamSharedSyncTable,
    recordId: string,
    soloOnly = false,
    expectedAccountId?: string | null,
  ) => {
    const accountId = expectedAccountId === undefined
      ? userRef.current?.id ?? null
      : expectedAccountId;
    if (!accountId) return;
    enqueuePendingTeamDelete(window.localStorage, {
      accountId,
      table,
      recordId,
      queuedAt: new Date().toISOString(),
      soloOnly,
    });
    setDeleteReplayVersion(version => version + 1);
  };
  const handleAuthViewChange = (nextUser: User | null) => {
    advanceAuthIdentity(nextUser);
    setPullDone(false);
    setTeam(null);
    setTeamMembers(null);
    setTeamResolved(false);
    setUser(nextUser);
  };
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const reconnected = !wasOnlineRef.current && isOnline;
    wasOnlineRef.current = isOnline;
    if (!reconnected || !user || !pullDone) return;
    pushActiveSession(activeSessionRef.current, user.id, setSyncStatus);
  }, [isOnline, pullDone, user]);
  const pullGenerationRef = useRef(0);
  const lastPullStartedAtRef = useRef<number | null>(null);

  // A team member can edit before membership/profile loading completes. Keep the
  // local write, then flush every shared dataset once its canonical owner is known.
  useEffect(() => {
    if (!isOnline) {
      sharedOwnerCatchupRef.current = null;
      return;
    }
    if (!user || !teamResolved || !syncOwnerId || !pullDone) return;
    const key = buildOwnerCatchupKey(user.id, authGeneration, team?.id, syncOwnerId);
    if (sharedOwnerCatchupRef.current === key) return;
    sharedOwnerCatchupRef.current = key;
    pushSetups(savedSetupsRef.current, syncOwnerId, setSyncStatus);
    pushWeekends(weekendsRef.current, syncOwnerId, setSyncStatus);
    pushCars(cars, syncOwnerId, team?.id ?? null, setSyncStatus);
    pushShockSessions(shockSessions, syncOwnerId, setSyncStatus);
    pushTodos(todos, syncOwnerId, setSyncStatus);
    pushMaintenanceComponents(maintenance, syncOwnerId, setSyncStatus);
    pushMaintenanceLogs(maintenanceLogs, syncOwnerId, setSyncStatus);
    pushChecklistTemplates(checklistTemplates, syncOwnerId, setSyncStatus);
    pushWeekendChecklists(weekendChecklists, syncOwnerId, setSyncStatus);
  }, [authGeneration, cars, checklistTemplates, isOnline, maintenance, maintenanceLogs, pullDone, shockSessions, syncOwnerId, team?.id, teamResolved, todos, user, weekendChecklists]);

  // Shared deletes are local-first. Replay only after owner metadata resolves,
  // while the exact signed-in account/auth generation still owns this flush.
  useEffect(() => {
    if (!user || !teamResolved || !syncOwnerId || !isOnline) return;
    const accountId = user.id;
    const generation = authGeneration;
    if (team) discardSoloOnlyTeamDeletes(window.localStorage, accountId);
    const pending = pendingTeamDeletesForAccount(
      window.localStorage,
      accountId,
      true,
      !!team,
    );
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      let retryNeeded = false;
      for (const intent of pending) {
        if (cancelled
          || authIdentityRef.current !== accountId
          || authGenerationRef.current !== generation) return;
        const deleted = await deleteTeamSharedRecordFromCloud(intent.table, intent.recordId, setSyncStatus);
        if (deleted) removePendingTeamDelete(window.localStorage, intent);
        else retryNeeded = true;
      }
      if (retryNeeded
        && !cancelled
        && authIdentityRef.current === accountId
        && authGenerationRef.current === generation) {
        setSyncStatus('deferred-delete-retrying');
        window.setTimeout(() => {
          if (authIdentityRef.current === accountId
            && authGenerationRef.current === generation) {
            setDeleteReplayVersion(version => version + 1);
          }
        }, 5000);
      }
    })();
    return () => { cancelled = true; };
  }, [authGeneration, deleteReplayVersion, isOnline, syncOwnerId, team, teamResolved, user]);

  // Tires stay personal. Their retry queue is account-scoped and deliberately
  // independent from team-owner metadata and the shared-table whitelist.
  useEffect(() => {
    if (!user || !isOnline) return;
    const accountId = user.id;
    const generation = authGeneration;
    const pending = readPendingPersonalTireDeletes(window.localStorage)
      .filter(intent => intent.accountId === accountId);
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      let retryNeeded = false;
      for (const intent of pending) {
        if (cancelled
          || authIdentityRef.current !== accountId
          || authGenerationRef.current !== generation) return;
        const deleted = await deleteTireFromCloud(intent.tireId, setSyncStatus);
        if (deleted) removePendingPersonalTireDelete(window.localStorage, intent);
        else retryNeeded = true;
      }
      if (retryNeeded
        && !cancelled
        && authIdentityRef.current === accountId
        && authGenerationRef.current === generation) {
        setSyncStatus('deferred-delete-retrying');
        window.setTimeout(() => {
          if (authIdentityRef.current === accountId
            && authGenerationRef.current === generation) {
            setDeleteReplayVersion(version => version + 1);
          }
        }, 5000);
      }
    })();
    return () => { cancelled = true; };
  }, [authGeneration, deleteReplayVersion, isOnline, user]);

  // Wait for auth restoration and, when signed in, the settled cloud merge.
  // This prevents transient local starter seeds from racing team-visible data.
  useEffect(() => {
    if (!authReady || (user && !pullDone)) return;
    const reconciled = reconcileStarterTemplates(checklistTemplates);
    if (reconciled.seeded.length === 0 && reconciled.discardedIds.length === 0) return;
    setChecklistTemplates(reconciled.templates);
    localStorage.setItem('race_notes_checklist_templates', JSON.stringify(reconciled.templates));
    if (user) {
      if (reconciled.seeded.length > 0 && syncOwnerId) pushChecklistTemplates(reconciled.seeded, syncOwnerId, setSyncStatus);
      reconciled.discardedIds.forEach(id => queueSharedCloudDelete('checklist_templates', id));
    }
  }, [authReady, checklistTemplates, pullDone, syncOwnerId, user]);

  // Maintenance usage is derived from weekends. Reconcile only after the
  // initial cloud merge so stale local counters cannot briefly create jobs.
  useEffect(() => {
    if (!authReady || (user && !pullDone)) return;
    const reconciled = reconcileMaintenanceChecklist(todos, maintenance, weekends, savedSetups);
    if (reconciled === todos) return;
    handleSaveTodos(reconciled, false);
  }, [authReady, maintenance, pullDone, savedSetups, todos, user, weekends]);

  // ── "Saved" flash toast ──────────────────────────────────────────────────
  // Local-first writes stay instant; commit boundaries request one confirmation
  // after a dirty edit burst, including while fully offline.
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoToastRef = useRef<InfoNotice | null>(null);
  const infoShownAtRef = useRef(new Map<string, number>());
  const clearSavedFlash = () => {
    setSavedFlash(false);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = null;
  };
  const clearInfo = () => {
    infoToastRef.current = null;
    setInfoToast(null);
  };
  const showInfo = (notice: InfoNotice) => {
    const now = Date.now();
    const dedupeKey = resolveInfoCopy(notice);
    clearSavedFlash();
    const lastShownAt = infoShownAtRef.current.get(dedupeKey);
    if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;
    infoShownAtRef.current.set(dedupeKey, now);
    infoToastRef.current = notice;
    setInfoToast(notice);
  };
  const showComponentInfo = (message: string) => showInfo(componentInfoNotice(message));
  const flashSaved = () => {
    if (infoToastRef.current || isTerminalSyncStatus(syncStatusRef.current)) return;
    if (!isOnline) setSyncStatus('offline-saved');
    setSavedFlash(true);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => {
      savedFlashTimer.current = null;
      setSavedFlash(false);
    }, SUCCESS_TOAST_MS);
  };
  flashSavedRef.current = flashSaved;
  if (!savedFeedbackControllerRef.current) {
    savedFeedbackControllerRef.current = createSavedFeedbackController(() => flashSavedRef.current());
  }
  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);
  useEffect(() => {
    const previousTab = previousSavedFeedbackTabRef.current;
    previousSavedFeedbackTabRef.current = activeTab;
    flushSavedFeedbackOnTabChange(previousTab, activeTab, flushSavedBoundary);
  }, [activeTab]);
  useEffect(() => installSavedFeedbackBoundaries(flushSavedBoundary, {
    documentTarget: document,
    windowTarget: window,
    addNativeListener: Capacitor.isNativePlatform()
      ? listener => CapacitorApp.addListener('appStateChange', listener)
      : undefined,
  }), []);

  // If startup metadata lookup failed offline, retry when connectivity returns.
  // Until this resolves, shared writes remain local and the catch-up effect owns sync.
  useEffect(() => {
    if (!user || teamResolved || !isOnline) return;
    let cancelled = false;
    const refreshTeamMetadata = async () => {
      let resolvedTeam;
      try {
        resolvedTeam = await getUserTeam(user.id, { throwOnError: true });
      } catch {
        return;
      }
      if (cancelled) return;
      if (!resolvedTeam) {
        setTeam(null);
        setTeamMembers([]);
        setTeamResolved(true);
        return;
      }
      const members = await getTeamMembers(resolvedTeam.id);
      if (cancelled || members.length === 0) return;
      setTeam(resolvedTeam);
      setTeamMembers(members);
      setTeamResolved(true);
    };
    void refreshTeamMetadata();
    return () => { cancelled = true; };
  }, [isOnline, teamResolved, user]);
  // One lifetime owns every displayed success state. 'syncing' remains until
  // the operation replaces it with a terminal status.
  useEffect(() => {
    if (syncStatus !== 'synced' && syncStatus !== 'offline-saved') return;
    const t = setTimeout(() => {
      const current = syncStatusRef.current;
      const resolved = current === 'synced' || current === 'offline-saved' ? null : current;
      syncStatusRef.current = resolved;
      setSyncStatusState(resolved);
    }, SUCCESS_TOAST_MS);
    return () => clearTimeout(t);
  }, [syncStatus]);

  // [15] Weekend/session creation modals now live in RaceWeekendView.
  // This one-shot action tells the Sessions tab to open a modal on arrival.
  const [rwInitialAction, setRwInitialAction] = useState<'new-session' | 'new-weekend' | null>(null);
  const continueToRunAfterWeekendRef = useRef(false);
  // Future Settings deep links use one request path and remain repeatable.
  const openSettingsTab = (tab: SettingsSubTab) => {
    setSettingsSubTab(tab);
    setSettingsViewKey(value => value + 1);
    setActiveTab('settings');
  };
  const openGarage = () => openSettingsTab('garage');
  const openRaceWeekendAction = (action: 'new-session' | 'new-weekend') => {
    const target = resolveRaceDayCreationTarget(activeCarId, action);
    setRwInitialAction(target.initialAction);
    if (target.tab === 'settings') openGarage();
    else setActiveTab(target.tab);
  };

  const openWeekendForRun = () => {
    if (!activeCarId) {
      continueToRunAfterWeekendRef.current = false;
      openRaceWeekendAction('new-weekend');
      return;
    }
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
    if (skipWeekendRecoveryRef.current && !activeWeekendId) {
      skipWeekendRecoveryRef.current = false;
      localStorage.removeItem(ACTIVE_WEEKEND_KEY);
      return;
    }
    const activeWeekends = weekends.filter(weekend => !isWeekendFinished(weekend));
    if (activeWeekends.length === 0) {
      if (activeWeekendId) setActiveWeekendId(null);
      localStorage.removeItem(ACTIVE_WEEKEND_KEY);
      return;
    }
    if (activeWeekendId && activeWeekends.some(w => w.id === activeWeekendId)) return;
    const nextId = activeSession.weekendId && activeWeekends.some(w => w.id === activeSession.weekendId)
      ? activeSession.weekendId
      : activeWeekends[0].id;
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
      showInfo({ reason: 'active-weekend', context: { name: pick.name } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekends, activeWeekendId]);

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

  }, []);

  // ---- Auth: restore session + subscribe to changes ----
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setPullDone(false);
        const identityGeneration = advanceAuthIdentity(currentUser);
        setUser(currentUser);
        setTeamMembers(null);
        setTeamResolved(false);
        if (currentUser) {
          rememberLocalAccount(currentUser);
          setHasLocalAcct(true);
          void registerForPush(currentUser.id);
          const p = await fetchProfile(currentUser.id);
          if (authIdentityRef.current !== currentUser.id
            || authGenerationRef.current !== identityGeneration) return;
          setProfile(p);
          const t = await getUserTeam(currentUser.id, { throwOnError: true });
          if (authIdentityRef.current !== currentUser.id
            || authGenerationRef.current !== identityGeneration) return;
          setTeam(t);
          if (t) {
            const members = await getTeamMembers(t.id);
            if (authIdentityRef.current !== currentUser.id
              || authGenerationRef.current !== identityGeneration) return;
            if (members.length > 0) {
              setTeamMembers(members);
              setTeamResolved(true);
            }
          } else {
            setTeamMembers([]);
            setTeamResolved(true);
          }
        }
      } catch {
        // Supabase unreachable (offline) – fall back to the local "registered
        // on this device" flag so the user isn't kicked out of a working
        // offline session. hasLocalAcct already reflects this from initial state.
      } finally {
        setAuthReady(true);
      }
    };
    initAuth();

    const unsub = onAuthChange(async (newUser) => {
      setPullDone(false);
      const identityGeneration = advanceAuthIdentity(newUser);
      setUser(newUser);
      setTeamMembers(null);
      setTeamResolved(false);
      if (newUser) {
        // Only a *positive* session ever writes the local flag here. A null
        // newUser can mean "explicit sign-out" OR "offline token refresh
        // failed" – we don't want the latter to lock the user out, so
        // clearing the flag is left to the explicit signOut() call instead.
        rememberLocalAccount(newUser);
        setHasLocalAcct(true);
        void registerForPush(newUser.id);
        const p = await fetchProfile(newUser.id);
        if (authIdentityRef.current !== newUser.id
          || authGenerationRef.current !== identityGeneration) return;
        setProfile(p);
        const t = await getUserTeam(newUser.id, { throwOnError: true });
        if (authIdentityRef.current !== newUser.id
          || authGenerationRef.current !== identityGeneration) return;
        setTeam(t);
        if (t) {
          const members = await getTeamMembers(t.id);
          if (authIdentityRef.current !== newUser.id
            || authGenerationRef.current !== identityGeneration) return;
          if (members.length > 0) {
            setTeamMembers(members);
            setTeamResolved(true);
          }
        } else {
          setTeamMembers([]);
          setTeamResolved(true);
        }
      } else {
        setProfile(null);
        setTeam(null);
        setTeamMembers([]);
        setTeamResolved(true);
        setHasLocalAcct(hasLocalAccount());
      }
    });
    return () => { unsub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // ---- Auth: catch the Google sign-in deep link on native Android ----
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const handledUrls = new Set<string>();
    const processAuthUrl = (url?: string) => {
      if (!active || !url || handledUrls.has(url)) return;
      handledUrls.add(url);
      void handleNativeAuthCallback(url)
        .then(handled => {
          if (handled) setNativeAuthError(null);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Google sign-in failed.';
          console.warn('Native Google sign-in callback failed:', error);
          setNativeAuthError({ id: Date.now(), message });
        });
    };
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      processAuthUrl(url);
    });
    void CapacitorApp.getLaunchUrl()
      .then(result => processAuthUrl(result?.url))
      .catch(error => console.warn('Native launch URL check failed:', error));
    return () => {
      active = false;
      void listenerPromise.then(listener => listener.remove());
    };
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
    let pullReportedFailure = false;
    const reportPullFailure = (status: SyncStatus) => {
      if (status !== 'sync-error') return;
      if (!isCurrentPull()) return;
      pullReportedFailure = true;
      setSyncStatus('sync-error');
    };
    lastPullStartedAtRef.current = Date.now();
    setPullDone(false);

    // Pull cloud data and merge into localStorage
    const doPull = async () => {
      setSyncStatus('syncing');
      const queuedAtPullStart = new Set(
        readPendingTeamDeletes(window.localStorage)
          .filter(intent => intent.accountId === pullUserId)
          .map(intent => `${intent.table}:${intent.recordId}`),
      );
      const queuedTiresAtPullStart = new Set(
        readPendingPersonalTireDeletes(window.localStorage)
          .filter(intent => intent.accountId === pullUserId)
          .map(intent => intent.tireId),
      );
      const omitQueuedDeletes = <T extends { id: string }>(
        table: TeamSharedSyncTable,
        rows: T[],
      ): T[] => rows.filter(row => {
        const key = `${table}:${row.id}`;
        if (queuedAtPullStart.has(key)) return false;
        return !readPendingTeamDeletes(window.localStorage).some(intent => (
          intent.accountId === pullUserId
          && intent.table === table
          && intent.recordId === row.id
        ));
      });
      const data = await pullAllData(pullUserId, reportPullFailure);
      if (!isCurrentPull()) return;
      data.setups = omitQueuedDeletes('setups', data.setups);
      data.weekends = omitQueuedDeletes('race_weekends', data.weekends);

      if (data.setups.length > 0) {
        setSavedSetups(prev => {
          const cloudById = new Map(data.setups.map(item => [item.id, item]));
          const hasNewerLocal = prev.some(local => {
            const cloud = cloudById.get(local.id);
            return !cloud || (local.updatedAt || '') > (cloud.updatedAt || '');
          });
          const merged = mergeTimestampedRecords(prev, data.setups);
          localStorage.setItem('race_notes_saved_setups', JSON.stringify(merged));
          if (hasNewerLocal) {
            if (syncOwnerId) pushSetups(merged, syncOwnerId, reportPullFailure);
          }
          return merged;
        });
      } else if (savedSetupsRef.current.length > 0 && syncOwnerId) pushSetups(savedSetupsRef.current, syncOwnerId, reportPullFailure);

      if (data.weekends.length > 0) {
        setWeekends(prev => {
          const cloudById = new Map(data.weekends.map(item => [item.id, item]));
          const hasNewerLocal = prev.some(local => {
            const cloud = cloudById.get(local.id);
            return !cloud || (local.updatedAt || '') > (cloud.updatedAt || '');
          });
          const merged = mergeTimestampedRecords(prev, data.weekends);
          localStorage.setItem('race_notes_weekends', JSON.stringify(merged));
          if (hasNewerLocal) {
            if (syncOwnerId) pushWeekends(merged, syncOwnerId, reportPullFailure);
          }
          return merged;
        });
      } else if (weekendsRef.current.length > 0 && syncOwnerId) pushWeekends(weekendsRef.current, syncOwnerId, reportPullFailure);

      if (data.activeSession) {
        const local = activeSessionRef.current;
        const cloudWins = (data.activeSession.updatedAt || '') >= (local.updatedAt || '');
        const merged = cloudWins ? data.activeSession : local;
        activeSessionRef.current = merged;
        setActiveSession(merged);
        localStorage.setItem('race_notes_active_session', JSON.stringify(merged));
        if (!cloudWins) pushActiveSession(merged, pullUserId, reportPullFailure);
      } else if (activeSessionRef.current.updatedAt) pushActiveSession(activeSessionRef.current, pullUserId, reportPullFailure);

      const cloudTodos = omitQueuedDeletes('todos', await pullTodos(reportPullFailure));
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
          prevTodosForNotifyRef.current = materialized;
          localStorage.setItem('race_notes_todos', JSON.stringify(materialized));
          if (hasNewerLocal || JSON.stringify(materialized) !== JSON.stringify(merged)) {
            // B3: pushTodos(materialized, syncOwnerId, setSyncStatus) would leak a pull success; report failures only.
            if (syncOwnerId) pushTodos(materialized, syncOwnerId, reportPullFailure);
          }
          return materialized;
        });
      } else if (todos.length > 0) {
        if (syncOwnerId) pushTodos(materializeMainChecklist(todos), syncOwnerId, reportPullFailure);
      }

      const cloudTires = (await pullTires(pullUserId, reportPullFailure)).filter(tire => (
        !queuedTiresAtPullStart.has(tire.id)
        && !readPendingPersonalTireDeletes(window.localStorage).some(intent => (
          intent.accountId === pullUserId && intent.tireId === tire.id
        ))
      ));
      if (!isCurrentPull()) return;
      if (cloudTires.length > 0) {
        setTireInventory(cloudTires);
        localStorage.setItem('race_notes_tires', JSON.stringify(cloudTires));
      }

      const cloudCars = omitQueuedDeletes('cars', await pullCars(pullUserId, reportPullFailure));
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

      const cloudShock = omitQueuedDeletes('shock_sessions', await pullShockSessions(pullUserId, reportPullFailure));
      if (!isCurrentPull()) return;
      if (cloudShock.length > 0) {
        setShockSessions(cloudShock);
        localStorage.setItem('race_notes_shock_graphs', JSON.stringify(cloudShock));
      }

      const cloudMaint = omitQueuedDeletes('maintenance_components', await pullMaintenanceComponents(reportPullFailure));
      if (!isCurrentPull()) return;
      if (cloudMaint.length > 0) {
        setMaintenance(cloudMaint);
        localStorage.setItem('race_notes_maintenance', JSON.stringify(cloudMaint));
      }
      const cloudMaintLogs = omitQueuedDeletes('maintenance_logs', await pullMaintenanceLogs(reportPullFailure));
      if (!isCurrentPull()) return;
      if (cloudMaintLogs.length > 0) {
        setMaintenanceLogs(cloudMaintLogs);
        localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(cloudMaintLogs));
      }

      const cloudClTemplates = omitQueuedDeletes('checklist_templates', await pullChecklistTemplates(reportPullFailure));
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
      const cloudWkndChecklists = omitQueuedDeletes('weekend_checklists', await pullWeekendChecklists(reportPullFailure));
      if (!isCurrentPull()) return;
      if (cloudWkndChecklists.length > 0) {
        setWeekendChecklists(cloudWkndChecklists);
        localStorage.setItem('race_notes_weekend_checklists', JSON.stringify(cloudWkndChecklists));
      }

      if (!pullReportedFailure) clearTransientSyncStatus();
    };

    doPull().catch(error => {
      if (!isCurrentPull()) return;
      console.warn('Cloud pull failed:', error);
      setSyncStatus('sync-error');
    }).finally(() => {
      if (!isCurrentPull()) return;
      setPullDone(true); // checklist reconciliation may now use merged/local data
    });
    return () => { if (pullGenerationRef.current === generation) pullGenerationRef.current += 1; };
  }, [authGeneration, resumePullVersion, user]);

  // Resume gets a fresh pull-effect closure, so current team-owner metadata is used.
  useEffect(() => {
    if (!user) return;
    const requestResumePull = () => {
      const now = Date.now();
      if (!shouldPullOnResume(lastPullStartedAtRef.current, now)) return;
      lastPullStartedAtRef.current = now;
      setResumePullVersion(version => version + 1);
    };

    if (Capacitor.isNativePlatform()) {
      const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) requestResumePull();
      });
      return () => { listenerPromise.then(listener => listener.remove()); };
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestResumePull();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
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
    if (syncOwnerId) pushSetups(stampedSetups, syncOwnerId, setSyncStatus);

    // Persist tires
    setTireInventory(stampedTires);
    localStorage.setItem('race_notes_tires', JSON.stringify(stampedTires));
    if (user) pushTires(stampedTires, user.id, setSyncStatus);

    // Persist shock sessions
    handleSaveShockSessions(stampedShock, false);

    // Register car and select it
    // @ts-expect-error Runtime boolean overload keeps UXP-3's account-guard signature stable.
    handleSaveCars([defaultCar], false);
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
    if (syncOwnerId) pushCars(updated, syncOwnerId, team?.id ?? null, setSyncStatus);
    handleSelectCar(defaultCar.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, pullDone, cars, savedSetups, tireInventory, shockSessions]);

  const handleSaveSetups = (updatedSetups: Setup[], activeId?: string, preserveInfoToast = false) => {
    const priorSetups = savedSetupsRef.current;
    const priorById = new Map<string, Setup>(priorSetups.map(item => [item.id, item] as const));
    const contextWeekend = weekendsRef.current.find(item => item.id === activeWeekendId && !isWeekendFinished(item));
    const eventSetupId = contextWeekend?.activeSetupId;
    const now = new Date().toISOString();
    const comparable = (value: Setup) => {
      const { updatedAt: _updatedAt, ...rest } = value;
      return JSON.stringify(rest);
    };
    const hasBlockedEdit = updatedSetups.some(candidate => {
      const prior = priorById.get(candidate.id);
      return !!prior
        && !getSetupEditability(prior, weekendsRef.current, eventSetupId).editable
        && comparable(prior) !== comparable(candidate);
    }) || priorSetups.some(prior => (
      !updatedSetups.some(candidate => candidate.id === prior.id)
      && !getSetupEditability(prior, weekendsRef.current, eventSetupId).deletable
    ));
    if (hasBlockedEdit) return;
    const safeSetups = updatedSetups.flatMap<Setup>(candidate => {
      const prior = priorById.get(candidate.id);
      const canEdit = !prior || getSetupEditability(prior, weekendsRef.current, eventSetupId).editable;
      if (!canEdit) {
        return prior ? [prior] : [];
      }
      return [{ ...candidate, updatedAt: !prior || comparable(prior) !== comparable(candidate) ? now : candidate.updatedAt }];
    });
    for (const prior of priorSetups) {
      if (!safeSetups.some(item => item.id === prior.id)
        && !getSetupEditability(prior, weekendsRef.current, eventSetupId).deletable) {
        safeSetups.push(prior);
      }
    }
    // Historical cards communicate through their own passive banner only.

    const didPersist = safeSetups.length !== priorSetups.length || safeSetups.some(candidate => {
      const prior = priorById.get(candidate.id);
      return !prior || comparable(prior) !== comparable(candidate);
    });

    const requestedActiveId = eventSetupId || activeId;
    const requested = requestedActiveId ? safeSetups.find(item => item.id === requestedActiveId) : null;
    const nextActiveId = requested && !isSetupLocked(requested, weekendsRef.current)
      ? requested.id
      : pickLatestSetupForCar(safeSetups, activeCarId)?.id;
    const activeSelectionChanged = activeId !== undefined && !eventSetupId && (
      activeId === '' ? setup.id !== INITIAL_SETUP.id : nextActiveId !== setup.id
    );
    if (!didPersist && !activeSelectionChanged) return;

    if (didPersist) {
      const remainingSetupIds = new Set(safeSetups.map(item => item.id));
      priorSetups
        .filter(item => !remainingSetupIds.has(item.id))
        .forEach(item => queueSharedCloudDelete('setups', item.id));
      savedSetupsRef.current = safeSetups;
      setSavedSetups(safeSetups);
      localStorage.setItem('race_notes_saved_setups', JSON.stringify(safeSetups));
    }

    const nextActive = nextActiveId ? safeSetups.find(item => item.id === nextActiveId) : null;
    if (activeId === '' && !eventSetupId) {
      setSetup(INITIAL_SETUP);
      localStorage.removeItem('race_notes_setup');
    }
    if (nextActive) {
      const prior = priorById.get(nextActive.id);
      const activated = setup.id !== nextActive.id;
      const pressuresChanged = !prior || (['lf', 'rf', 'lr', 'rr'] as const).some(corner => prior[corner].tirePress !== nextActive[corner].tirePress);
      setSetup(nextActive);
      localStorage.setItem('race_notes_setup', JSON.stringify(nextActive));
      if (activated || pressuresChanged) {
        const pressures = setupPressureBlock(nextActive);
        const hasPressureSource = pressureBlockHasValue(pressures);
        const sourceNote = `Pressures carried from ${displayVersionLabel(nextActive) || nextActive.chassis}`;
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
        if (hasPressureSource && !preserveInfoToast) showInfo({ reason: 'pressure-source', context: { label: displayVersionLabel(nextActive) || nextActive.chassis } });
        else if (!preserveInfoToast) clearInfo();
      }
    }
    markSavedDirty();
    if (didPersist) {
      if (syncOwnerId) pushSetups(safeSetups, syncOwnerId, setSyncStatus);
    }
  };

  const handleUpdateSession = (update: ActiveSession | ((current: ActiveSession) => ActiveSession)) => {
    const candidate = typeof update === 'function' ? update(activeSessionRef.current) : update;
    const updatedSession: ActiveSession = { ...candidate, updatedAt: new Date().toISOString() };
    const targetWeekend = updatedSession.weekendId
      ? weekendsRef.current.find(item => item.id === updatedSession.weekendId)
      : null;
    if (isWeekendFinished(targetWeekend)) {
      showInfo({ reason: 'finished-weekend-read-only' });
      return;
    }
    const updatedWeekends = applyActiveSessionToWeekends(weekendsRef.current, updatedSession);

    // Refs serialize rapid updates before React renders; every external write happens once here.
    activeSessionRef.current = updatedSession;
    weekendsRef.current = updatedWeekends;
    setActiveSession(updatedSession);
    setWeekends(updatedWeekends);
    localStorage.setItem('race_notes_active_session', JSON.stringify(updatedSession));
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));
    markSavedDirty();

    if (user) {
      const userId = user.id;
      const ownerUserId = syncOwnerId;
      sessionCloudQueueRef.current = sessionCloudQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await Promise.all([
            pushActiveSession(updatedSession, userId),
            ...(ownerUserId ? [pushWeekends(updatedWeekends, ownerUserId)] : []),
          ]);
        });
    }
  };

  const handleCommitQuickAdjust = (command: QuickAdjustCommand): { ok: boolean; error?: string } => {
    const target = resolveQuickAdjustTarget(
      activeWeekendId,
      weekendsRef.current,
      savedSetupsRef.current,
      activeSessionRef.current,
    );
    if (target.ok === false) {
      showInfo({ reason: 'quick-adjust-target' });
      return target;
    }
    quickAdjustSequenceRef.current += 1;
    const now = new Date().toISOString();
    const commandId = `quick-adjust-${Date.now()}-${quickAdjustSequenceRef.current}`;
    const result = applyQuickAdjust(target.setup, target.session, command, weekendsRef.current, now, commandId);
    if (result.ok === false) {
      showInfo({ reason: 'quick-adjust-result' });
      return result;
    }

    const updatedSetups = savedSetupsRef.current.map(item => item.id === result.setup.id ? result.setup : item);
    const updatedWeekends = applyActiveSessionToWeekends(weekendsRef.current, result.session);
    savedSetupsRef.current = updatedSetups;
    weekendsRef.current = updatedWeekends;
    activeSessionRef.current = result.session;
    setSavedSetups(updatedSetups);
    setWeekends(updatedWeekends);
    setActiveSession(result.session);
    setSetup(result.setup);
    localStorage.setItem('race_notes_saved_setups', JSON.stringify(updatedSetups));
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));
    localStorage.setItem('race_notes_active_session', JSON.stringify(result.session));
    localStorage.setItem('race_notes_setup', JSON.stringify(result.setup));
    markSavedDirty();

    if (user) {
      const userId = user.id;
      const ownerUserId = syncOwnerId;
      sessionCloudQueueRef.current = sessionCloudQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await Promise.all([
            ...(ownerUserId ? [
              pushSetups(updatedSetups, ownerUserId, setSyncStatus),
              pushWeekends(updatedWeekends, ownerUserId),
            ] : []),
            pushActiveSession(result.session, userId),
          ]);
        });
    }
    return { ok: true };
  };

  // Session weather helpers moved into RaceWeekendView ([15]).

  const handleActivateWeekend = (weekendId: string) => {
    const target = weekends.find(w => w.id === weekendId);
    if (!target || isWeekendFinished(target)) {
      showInfo({ reason: 'finished-weekend-inactive' });
      return;
    }
    setActiveWeekendId(target.id);
    localStorage.setItem(ACTIVE_WEEKEND_KEY, target.id);
    const weekendSetup = resolveWeekendSetup(target);
    if (weekendSetup) {
      setSetup(weekendSetup);
      localStorage.setItem('race_notes_setup', JSON.stringify(weekendSetup));
    }
  };

  const handleDeleteMaintenanceComponent = (componentId: string) => {
    handleSaveMaintenance(maintenance.filter(component => component.id !== componentId));
    handleSaveMaintenanceLogs(maintenanceLogs.filter(log => log.componentId !== componentId));
  };

  const handleDeleteChecklistTemplate = (templateId: string) => {
    const updated = checklistTemplates.filter(template => template.id !== templateId);
    handleSaveChecklistTemplates(updated);
  };

  // ── Create weekend ([15]: form lives in RaceWeekendView, data arrives here) ──

  const handleCreateNewWeekend = (data: NewWeekendData) => {
    if (!data.name.trim() || !data.track.trim()) return;
    if (!activeCarId) {
      showInfo({ reason: 'missing-car' });
      return;
    }

    const now = new Date().toISOString();
    const weekendId = `wknd-${Date.now()}`;
    const date = data.date || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const savedSource = pickWeekendSourceSetup(
      savedSetupsRef.current,
      activeCarId,
      data.setupId,
      activeCarSetup?.id,
    );
    const sourceSetup = savedSource || makeBlankSetup({
      id: `setup-current-source-${weekendId}`,
      chassis: activeCar?.chassis || activeCar?.name || 'My Car',
      track: data.track,
      date,
      carType: activeCar?.carType || '',
      carId: activeCarId,
      lifecycleRole: 'current',
      versionLabel: lifecycleLabel('current'),
      changeLog: [],
      updatedAt: now,
    });
    const baseWeekend: RaceWeekend = {
      id: weekendId,
      name: data.name,
      track: data.track,
      date,
      sessions: [],
    };
    const lifecycle = startWeekendLifecycle(baseWeekend, sourceSetup, now);
    const updatedSetups = [
      lifecycle.weekendSetup,
      lifecycle.baseline,
      ...(!savedSource ? [sourceSetup] : []),
      ...savedSetupsRef.current,
    ];
    const updatedWeekends = [lifecycle.weekend, ...weekendsRef.current];

    savedSetupsRef.current = updatedSetups;
    weekendsRef.current = updatedWeekends;
    setSavedSetups(updatedSetups);
    setWeekends(updatedWeekends);
    setSetup(lifecycle.weekendSetup);
    localStorage.setItem('race_notes_saved_setups', JSON.stringify(updatedSetups));
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));
    localStorage.setItem('race_notes_setup', JSON.stringify(lifecycle.weekendSetup));
    if (user) {
      if (syncOwnerId) {
        pushSetups(updatedSetups, syncOwnerId, setSyncStatus);
        pushWeekends(updatedWeekends, syncOwnerId, setSyncStatus);
      }
    }

    const keepAddedItems = localStorage.getItem(KEEP_ADDED_ITEMS_KEY) !== 'false';
    handleSaveTodos(resetMainChecklist(todos, keepAddedItems, now, checklistTemplates, {
      components: maintenance,
      weekends: updatedWeekends,
      setups: updatedSetups,
    }));

    setActiveWeekendId(lifecycle.weekend.id);
    localStorage.setItem(ACTIVE_WEEKEND_KEY, lifecycle.weekend.id);
    markSavedDirty();
    showInfo({ reason: 'race-day-active', context: { name: lifecycle.weekend.name, version: lifecycle.weekendSetup.versionLabel } });
    if (continueToRunAfterWeekendRef.current) {
      continueToRunAfterWeekendRef.current = false;
      setRwInitialAction('new-session');
      setActiveTab('raceweekend');
    }
  };

  const handleCreateNewSession = (data: NewSessionData) => {
    if (!activeCarId) {
      openGarage();
      return;
    }
    // Sessions may only be created under the device-active weekend.
    if (!activeWeekendId || data.weekendId !== activeWeekendId) return;

    const targetWeekend = weekends.find(w => w.id === activeWeekendId);
    if (!targetWeekend || isWeekendFinished(targetWeekend)) return;

    // The weekend's setup owns every run, even if the garage car selector changes.
    const sessionSetup = resolveWeekendSetup(targetWeekend);
    if (!sessionSetup) {
      showInfo({ reason: 'missing-weekend-log' });
      return;
    }
    const sessionSetupSnapshot = captureSetupSnapshot(sessionSetup);
    const sessionSetupUsed = sessionSetupSnapshot.chassis || 'No starting setup';

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
      setupUsed: sessionSetupUsed,
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
      screenshots: [],
      updatedAt: new Date().toISOString(),
    };

    const newRecord: SessionRecord = {
      id: `session-rec-${Date.now()}`,
      setupId: sessionSetup.id,
      setupSnapshot: sessionSetupSnapshot,
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
      setupUsed: sessionSetupUsed,
      screenshots: []
    };

    nextSession.id = newRecord.id;
    nextSession.weekendId = data.weekendId;

    const updatedWeekends = weekendsRef.current.map(w => w.id === targetWeekend.id ? {
      ...w,
      sessions: [newRecord, ...w.sessions],
      updatedAt: new Date().toISOString(),
    } : w);
    weekendsRef.current = updatedWeekends;
    setWeekends(updatedWeekends);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));
    if (syncOwnerId) pushWeekends(updatedWeekends, syncOwnerId);

    // Sync tire lifecycle (heat cycles, usage dates) from updated weekend data
    const lifecycled = syncTireLifecycle(tireInventory, updatedWeekends);
    setTireInventory(lifecycled);
    localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
    if (user) pushTires(lifecycled, user.id);

    activeSessionRef.current = nextSession;
    setActiveSession(nextSession);
    localStorage.setItem('race_notes_active_session', JSON.stringify(nextSession));
    markSavedDirty();
    flushSavedBoundary();
    if (pressureSourceNote) {
      const pressureSourceLabel = pressureSourceNote.match(/^Pressures carried from (.+)$/)?.[1];
      showInfo({ reason: 'pressure-source', context: { label: pressureSourceLabel } });
    }

    setActiveTab('raceweekend');
  };

  // Immediate delete — no confirm. Both RaceWeekendView and Dashboard wrap
  // this in the undo-toast pattern ([8]/[16]) — it fires only on commit.
  const deleteWeekendNow = (weekendId: string) => {
    const updated = weekends.filter(w => w.id !== weekendId);
    setWeekends(updated);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
    // Hard-delete from cloud so it doesn't come back on next sync pull
    queueSharedCloudDelete('race_weekends', weekendId);
    if (syncOwnerId) pushWeekends(updated, syncOwnerId);
    if (activeWeekendId === weekendId) {
      const nextId = updated.find(item => !isWeekendFinished(item))?.id ?? null;
      setActiveWeekendId(nextId);
      if (nextId) localStorage.setItem(ACTIVE_WEEKEND_KEY, nextId);
      else localStorage.removeItem(ACTIVE_WEEKEND_KEY);
    }
    if (activeSession.weekendId === weekendId) {
      const cleared: ActiveSession = { ...INITIAL_ACTIVE_SESSION, weekendId: undefined, updatedAt: new Date().toISOString() };
      setActiveSession(cleared);
      localStorage.setItem('race_notes_active_session', JSON.stringify(cleared));
    }
    // Null out weekendId on any checklists that belonged to this weekend (preserve the lists)
    const updatedChecklists = weekendChecklists.map(c =>
      c.weekendId === weekendId ? { ...c, weekendId: undefined, weekendName: undefined } : c
    );
    handleSaveWeekendChecklists(updatedChecklists);
    markSavedDirty();
  };

  // [7] Dashboard hero quick-start: create a weekend at the most recent track
  // dated today (handleCreateNewWeekend auto-activates it), then deep-link
  // straight into the new-session flow on the Sessions tab.
  const handleQuickStartWeekend = () => {
    if (!activeCarId) {
      openRaceWeekendAction('new-weekend');
      return;
    }
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
    markSavedDirty();
    return { result, prevComponent: component };
  };

  // Undo removes BOTH records and restores the component's service counter.
  const handleUndoQuickService = ({ result, prevComponent }: QuickServiceOutcome) => {
    handleSaveMaintenance(maintenance.map(c => (c.id === prevComponent.id ? prevComponent : c)));
    handleSaveMaintenanceLogs(maintenanceLogs.filter(l => l.id !== result.log.id));
    if (result.accountingEntry) {
      const entryId = result.accountingEntry.id;
      const updated = accounting.filter(e => e.id !== entryId);
      setAccounting(updated);
      localStorage.setItem('race_notes_accounting', JSON.stringify(updated));
    }
    markSavedDirty();
  };

  const handleDeleteSession = (weekendId: string, sessionId: string) => {
    // RaceWeekendView owns the undo window. This commit runs only after expiry.
    setWeekends(prev => {
      const updated = prev.map(w =>
        w.id === weekendId ? { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) } : w
      );
      localStorage.setItem('race_notes_weekends', JSON.stringify(updated));
      if (syncOwnerId) pushWeekends(updated, syncOwnerId);

      setTireInventory(prevTires => {
        const lifecycled = syncTireLifecycle(prevTires, updated);
        localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
        markSavedDirty();
        if (user) pushTires(lifecycled, user.id);
        return lifecycled;
      });
      return updated;
    });

    if (activeSession.id === sessionId) {
      setActiveSession(prev => {
        const cleared = { ...prev, id: undefined, weekendId: undefined };
        localStorage.setItem('race_notes_active_session', JSON.stringify(cleared));
        markSavedDirty();
        return cleared;
      });
    }
  };

  const handleUpdateWeekend = (updated: RaceWeekend) => {
    const prior = weekendsRef.current.find(item => item.id === updated.id);
    if (!prior) return;
    const stamped: RaceWeekend = {
      ...updated,
      status: prior.status,
      finishedAt: prior.finishedAt,
      sourceSetupId: prior.sourceSetupId,
      baselineSetupId: prior.baselineSetupId,
      activeSetupId: prior.activeSetupId,
      finalSetupId: prior.finalSetupId,
      setupId: prior.setupId,
      setupName: prior.setupName,
      updatedAt: new Date().toISOString(),
    };
    const updatedList = weekendsRef.current.map(w => w.id === stamped.id ? stamped : w);
    weekendsRef.current = updatedList;
    setWeekends(updatedList);
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedList));
    if (syncOwnerId) pushWeekends(updatedList, syncOwnerId);
    
    // Sync tire lifecycle after weekend update (sessions may have changed)
    const lifecycled = syncTireLifecycle(tireInventory, updatedList);
    setTireInventory(lifecycled);
    localStorage.setItem('race_notes_tires', JSON.stringify(lifecycled));
    markSavedDirty();
    if (user) pushTires(lifecycled, user.id);
  };

  const handleFinishWeekend = (weekendId: string) => {
    const target = weekendsRef.current.find(item => item.id === weekendId);
    if (!target || isWeekendFinished(target)) return;
    const now = new Date().toISOString();
    const finishFallback = makeBlankSetup({
      id: `setup-baseline-${target.id}`,
      chassis: activeCar?.chassis || activeCar?.name || 'My Car',
      track: target.track,
      date: target.date,
      carType: activeCar?.carType || '',
      carId: activeCarId || undefined,
      lifecycleRole: 'baseline',
      versionLabel: `${target.date || 'Race Day'} ${lifecycleLabel('baseline')}`,
      weekendId: target.id,
      lockedAt: now,
      changeLog: [],
      updatedAt: now,
    });
    const result = finishWeekendLifecycle(target, savedSetupsRef.current, now, finishFallback);
    if (!result) {
      showInfo({ reason: 'missing-weekend-finish' });
      return;
    }
    const updatedWeekends = weekendsRef.current.map(item => item.id === target.id ? result.weekend : item);
    const clearedSession: ActiveSession = { ...INITIAL_ACTIVE_SESSION, weekendId: undefined, updatedAt: now };

    savedSetupsRef.current = result.setups;
    weekendsRef.current = updatedWeekends;
    activeSessionRef.current = clearedSession;
    skipWeekendRecoveryRef.current = true;
    setSavedSetups(result.setups);
    setWeekends(updatedWeekends);
    setSetup(result.currentSetup);
    setActiveSession(clearedSession);
    setActiveWeekendId(null);
    localStorage.setItem('race_notes_saved_setups', JSON.stringify(result.setups));
    localStorage.setItem('race_notes_weekends', JSON.stringify(updatedWeekends));
    localStorage.setItem('race_notes_setup', JSON.stringify(result.currentSetup));
    localStorage.setItem('race_notes_active_session', JSON.stringify(clearedSession));
    localStorage.removeItem(ACTIVE_WEEKEND_KEY);
    markSavedDirty();

    if (user) {
      if (syncOwnerId) {
        pushSetups(result.setups, syncOwnerId, setSyncStatus);
        pushWeekends(updatedWeekends, syncOwnerId, setSyncStatus);
      }
      pushActiveSession(clearedSession, user.id, setSyncStatus);
    }
    showInfo({
      reason: 'weekend-finished',
      context: {
        name: target.name,
        finalLabel: lifecycleLabel('final', target),
        currentLabel: lifecycleLabel('current'),
      },
    });
  };

  const handleSelectRecentSession = (rec: SessionRecord, weekendId: string) => {
    if (isWeekendFinished(weekendsRef.current.find(item => item.id === weekendId))) {
      showInfo({ reason: 'finished-run-history' });
      return;
    }
    handleActivateWeekend(weekendId);
    const targetWeekend = weekendsRef.current.find(item => item.id === weekendId);
    const currentCarSetup = resolveWeekendSetup(targetWeekend);
    if (targetWeekend && !currentCarSetup) {
      showInfo({ reason: 'missing-weekend-load' });
      return;
    }
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
      setupUsed: rec.setupUsed || currentCarSetup?.chassis || 'No starting setup',
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
      updatedAt: new Date().toISOString(),
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

  useEffect(() => {
    if (!isUnlocked) return;
    const header = notificationHeaderRef.current;
    if (!header) return;
    const zoom = theme.fontSize === 'xlarge' ? 1.45 : theme.fontSize === 'large' ? 1.15 : 1;
    const updateNotificationTop = () => {
      setNotificationTop((header.getBoundingClientRect().bottom / zoom) + 8);
    };
    updateNotificationTop();
    const observer = new ResizeObserver(updateNotificationTop);
    observer.observe(header);
    window.addEventListener('resize', updateNotificationTop);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateNotificationTop);
    };
  }, [isOnline, isUnlocked, theme.fontSize]);

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
          <div className="flex items-center gap-1.5 px-3 md:px-4 py-2">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
          </header>
          <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="w-full max-w-sm">
              <p className="text-center text-on-surface-variant text-xs leading-relaxed mb-6">
                Register or sign in to start tracking setups, runs, and Race Days.
                <br />
                <span className="text-on-surface-muted">
                  Once you've signed in on this device, the app keeps working with no signal.
                </span>
              </p>
              <AuthView
                user={null}
                profile={null}
                onAuthChange={handleAuthViewChange}
                externalError={nativeAuthError}
              />
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
        <header ref={notificationHeaderRef} className="bg-surface w-full top-0 sticky border-b border-outline-variant z-40">
          <div className="flex flex-wrap justify-between items-center gap-y-1 px-3 md:px-4 py-2 w-full">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-xl">headset_mic</span>
              <h1 className="font-display font-bold tracking-tight text-base text-primary uppercase">
                CREW CHIEF
              </h1>
            </div>
            
            <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
              {!isOnline && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label="Offline — saved on device"
                  className="status-chip shrink-0 border-outline-variant bg-surface-container text-on-surface-variant"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
                  <span className="hidden min-[360px]:inline">OFFLINE</span>
                </div>
              )}
              {/* Tuning Guide sheet ([27]) */}
              <button
                onClick={() => openHelp()}
                aria-label="Tuning Guide"
                title="Tuning Guide"
                className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-1 px-2 min-h-11 rounded-full text-on-surface-variant hover:text-primary transition-colors text-center leading-tight"
              >
                <span className="material-symbols-outlined text-[20px]">menu_book</span>
                <span className="font-mono text-[11px] font-semibold">Tuning Guide</span>
              </button>
              {/* Sunlight / theme-mode toggle ([32]) */}
              <button
                onClick={() => handleThemeChange({ ...theme, mode: theme.mode === 'dark' ? 'light' : 'dark' })}
                aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme.mode === 'dark' ? 'Switch to light mode (sunlight)' : 'Switch to dark mode'}
                className="flex items-center justify-center min-w-11 min-h-11 rounded-full text-on-surface-variant hover:text-primary transition-colors"
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
            weekends={weekends.filter(item => !isWeekendFinished(item))}
            activeWeekendId={activeWeekendId}
            onSelectCar={handleSelectCar}
            onSelectWeekend={handleActivateWeekend}
            onNewWeekend={() => openRaceWeekendAction('new-weekend')}
            onAddCar={openGarage}
          />
        )}

        {/* One compact notification arbiter. Info replaces success/sync feedback
            so users receive one clear reason at a time. */}
        {(() => {
          const isInfo = !!infoToast;
          const isFailure = syncStatus === 'deferred-delete-retrying' || syncStatus === 'sync-error';
          const isBusy = !isInfo && !savedFlash && syncStatus === 'syncing';
          const statusNotice = !isInfo && (isFailure || !savedFlash) ? syncStatus : null;
          if (!isInfo && !savedFlash && !statusNotice) return null;
          const msg = isInfo
            ? resolveInfoCopy(infoToast)
            : savedFlash && !isFailure
            ? (isOnline ? 'Saved' : 'Offline — saved on device')
            : statusNotice === 'syncing' ? 'Syncing…'
            : statusNotice === 'synced' ? 'Synced'
            : statusNotice === 'offline-saved' ? 'Offline — saved on device'
            : statusNotice === 'deferred-delete-retrying' ? 'Sync failed — will retry'
            : 'Sync failed — will retry';
          const isSuccess = !isInfo && !isFailure && (savedFlash || statusNotice === 'synced' || statusNotice === 'offline-saved');
          const isPersistent = statusNotice === 'deferred-delete-retrying' || statusNotice === 'sync-error';
          return (
            <div
              data-notification-slot="arbiter"
              className="fixed inset-x-0 z-[60] pointer-events-none flex justify-center px-4"
              style={{ top: notificationTop }}
            >
              <div
                role="status"
                aria-live="polite"
                className={`pointer-events-auto flex min-h-11 max-w-md items-center gap-2.5 rounded-full border-2 px-4 py-2 font-display text-sm font-bold tracking-wide shadow-2xl animate-fade-in ${
                  isSuccess
                    ? 'bg-green-500 border-green-300 text-black'
                    : 'bg-surface-container border-outline-variant text-on-surface'
                }`}
                style={{ boxShadow: isSuccess ? '0 8px 30px rgba(34,197,94,0.45)' : undefined }}
              >
                <span className={`material-symbols-outlined text-xl ${isBusy ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isInfo ? 'info' : savedFlash && !isOnline ? 'cloud_off' : isSuccess ? 'check_circle' : isBusy ? 'progress_activity' : isPersistent ? 'cloud_off' : 'cloud'}
                </span>
                <span className="min-w-0 flex-1">{msg}</span>
                {(isInfo || isPersistent) && (
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    className="tap-target -mr-2 shrink-0 text-on-surface-variant"
                    onClick={isInfo ? clearInfo : acknowledgeSyncStatus}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Core Main Active Canvas Area */}
        <main
          ref={mainRef}
          onScroll={(e) => { scrollPosRef.current[activeTabRef.current] = e.currentTarget.scrollTop; }}
          className="app-main-scroll flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar"
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
                  onGoToGarage={openGarage}
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
                  activeSetupId={activeCarSetup?.id ?? setup.id}
                  user={user}
                  tireInventory={tireInventory}
                  onSaveTires={handleSaveTires}
                  onDeleteTireFromCloud={handleDeleteTireFromCloud}
                  activeCarId={activeCarId}
                  activeCar={activeCar}
                  shockSessions={shockSessions}
                  onSaveShockSessions={handleSaveShockSessions}
                  weekends={weekends}
                  activeEventSetupId={activeWeekend?.activeSetupId}
                  initialSubTab={setupSubTab}
                  onSaveSetups={handleSaveSetups}
                  onInfo={showComponentInfo}
                  onHelp={openHelp}
                  onGoToGarage={openGarage}
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
                  activeSetup={raceWeekendSetup}
                  shockSessions={shockSessions}
                  onCommitQuickAdjust={handleCommitQuickAdjust}
                  onInfo={showComponentInfo}
                  onHelp={openHelp}
                  accounting={accounting}
                  onFinishWeekend={handleFinishWeekend}
                  initialAction={rwInitialAction ?? undefined}
                  onInitialActionConsumed={() => setRwInitialAction(null)}
                  onGoToGarage={openGarage}
                  onLogSetupChanges={() => {
                    setSetupSubTab('setups');
                    setActiveTab('setups');
                  }}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  user={user}
                  profile={profile}
                  onAuthChange={handleAuthViewChange}
                  setup={setup}
                  savedSetups={savedSetups}
                  activeSession={activeSession}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  weekends={weekends}
                  todos={todos}
                  accounting={accounting}
                  cars={pendingCarId ? cars.filter(car => car.id !== pendingCarId) : cars}
                  activeCarId={activeCarId}
                  onSelectCar={handleSelectGarageCar}
                  onSaveCars={handleSaveGarageCars}
                  onDeleteCar={handleDeleteCar}
                  setupCount={carSetupCount}
                  tireCount={carTireCount}
                  shockCount={carShockCount}
                  maintenanceComponentCount={carMaintenanceComponentCount}
                  maintenanceLogCount={carMaintenanceLogCount}
                  onStartWeekend={() => openRaceWeekendAction('new-weekend')}
                  initialSubTab={settingsSubTab}
                  subTabRequestKey={settingsViewKey}
                  onClearAllData={async (mode) => {
                    clearAllDataModeRef.current = mode ?? 'device-only';
                    await handleClearAllData();
                  }}
                  showTeamClearChoices={!!user && teamResolved && !!team}
                  canDeleteTeamSharedRecords={!!user && teamResolved && !!team && syncOwnerId === user.id}
                  onDeleteAccount={handleDeleteAccount}
                  tireInventory={tireInventory}
                  onSyncStatus={setSyncStatus}
                />
              )}

              {/* [27] QuickRef tab removed — content now lives in the HelpSheet */}

              {activeTab === 'trackers' && (
                <TrackersView
                  todos={todos}
                  teamMembers={teamMembers ?? []}
                  currentUserId={user?.id ?? null}
                  weekends={weekends}
                  onSaveTodos={handleSaveTodos}
                  accounting={accounting}
                  onSaveAccounting={(updated) => {
                    setAccounting(updated);
                    localStorage.setItem('race_notes_accounting', JSON.stringify(updated));
                    markSavedDirty();
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
          className="bg-surface-container border-t border-outline-variant z-40 flex justify-around items-center h-11 px-2 md:px-4 sticky bottom-0 w-full flex-shrink-0"
          id="global-bottom-nav-bar"
        >
          {/* Dashboard Button */}
          <button
            onClick={() => setActiveTab('dashboard')}
            id="tab-btn-dashboard"
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              aria-hidden="true"
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
            aria-current={activeTab === 'setups' ? 'page' : undefined}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'setups' ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              aria-hidden="true"
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
            aria-current={activeTab === 'raceweekend' ? 'page' : undefined}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'raceweekend' ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              aria-hidden="true"
              style={{ fontVariationSettings: activeTab === 'raceweekend' ? "'FILL' 1" : "'FILL' 0" }}
            >
              timer
            </span>
            <span className="w-full min-w-0 text-center font-semibold text-[10px] uppercase font-mono mt-0.5 tracking-tight leading-none break-words whitespace-normal">
              Runs
            </span>
          </button>

          {/* Trackers Button */}
          <button onClick={() => setActiveTab('trackers')}
            id="tab-btn-trackers"
            aria-current={activeTab === 'trackers' ? 'page' : undefined}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'trackers' ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
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
            onClick={() => openSettingsTab('garage')}
            id="tab-btn-settings"
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer ${
              activeTab === 'settings' ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              aria-hidden="true"
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
      <HelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        section={helpSection}
        title={appGuideHelp ? 'App Guide' : 'Tuning Guide'}
      >
        {appGuideHelp ? <GuideView activeSection={helpSection} embedded /> : <QuickReferenceView />}
      </HelpSheet>

      <UndoToast pending={carUndo.pending} onUndo={carUndo.undo} onDismiss={carUndo.dismiss} />

    </div>
  );
}
