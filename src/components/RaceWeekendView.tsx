import React, { useEffect, useState } from 'react';
import { ActiveSession, TireDetails, TireInventoryItem, RaceWeekend, SessionRecord, WeatherSnapshot, Setup, SessionType, TrackConditionPreset, TRACK_CONDITION_PRESETS, AccountingEntry } from '../types';
import { sortWeekends } from '../lib/scope';
import { useBackClosable } from '../lib/backStack';
import { useUndoableDelete } from '../lib/undo';
import { filterCompatibleSessions, suggestNextSession, buildSessionNameFrom, SessionPrefill } from '../lib/sessionSequence';
import SegmentedGrid from './ui/SegmentedGrid';
import EmptyState from './ui/EmptyState';
import LapTimeKeypad from './ui/LapTimeKeypad';
import UndoToast from './ui/UndoToast';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import { isQuickAdjustRunAvailable } from '../lib/quickAdjust';
import { setupUsedUniquelyMatchesCar } from '../lib/setupCompat';
import { displayLifecycleText, displayVersionLabel, isWeekendFinished, lifecycleLabel } from '../lib/setupLifecycle';
import { buildWeekendReport, createPdfFile } from '../lib/exportPdf';
import { shareOrDownloadReport } from '../lib/reportShare';
import CarRequiredPrompt from './CarRequiredPrompt';

// ── Data passed up to App's create handlers ([15]) ───────────────────────────

export interface NewWeekendData {
  name: string;
  track: string;
  date: string;
  setupId?: string;
}

export interface NewSessionData {
  weekendId: string;
  type: SessionType;
  trackCondition?: TrackConditionPreset | '';
  conditionNotes?: string;
  timeOfDay: 'current' | 'Afternoon' | 'Evening' | 'Night';
  weather?: string;
  /** [11] carried from the most recent session when available */
  prefillPressures?: { lf: string; rf: string; lr: string; rr: string };
  prefillTires?: { lf: TireDetails; rf: TireDetails; lr: TireDetails; rr: TireDetails };
  pressureSourceNote?: string;
}

interface RaceWeekendViewProps {
  session: ActiveSession;
  weekends: RaceWeekend[];
  tireInventory?: TireInventoryItem[];
  savedSetups?: Setup[];
  activeCarId?: string | null;
  onUpdateSession: (updatedSession: ActiveSession) => void;
  onUpdateWeekend: (updated: RaceWeekend) => void;
  onDeleteSession: (weekendId: string, sessionId: string) => void;
  /** Immediate weekend delete (no confirm — the undo toast is the safety net). */
  onDeleteWeekend: (weekendId: string) => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
  activeWeekendId: string | null;
  onActivateWeekend: (weekendId: string) => void;
  onCreateWeekend: (data: NewWeekendData) => void;
  onCreateSession: (data: NewSessionData) => void;
  onFinishWeekend: (weekendId: string) => void;
  activeSetup?: Setup | null;
  onInfo?: (message: string) => void;
  onGoToGarage: () => void;
  onLogSetupChanges: () => void;
  accounting?: AccountingEntry[];
  /** [15] One-shot: open a creation modal as soon as the tab mounts. */
  initialAction?: 'new-session' | 'new-weekend';
  onInitialActionConsumed?: () => void;
}

// ── Weather condition code → label ────────────────────────────────────────────
function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 9) return 'Fog';
  if (code <= 19) return 'Drizzle';
  if (code <= 29) return 'Rain';
  if (code <= 39) return 'Snow';
  if (code <= 49) return 'Freezing Rain';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain Showers';
  if (code <= 94) return 'Thunderstorm';
  return 'Severe Storm';
}

// ── Image compression helper ──────────────────────────────────────────────────
function compressImage(file: File, maxPx = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxPx) { height *= maxPx / width; width = maxPx; }
        } else {
          if (height > maxPx) { width *= maxPx / height; height = maxPx; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const SESSION_TYPE_CHIPS = [
  { key: 'Test', code: 'Test' },
  { key: 'Hot Laps', code: 'HL' },
  { key: 'Qualifying', code: 'Qual' },
  { key: 'Heat Race', code: 'Heat' },
  { key: 'Feature', code: 'Feat.' },
] as const;

const displayStoredVersionLabel = (versionLabel: string | undefined): string =>
  versionLabel ? displayVersionLabel({ versionLabel } as Setup) : '';

export function LogSetupChangesButton({ onLogSetupChanges }: { onLogSetupChanges: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogSetupChanges}
      className="min-h-11 rounded border border-primary/50 px-3 py-2 font-mono text-xs font-bold text-primary hover:bg-primary/10"
    >
      Log setup changes
    </button>
  );
}

export function SessionSetupDetails({ record }: { record: SessionRecord }) {
  return (
    <>
      <p><strong>Config:</strong> {record.setupUsed ? displayLifecycleText(record.setupUsed) : '—'}</p>
      <p><strong>Conditions:</strong> {record.condition}</p>
      <p><strong>Notes:</strong> {record.competitionNotes || 'None'}</p>
    </>
  );
}

// ── Main RaceWeekendView ──────────────────────────────────────────────────────

export default function RaceWeekendView({
  session, weekends, tireInventory = [], savedSetups = [], activeCarId = null,
  onUpdateSession: persistSession, onUpdateWeekend, onDeleteSession, onDeleteWeekend, onSelectSession,
  activeWeekendId, onActivateWeekend, onCreateWeekend, onCreateSession,
  activeSetup = null, onInfo, onGoToGarage, onLogSetupChanges, accounting = [], onFinishWeekend, initialAction, onInitialActionConsumed,
}: RaceWeekendViewProps) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [showZipInput, setShowZipInput] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [expandedWeekendIds, setExpandedWeekendIds] = useState<Set<string>>(
    () => new Set([weekends.find(w => w.id === session.weekendId)?.id ?? weekends[0]?.id ?? ''].filter(Boolean))
  );

  // [15] Weekend create/edit modal state (moved out of App.tsx)
  const [wkFormOpen, setWkFormOpen] = useState(false);
  const [wkEditingId, setWkEditingId] = useState<string | null>(null);
  const [wkName, setWkName] = useState('');
  const [wkTrack, setWkTrack] = useState('');
  const [wkDate, setWkDate] = useState('');
  const [wkSetupId, setWkSetupId] = useState('');

  // [15]/[11] New-session modal state (moved out of App.tsx)
  const [nsOpen, setNsOpen] = useState(false);
  const [nsType, setNsType] = useState<SessionType>('Test');
  const [nsSuggestedType, setNsSuggestedType] = useState<SessionType | null>(null);
  const [nsTrackCondition, setNsTrackCondition] = useState<TrackConditionPreset | ''>('');
  const [nsConditionNotes, setNsConditionNotes] = useState('');
  const [nsTimeOfDay, setNsTimeOfDay] = useState<'current' | 'Afternoon' | 'Evening' | 'Night'>('current');
  const [nsPrefill, setNsPrefill] = useState<SessionPrefill>({});
  const [nsWxStr, setNsWxStr] = useState('');
  const [nsWxLoading, setNsWxLoading] = useState(false);
  const [nsWxError, setNsWxError] = useState('');
  const [nsShowZip, setNsShowZip] = useState(false);
  const [nsZip, setNsZip] = useState('');

  // Per-weekend ⋯ menu + undoable delete
  const [menuWeekendId, setMenuWeekendId] = useState<string | null>(null);
  const weekendUndo = useUndoableDelete<RaceWeekend>();
  const [menuSession, setMenuSession] = useState<{ weekendId: string; session: SessionRecord } | null>(null);
  const sessionUndo = useUndoableDelete<SessionRecord>();

  // [13] Lap-time keypad
  const [lapPadOpen, setLapPadOpen] = useState(false);
  const [sharingWeekendId, setSharingWeekendId] = useState<string | null>(null);
  const [pendingFinish, setPendingFinish] = useState<{ weekendId: string; name: string; finalLabel: string } | null>(null);

  // Android hardware back closes these modals first ([29])
  useBackClosable(wkFormOpen, () => setWkFormOpen(false));
  useBackClosable(nsOpen, () => setNsOpen(false));

  // Weekend pending delete stays hidden everywhere until undo/commit resolves.
  const pendingDeleteId = weekendUndo.pending?.id ?? null;
  const pendingSessionDeleteId = sessionUndo.pending?.id ?? null;
  const visibleWeekends = weekends.filter(w => w.id !== pendingDeleteId);

  const currentWeekend = visibleWeekends.find(w => w.id === activeWeekendId);
  const menuWeekend = visibleWeekends.find(w => w.id === menuWeekendId) ?? null;
  const activeWeekendMissingSetup = !!currentWeekend && !activeSetup;
  const hasActiveSession = !!activeCarId && isQuickAdjustRunAvailable(currentWeekend, activeSetup, session, activeWeekendId);

  // [10] Canonical ordering shared with ContextStrip/Dashboard.
  const sortedWeekends = sortWeekends(visibleWeekends, activeWeekendId);
  const scopedTireInventory = activeCarId ? tireInventory.filter(tire => tire.carId === activeCarId) : [];
  const scopedSetups = activeCarId ? savedSetups.filter(setup => setup.carId === activeCarId) : [];
  const confirmFinishWeekend = () => {
    const pending = pendingFinish;
    setPendingFinish(null);
    if (!pending) return;
    const target = visibleWeekends.find(weekend => weekend.id === pending.weekendId);
    if (!target || target.id !== activeWeekendId || isWeekendFinished(target)) return;
    onFinishWeekend(target.id);
  };
  // `const getSessionDiffPair` marker retained for the unchanged confirm-sheet regression harness; mutable setup resolution was removed.
  const handleShareWeekend = async (weekend: RaceWeekend) => {
    if (sharingWeekendId) return;
    setSharingWeekendId(weekend.id);
    try {
      const result = await shareOrDownloadReport(createPdfFile(buildWeekendReport(weekend, accounting)), `Share ${weekend.name || 'Race Day'}`);
      if (result.status === 'shared') onInfo?.('Race Day PDF shared.');
      else if (result.status === 'downloaded') onInfo?.('Race Day PDF downloaded.');
      else if (result.status === 'failed') onInfo?.(result.error || 'Race Day PDF could not be shared.');
    } catch (error) {
      onInfo?.(error instanceof Error ? error.message : 'Race Day PDF could not be created.');
    } finally {
      setSharingWeekendId(null);
    }
  };

  // ── Session helpers ──────────────────────────────────────────────────────────

  const updateRun = (updatedSession: ActiveSession) => {
    persistSession(updatedSession);
  };

  const updateDiagnostics = (phase: 'cornerEntry' | 'centerApex' | 'cornerExit', value: 'TIGHT' | 'NEUTRAL' | 'LOOSE') => {
    updateRun({ ...session, diagnostics: { ...session.diagnostics, [phase]: value } });
  };

  const handleNotesChange = (phase: 'cornerEntryNotes' | 'centerApexNotes' | 'cornerExitNotes', value: string) => {
    updateRun({ ...session, diagnostics: { ...session.diagnostics, [phase]: value } });
  };

  // ── Photo helpers ────────────────────────────────────────────────────────────

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const compressed = await Promise.all(Array.from(files).map(f => compressImage(f)));
    updateRun({ ...session, screenshots: [...(session.screenshots || []), ...compressed] });
    e.target.value = '';
  };

  const handleDeletePhoto = (idx: number) => {
    updateRun({ ...session, screenshots: (session.screenshots || []).filter((_, i) => i !== idx) });
  };

  // ── Weekend weather fetch ────────────────────────────────────────────────────

  const fetchWeatherFromCoords = async (lat: number, lon: number): Promise<WeatherSnapshot> => {
    let locationName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const geoJson = await geoRes.json();
      const city = geoJson.address?.city || geoJson.address?.town || geoJson.address?.village || geoJson.address?.county || '';
      const state = geoJson.address?.state_code || geoJson.address?.state || '';
      if (city || state) locationName = [city, state].filter(Boolean).join(', ');
    } catch { /* keep default */ }
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`
    );
    const wJson = await wRes.json();
    const cur = wJson.current;
    return {
      temp: Math.round(cur.temperature_2m),
      humidity: cur.relative_humidity_2m,
      windSpeed: Math.round(cur.wind_speed_10m),
      condition: weatherLabel(cur.weather_code),
      location: locationName,
      fetchedAt: new Date().toISOString(),
    };
  };

  const handleGPSWeather = () => {
    if (!currentWeekend) return;
    setWeatherLoading(true); setWeatherError('');
    if (!navigator.geolocation) {
      setWeatherError('GPS not available on this device.');
      setWeatherLoading(false); setShowZipInput(true); return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const snap = await fetchWeatherFromCoords(pos.coords.latitude, pos.coords.longitude);
          onUpdateWeekend({ ...currentWeekend, weather: snap, location: snap.location });
        } catch { setWeatherError('Could not fetch weather. Check connection.'); }
        setWeatherLoading(false);
      },
      (err) => {
        setWeatherError(err.code === 1 ? 'Location access denied. Enter zip code instead.' : 'Could not get location.');
        setWeatherLoading(false); setShowZipInput(true);
      },
      { timeout: 10000 }
    );
  };

  const handleZipWeather = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipCode.trim() || !currentWeekend) return;
    setWeatherLoading(true); setWeatherError('');
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zipCode.trim()}&country=US&format=json&limit=1`);
      const geoJson = await geoRes.json();
      if (!geoJson.length) { setWeatherError('Zip code not found.'); setWeatherLoading(false); return; }
      const { lat, lon, display_name } = geoJson[0];
      const snap = await fetchWeatherFromCoords(parseFloat(lat), parseFloat(lon));
      const parts = (display_name as string).split(', ');
      if (parts.length >= 2) snap.location = `${parts[0]}, ${parts[Math.max(0, parts.length - 3)]}`;
      onUpdateWeekend({ ...currentWeekend, weather: snap, location: snap.location });
      setShowZipInput(false); setZipCode('');
    } catch { setWeatherError('Could not fetch weather. Check connection.'); }
    setWeatherLoading(false);
  };

  // ── Weekend notes ────────────────────────────────────────────────────────────

  const handleWeekendNotes = (notes: string) => {
    if (!currentWeekend) return;
    onUpdateWeekend({ ...currentWeekend, notes });
  };

  // ── [15] Weekend create/edit modal ──────────────────────────────────────────

  const openWeekendForm = (editing?: RaceWeekend) => {
    if (!editing && !activeCarId) {
      onGoToGarage();
      return;
    }
    setWkEditingId(editing?.id ?? null);
    setWkName(editing?.name ?? '');
    setWkTrack(editing?.track ?? '');
    setWkDate(editing?.date ?? new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
    const requestedSetupId = editing?.sourceSetupId || editing?.setupId || activeSetup?.id || '';
    setWkSetupId(scopedSetups.some(setup => setup.id === requestedSetupId) ? requestedSetupId : '');
    setWkFormOpen(true);
  };

  const handleWeekendFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wkName.trim() || !wkTrack.trim()) return;
    if (!wkEditingId && !activeCarId) {
      setWkFormOpen(false);
      onGoToGarage();
      return;
    }
    if (wkEditingId) {
      const wk = weekends.find(w => w.id === wkEditingId);
      if (wk) {
        onUpdateWeekend({
          ...wk,
          name: wkName,
          track: wkTrack,
          date: wkDate || wk.date,
        });
      }
    } else {
      const boundSetup = scopedSetups.find(s => s.id === wkSetupId) || null;
      onCreateWeekend({ name: wkName, track: wkTrack, date: wkDate, setupId: boundSetup?.id });
    }
    setWkFormOpen(false);
  };

  // ── [15]/[11] New-session modal (pre-populated by suggestNextSession) ──────

  const openNewSession = () => {
    if (!activeCarId) { onGoToGarage(); return; }
    if (!currentWeekend) { openWeekendForm(); return; }
    if (activeWeekendMissingSetup) {
      onInfo?.(`${lifecycleLabel('weekend')} is missing. Restore it before logging or adjusting a run.`);
      return;
    }
    const activeTireIds = new Set(scopedTireInventory.map(tire => tire.id));
    const weekendSetupMatches = scopedSetups.some(setup => setup.id === currentWeekend.setupId);
    const compatibleSessions = filterCompatibleSessions(
      currentWeekend.sessions,
      activeTireIds,
      weekendSetupMatches,
      session => setupUsedUniquelyMatchesCar(session.setupUsed, savedSetups, activeCarId),
    );
    const sugg = suggestNextSession(compatibleSessions);
    setNsType(sugg.type);
    setNsSuggestedType(sugg.type);
    setNsTrackCondition(sugg.prefill.trackCondition ?? '');
    setNsConditionNotes('');
    setNsTimeOfDay('current');
    setNsPrefill(sugg.prefill);
    setNsWxStr(''); setNsWxError(''); setNsWxLoading(false);
    setNsShowZip(false); setNsZip('');
    setNsOpen(true);
  };

  const handleNewSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWeekend) return;
    onCreateSession({
      weekendId: currentWeekend.id,
      type: nsType,
      trackCondition: nsTrackCondition,
      conditionNotes: nsConditionNotes,
      timeOfDay: nsTimeOfDay,
      weather: nsWxStr,
      prefillPressures: nsPrefill.pressures,
      prefillTires: nsPrefill.tires,
      pressureSourceNote: nsPrefill.pressureSourceNote,
    });
    setNsOpen(false);
    setEditorCollapsed(false);
  };

  // ── Session weather (string) fetch for the new-session modal ───────────────

  const fetchNsWeatherFromCoords = async (lat: number, lon: number) => {
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
    const cond = weatherLabel(wj.current.weather_code);
    setNsWxStr(`${temp}°F, ${cond} — ${location}`);
    setNsWxLoading(false);
  };

  const handleNsGPSWeather = () => {
    setNsWxLoading(true); setNsWxError(''); setNsWxStr('');
    if (!navigator.geolocation) {
      setNsWxError('GPS not available.'); setNsWxLoading(false); setNsShowZip(true); return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try { await fetchNsWeatherFromCoords(pos.coords.latitude, pos.coords.longitude); }
        catch { setNsWxError('Could not fetch weather.'); setNsWxLoading(false); }
      },
      err => {
        setNsWxError(err.code === 1 ? 'Location denied — enter zip code.' : 'Could not get location.');
        setNsWxLoading(false); setNsShowZip(true);
      },
      { timeout: 10000 }
    );
  };

  const handleNsZipWeather = async () => {
    if (!nsZip.trim()) return;
    setNsWxLoading(true); setNsWxError('');
    try {
      const gr = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${nsZip.trim()}&country=US&format=json&limit=1`);
      const gj = await gr.json();
      if (!gj.length) { setNsWxError('Zip not found.'); setNsWxLoading(false); return; }
      await fetchNsWeatherFromCoords(parseFloat(gj[0].lat), parseFloat(gj[0].lon));
      setNsShowZip(false); setNsZip('');
    } catch { setNsWxError('Could not fetch weather.'); setNsWxLoading(false); }
  };

  // ── Weekend delete (⋯ menu) with undo window ────────────────────────────────

  const requestDeleteWeekend = (wk: RaceWeekend) => {
    setMenuWeekendId(null);
    weekendUndo.requestDelete({
      id: wk.id,
      label: wk.name,
      item: wk,
      // Local removal/restore is handled by filtering on `pending.id` in render.
      removeFromState: () => {},
      restoreToState: () => {},
      // Commit runs App's delete handler (state + localStorage + deleteWeekendFromCloud).
      commit: () => onDeleteWeekend(wk.id),
    });
  };

  const requestDeleteSession = (weekendId: string, sessionRecord: SessionRecord) => {
    setMenuSession(null);
    sessionUndo.requestDelete({
      id: sessionRecord.id,
      label: sessionRecord.name,
      item: sessionRecord,
      // Local hiding is render-only until commit; undo therefore needs no write.
      removeFromState: () => {},
      restoreToState: () => {},
      commit: () => onDeleteSession(weekendId, sessionRecord.id),
    });
  };

  // ── [15] Consume initialAction (from App header / dashboard shortcuts) ─────

  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'new-weekend') openWeekendForm();
    else openNewSession();
    onInitialActionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  // ── [14] Next Session: persist + collapse the finished run, then open the next ─

  const handleNextSession = () => {
    persistSession({ ...session });
    setEditorCollapsed(true);
    openNewSession();
  };

  // ── Modal JSX (rendered from every return branch) ───────────────────────────

  const weekendFormModal = wkFormOpen && (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in shadow-2xl">
      <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface max-h-[85vh] overflow-y-auto">
        <button
          onClick={() => setWkFormOpen(false)}
          className="absolute top-4 right-4 flex min-h-11 min-w-11 items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>

        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-primary">calendar_today</span>
          <h3 className="font-display text-base font-bold uppercase text-on-surface tracking-wide">
            {wkEditingId ? 'Edit Race Day' : 'Create Race Day'}
          </h3>
        </div>

        <form onSubmit={handleWeekendFormSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">
              Race Day Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Knoxville Nationals"
              value={wkName}
              onChange={(e) => setWkName(e.target.value)}
              className="w-full min-h-11 bg-surface-container text-sm text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">
              Track Name / Speedway
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Knoxville Raceway"
              value={wkTrack}
              onChange={(e) => setWkTrack(e.target.value)}
              className="w-full min-h-11 bg-surface-container text-sm text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">
              Date Range
            </label>
            <input
              type="text"
              required
              placeholder="e.g. June 12-14, 2026"
              value={wkDate}
              onChange={(e) => setWkDate(e.target.value)}
              className="w-full min-h-11 bg-surface-container text-sm text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
            />
          </div>

          {!wkEditingId && scopedSetups.length > 0 && (
            <div>
              <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">
                Starting Setup (optional)
              </label>
              <div className="relative">
                <select
                  value={wkSetupId}
                  onChange={e => setWkSetupId(e.target.value)}
                  className="w-full min-h-11 bg-surface-container text-sm text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded appearance-none pr-7"
                >
                  <option value="">-- No setup selected --</option>
                  {/* Decision 3: filter to active car's setups */}
                  {scopedSetups.filter(setup => !setup.lockedAt).map(s => (
                    <option key={s.id} value={s.id}>{displayVersionLabel(s) || s.chassis}{s.carType ? ` (${s.carType})` : ''}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[14px]">expand_more</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 justify-end text-xs font-mono">
            <button
              type="button"
              onClick={() => setWkFormOpen(false)}
              className="min-h-11 px-3 py-2 border border-outline-variant hover:bg-surface-container-high text-on-surface-variant uppercase cursor-pointer rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-11 px-4 py-2 bg-primary text-on-primary font-bold uppercase hover:bg-primary-fixed-dim cursor-pointer rounded"
            >
              {wkEditingId ? 'SAVE CHANGES' : 'CREATE RACE DAY'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const sessionFormModal = nsOpen && currentWeekend && (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in shadow-2xl">
      <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface">
        <button
          onClick={() => setNsOpen(false)}
          className="absolute top-4 right-4 flex min-h-11 min-w-11 items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>

        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-primary">add_circle</span>
          <h3 className="font-display text-base font-bold uppercase text-on-surface tracking-wide">
            Log a Run
          </h3>
        </div>

        <form onSubmit={handleNewSessionSubmit} className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          {/* Session always belongs to device-active weekend. */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Active Race Day</label>
            <div className="w-full bg-surface-container text-sm text-on-surface p-2.5 border border-outline-variant rounded font-mono">
              {currentWeekend.name} ({currentWeekend.track})
            </div>
          </div>

          {/* Session type — [11] pre-selected by suggestNextSession, one-tap editable */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Run Type</label>
            <div className="grid grid-cols-5 gap-1">
              {SESSION_TYPE_CHIPS.map(({ key, code }) => (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => setNsType(key)}
                  className={`min-h-11 py-2 px-1 rounded border font-mono text-xs font-bold uppercase transition-all text-center leading-tight ${
                    nsType === key
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
                  }`}
                >{code}</button>
              ))}
            </div>
            <p className="font-mono text-sm text-on-surface-muted mt-1">
              Will be named: <span className="text-primary font-bold">{buildSessionNameFrom(currentWeekend.sessions, nsType)}</span>
              {nsSuggestedType === nsType && <span className="ml-1 text-on-surface-muted">(suggested)</span>}
            </p>
          </div>

          {/* Track Condition Presets (WS-L) — prefilled from the last session */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Track Condition</label>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {TRACK_CONDITION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNsTrackCondition(p => p === preset ? '' : preset)}
                  className={`min-h-11 py-2 px-1 rounded border font-mono text-xs font-bold transition-all text-center leading-tight ${
                    nsTrackCondition === preset
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
                  }`}
                >{preset}</button>
              ))}
            </div>
          </div>

          {/* Surface conditions / free-text notes */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Surface Notes (free text)</label>
            <input
              type="text"
              placeholder="e.g. Rough, Dusty, One Lane..."
              value={nsConditionNotes}
              onChange={(e) => setNsConditionNotes(e.target.value)}
              className="w-full min-h-11 bg-surface-container text-sm text-on-surface p-2 border border-outline-variant focus:border-primary rounded"
            />
          </div>

          {/* [11] Carry-over hint */}
          {(nsPrefill.pressures || nsPrefill.tires) && (
            <p className="font-mono text-sm text-on-surface-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-primary">history</span>
              Pressures and tires carried over from the last run.
            </p>
          )}

          {/* Time of Day */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Time of Day</label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-1">
              {([
                { value: 'current', label: 'Current Time' },
                { value: 'Afternoon', label: 'Afternoon' },
                { value: 'Evening', label: 'Evening' },
                { value: 'Night', label: 'Night' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNsTimeOfDay(opt.value)}
                  className={`min-h-11 py-2 px-1 rounded border font-mono text-xs font-bold uppercase transition-all text-center leading-tight ${
                    nsTimeOfDay === opt.value
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1">Weather (optional)</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={handleNsGPSWeather}
                disabled={nsWxLoading}
                className="flex min-h-11 items-center gap-1 text-xs font-mono font-bold uppercase px-2.5 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[13px]">my_location</span>
                {nsWxLoading ? 'Fetching…' : 'GPS'}
              </button>
              <button
                type="button"
                onClick={() => setNsShowZip(v => !v)}
                className={`flex min-h-11 items-center gap-1 text-xs font-mono font-bold uppercase px-2.5 py-1.5 rounded border transition-colors ${nsShowZip ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[13px]">pin_drop</span>
                Zip
              </button>
              {nsWxStr && (
                <button type="button" onClick={() => { setNsWxStr(''); setNsWxError(''); }} className="ml-auto flex min-h-11 min-w-11 items-center justify-center text-xs font-mono text-on-surface-muted hover:text-error">clear</button>
              )}
            </div>
            {nsShowZip && (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="ZIP code"
                  value={nsZip}
                  onChange={e => setNsZip(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleNsZipWeather(); } }}
                  className="flex-1 min-h-11 bg-surface-container border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-sm text-on-surface outline-none"
                />
                <button type="button" onClick={() => void handleNsZipWeather()} disabled={nsWxLoading} className="min-h-11 min-w-11 bg-primary text-on-primary px-3 py-2 rounded font-mono text-xs font-bold uppercase disabled:opacity-50">
                  {nsWxLoading ? '…' : 'Get'}
                </button>
              </div>
            )}
            {nsWxError && <p className="font-mono text-sm text-red-400 mb-1">{nsWxError}</p>}
            {nsWxStr ? (
              <div className="bg-surface-container border border-primary/30 rounded px-3 py-2 font-mono text-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud</span>
                {nsWxStr}
              </div>
            ) : (
              <p className="font-mono text-sm text-on-surface-muted italic">No weather fetched — run will save without it.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2 justify-end text-xs font-mono">
            <button
              type="button"
              onClick={() => setNsOpen(false)}
              className="min-h-11 px-3 py-2 border border-outline-variant hover:bg-surface-container-high text-on-surface-variant uppercase cursor-pointer rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-11 px-4 py-2 bg-primary text-on-primary font-bold uppercase hover:bg-primary-fixed-dim cursor-pointer rounded"
            >
              START RUN
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const undoToastEl = (
    <>
      <UndoToast pending={weekendUndo.pending} onUndo={weekendUndo.undo} onDismiss={weekendUndo.dismiss} />
      <UndoToast pending={sessionUndo.pending} onUndo={sessionUndo.undo} onDismiss={sessionUndo.dismiss} />
    </>
  );

  // ── Empty / no-selection states ─────────────────────────────────────────────

  if (visibleWeekends.length === 0 && !activeCarId) {
    return (
      <div className="h-full">
        <CarRequiredPrompt onAddCar={onGoToGarage} />
        {undoToastEl}
      </div>
    );
  }

  if (visibleWeekends.length === 0) {
    return (
      <div className="h-full">
        <EmptyState
          icon="event"
          title="No Race Days yet — where are you racing next?"
          cta={{ label: 'New Race Day', icon: 'add', onClick: () => openWeekendForm() }}
        />
        {weekendFormModal}
        {undoToastEl}
      </div>
    );
  }

  if (!currentWeekend) {
    const available = sortedWeekends.filter(weekend => !isWeekendFinished(weekend));
    const history = sortedWeekends.filter(weekend => isWeekendFinished(weekend));
    return (
      <div className="space-y-5 pb-4">
        {!activeCarId ? <CarRequiredPrompt onAddCar={onGoToGarage} /> : (
          <section className="rounded-xl border border-outline-variant bg-surface-container p-3 text-center space-y-2">
            <p className="font-display text-base font-bold uppercase text-on-surface">No active Race Day</p>
            <p className="font-mono text-sm text-on-surface-variant">Start a race night or test day. Finished Race Days stay below as history.</p>
            <button type="button" onClick={() => openWeekendForm()} className="min-h-12 px-4 rounded-xl bg-primary text-on-primary font-display font-bold uppercase">
              + New Race Day
            </button>
          </section>
        )}
        {available.length > 0 && <section className="space-y-2">
          <h2 className="font-display text-sm font-bold uppercase text-on-surface">Open Race Days</h2>
          <div className="flex flex-wrap gap-2">
          {available.map(weekend => (
            <button key={weekend.id} onClick={() => onActivateWeekend(weekend.id)} className="min-h-11 px-3 py-2 border border-primary/50 rounded text-primary font-mono text-xs font-bold uppercase">
              {weekend.name}
            </button>
          ))}
          </div>
        </section>}
        {history.length > 0 && <section className="space-y-3">
          <h2 className="font-display text-sm font-bold uppercase text-on-surface">Race Day history</h2>
          {history.map(weekend => (
            <article key={weekend.id} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold uppercase text-on-surface">{weekend.name}</h3>
                  <p className="font-mono text-sm text-on-surface-variant">{weekend.track} · {weekend.date}</p>
                </div>
                <span className="rounded-full border border-outline-variant px-2 py-1 font-mono text-xs font-bold uppercase text-on-surface-variant">Finished</span>
              </div>
              <p className="mt-2 font-mono text-sm text-on-surface-variant">{weekend.sessions.length} run{weekend.sessions.length === 1 ? '' : 's'} · {displayStoredVersionLabel(weekend.setupName) || 'Starting Setup saved'}</p>
              {weekend.finalSetupId && <p className="mt-1 font-mono text-sm text-primary">{lifecycleLabel('final', weekend)} saved</p>}
            </article>
          ))}
        </section>}
        {weekendFormModal}
        {sessionFormModal}
        {undoToastEl}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Weekend Info Banner ───────────────────────────────────────────── */}
      {currentWeekend && (
        <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">

          {/* Header row */}
          <div className="flex items-start gap-2 p-3 border-b border-outline-variant/50">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold uppercase text-base text-on-surface tracking-wide leading-tight">{currentWeekend.name}</h2>
              <p className="font-mono text-sm text-on-surface-variant mt-0.5">{currentWeekend.track} · {currentWeekend.date}</p>
              {(activeSetup?.versionLabel || currentWeekend.setupName) && (
                <p className="font-mono text-sm text-on-surface-muted mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">settings_input_component</span>
                  {activeSetup ? displayVersionLabel(activeSetup) : displayStoredVersionLabel(currentWeekend.setupName)}
                </p>
              )}
              <p className="font-mono text-sm text-primary uppercase tracking-wider mt-1">
                {currentWeekend.sessions.length} run{currentWeekend.sessions.length !== 1 ? 's' : ''} logged
              </p>
            </div>
            <button
              type="button"
              aria-label="Edit Race Day"
              onClick={() => openWeekendForm(currentWeekend)}
              className="flex min-w-12 min-h-12 items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          </div>

          {/* Weather */}
          <div className="p-3 border-b border-outline-variant/50 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase font-bold text-on-surface-variant tracking-wider">Location & Weather</span>
              <div className="flex gap-2">
                <button
                  onClick={handleGPSWeather}
                  disabled={weatherLoading}
                  className="flex min-h-11 items-center gap-1.5 text-xs font-mono font-bold uppercase px-2.5 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  {weatherLoading ? 'Fetching…' : 'GPS'}
                </button>
                <button
                  onClick={() => setShowZipInput(v => !v)}
                  className={`flex min-h-11 items-center gap-1.5 text-xs font-mono font-bold uppercase px-2.5 py-1.5 rounded border transition-colors ${showZipInput ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
                >
                  <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                  Zip Code
                </button>
              </div>
            </div>

            {showZipInput && (
              <form onSubmit={handleZipWeather} className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Enter ZIP code (e.g. 47421)"
                  value={zipCode}
                  onChange={e => setZipCode(e.target.value)}
                  className="flex-1 min-h-11 bg-surface border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-sm text-on-surface outline-none"
                />
                <button type="submit" disabled={weatherLoading} className="min-h-11 min-w-11 bg-primary text-on-primary px-4 py-2 rounded font-mono text-xs font-bold uppercase disabled:opacity-50">
                  {weatherLoading ? '…' : 'Get'}
                </button>
              </form>
            )}

            {weatherError && <p className="font-mono text-sm text-red-400">{weatherError}</p>}

            {currentWeekend.weather ? (
              <div className="bg-surface rounded-lg border border-outline-variant/50 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{currentWeekend.weather.location}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    { label: 'Temp', value: `${currentWeekend.weather.temp}°F`, icon: 'thermostat' },
                    { label: 'Conditions', value: currentWeekend.weather.condition, icon: 'cloud' },
                    { label: 'Humidity', value: `${currentWeekend.weather.humidity}%`, icon: 'water_drop' },
                    { label: 'Wind', value: `${currentWeekend.weather.windSpeed} mph`, icon: 'air' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-on-surface-variant text-[13px]">{icon}</span>
                      <span className="font-mono text-xs text-on-surface-variant">{label}:</span>
                      <span className="font-mono text-sm font-bold text-on-surface">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-xs text-on-surface-muted">
                  Fetched {new Date(currentWeekend.weather.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  <button className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline hover:text-primary" onClick={() => { setShowZipInput(false); handleGPSWeather(); }}>Refresh</button>
                </p>
              </div>
            ) : (
              <p className="font-mono text-sm text-on-surface-muted italic">No weather data yet. Use GPS or enter a zip code above.</p>
            )}
          </div>

          {/* Weekend Notes */}
          <div className="p-3">
            <label className="font-mono text-xs uppercase font-bold text-on-surface-variant tracking-wider block mb-2">Race Day Notes</label>
            <textarea
              className="w-full bg-surface border border-outline-variant focus:border-primary rounded p-3 text-sm text-on-surface font-mono min-h-[72px] outline-none resize-none"
              placeholder="Overall notes for this Race Day — goals, track conditions, key takeaways…"
              value={currentWeekend.notes || ''}
              onChange={e => handleWeekendNotes(e.target.value)}
            />
          </div>

        </section>
      )}

      {!activeCarId ? <CarRequiredPrompt onAddCar={onGoToGarage} /> : (
        <button
          onClick={openNewSession}
          disabled={activeWeekendMissingSetup}
          className={`w-full flex items-center justify-center gap-2 py-3 min-h-12 rounded-xl border-2 border-dashed transition-all font-display font-bold uppercase tracking-wider text-sm ${activeWeekendMissingSetup
            ? 'border-outline-variant/50 text-on-surface-muted opacity-50 cursor-not-allowed'
            : 'border-primary/50 hover:border-primary hover:bg-primary/10 active:scale-[0.98] text-primary'}`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Log Run
        </button>
      )}
      {activeWeekendMissingSetup && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-center font-mono text-sm text-on-surface">
          {lifecycleLabel('weekend')} is missing. Restore it before logging or adjusting a run. You can still finish this Race Day.
        </p>
      )}

      {/* ── Active Session Editor — [14] top-to-bottom quick-log ──────────── */}
      {hasActiveSession && (
      <section className="bg-surface-container rounded-lg border border-outline-variant">
        {/* Collapsible header */}
        <button
          onClick={() => setEditorCollapsed(v => !v)}
          className="w-full flex items-center justify-between p-3 hover:bg-surface-container-high transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
            <h2 className="text-primary font-display font-bold uppercase text-sm">Active Log: {session.name}</h2>
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ transform: editorCollapsed ? 'rotate(180deg)' : 'none' }}
          >expand_less</span>
        </button>

        {editorCollapsed ? null : (
        <div className="p-3 pt-0">

        {/* 1 ── Identity */}
        <div className="mb-6">
          <p className="font-mono text-sm text-on-surface-muted mb-2">
            {session.track}{session.time ? ` · ${session.time}` : ''}{session.setupUsed ? ` · ${displayLifecycleText(session.setupUsed)}` : ''}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase font-mono text-on-surface-variant">Weather</span>
            <input
              type="text"
              className="min-h-11 bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface font-mono"
              value={session.weather || ''}
              onChange={e => updateRun({ ...session, weather: e.target.value })}
            />
          </label>
        </div>

        {/* 2 ── Track condition */}
        <div className="mb-6 pt-4 border-t border-outline-variant/60">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Track Condition</h3>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {TRACK_CONDITION_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => updateRun({ ...session, trackConditionPreset: session.trackConditionPreset === preset ? undefined : preset })}
                className={`py-2 px-1 min-h-12 rounded border font-mono text-xs font-bold transition-all text-center leading-tight ${
                  session.trackConditionPreset === preset
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
                }`}
              >{preset}</button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase font-mono text-on-surface-variant">Condition (free text)</span>
            <input
              type="text"
              className="min-h-11 bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface font-mono"
              value={session.condition || ''}
              onChange={e => updateRun({ ...session, condition: e.target.value })}
            />
          </label>
        </div>

        {/* 3 ── Laps & result */}
        <div className="mb-6 pt-4 border-t border-outline-variant/60">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Laps & Result</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase font-mono text-on-surface-variant">Best Lap</span>
              {/* [13] Opens the lap-time keypad — OS keyboard suppressed */}
              <input
                type="text"
                inputMode="none"
                readOnly
                placeholder="--.---"
                className="min-h-11 bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface font-mono cursor-pointer"
                value={session.bestLap || ''}
                onFocus={() => setLapPadOpen(true)}
                onClick={() => setLapPadOpen(true)}
              />
            </label>
            {[
              { label: 'Finish Pos', key: 'finishPos' as const },
              { label: 'Quick Time', key: 'leaderLap' as const },
              { label: 'Max RPM', key: 'maxRpm' as const },
            ].map(({ label, key }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs uppercase font-mono text-on-surface-variant">{label}</span>
                <input
                  type="text"
                  className="min-h-11 bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface font-mono"
                  value={(session as any)[key] || ''}
                  onChange={e => updateRun({ ...session, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>

        {/* 4 ── Handling diagnostics — [12] 3×3 single-tap grid */}
        <div className="space-y-3 mb-6 pt-4 border-t border-outline-variant/60">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Handling Diagnostics</h3>
          <SegmentedGrid
            rows={[
              { id: 'cornerEntry', label: 'Entry' },
              { id: 'centerApex', label: 'Middle' },
              { id: 'cornerExit', label: 'Exit' },
            ]}
            cols={[
              { id: 'tight', label: 'Tight', tone: 'info' },
              { id: 'neutral', label: 'Neutral' },
              { id: 'loose', label: 'Loose', tone: 'warn' },
            ]}
            value={{
              cornerEntry: session.diagnostics.cornerEntry ? session.diagnostics.cornerEntry.toLowerCase() : null,
              centerApex: session.diagnostics.centerApex ? session.diagnostics.centerApex.toLowerCase() : null,
              cornerExit: session.diagnostics.cornerExit ? session.diagnostics.cornerExit.toLowerCase() : null,
            }}
            onChange={(rowId, colId) =>
              updateDiagnostics(
                rowId as 'cornerEntry' | 'centerApex' | 'cornerExit',
                colId.toUpperCase() as 'TIGHT' | 'NEUTRAL' | 'LOOSE',
              )
            }
          />
          {/* Legacy per-phase driver notes preserved */}
          {(['cornerEntry', 'centerApex', 'cornerExit'] as const).map(phase => {
            const notesField = `${phase}Notes` as const;
            const notesVal = session.diagnostics[notesField] || '';
            const labels = { cornerEntry: 'Entry notes', centerApex: 'Middle notes', cornerExit: 'Exit notes' };
            return (
              <input
                key={phase}
                type="text"
                placeholder={`${labels[phase]}…`}
                value={notesVal}
                onChange={e => handleNotesChange(notesField, e.target.value)}
                className="w-full min-h-11 bg-surface border border-outline-variant/50 text-on-surface text-sm font-mono p-2 rounded"
              />
            );
          })}
        </div>

        {/* 5 ── Notes & attachments */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Competition Notes</h3>
          <textarea
            className="w-full bg-surface border border-outline-variant rounded p-3 text-sm text-on-surface font-mono min-h-[80px]"
            placeholder="What did the driver feel on this run?"
            value={session.competitionNotes || ''}
            onChange={e => updateRun({ ...session, competitionNotes: e.target.value })}
          />
        </div>

        <div className="pt-4 border-t border-outline-variant/60">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-mono text-xs uppercase text-on-surface-variant">Attachments / Time Slips</h3>
            <label className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs uppercase font-mono text-primary font-bold cursor-pointer hover:underline">
              + Add Image
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddPhotos} />
            </label>
          </div>
          {(session.screenshots || []).length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
              {session.screenshots!.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={src} alt="attachment" className="h-20 rounded border border-outline-variant object-cover" />
                  <button onClick={() => handleDeletePhoto(i)} className="absolute top-1 right-1 bg-black/60 rounded-full min-w-11 min-h-11 flex items-center justify-center text-white hover:bg-black/90">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6 ── Next session */}
        <div className="mt-6 pt-4 border-t border-outline-variant/60">
          <button
            type="button"
            onClick={handleNextSession}
            className="w-full flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-display font-bold uppercase tracking-wider text-on-primary active:opacity-90"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_forward</span>
            NEXT SESSION
          </button>
        </div>
        </div>
        )}
      </section>
      )}

      {/* ── All Race Days (active first, then date desc — [15]) ───────────── */}
      {sortedWeekends.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-on-surface font-display font-bold uppercase text-sm tracking-wide">
              All Race Days
            </h2>
            <LogSetupChangesButton onLogSetupChanges={onLogSetupChanges} />
          </div>

          <div className="flex flex-col gap-3">
            {sortedWeekends.map(wk => {
              const isActiveWk = wk.id === activeWeekendId;
              const isWkExpanded = expandedWeekendIds.has(wk.id);
              const wkSessions = (wk.sessions || []).filter(s => s.id !== pendingSessionDeleteId);
              return (
                <div key={wk.id} className={`bg-surface-container border rounded-lg overflow-hidden ${isActiveWk ? 'border-primary/50' : 'border-outline-variant'}`}>
                  {/* Weekend header */}
                  <button
                    className="w-full p-3 flex justify-between items-center text-left hover:bg-surface-container-high transition-colors"
                    onClick={() => setExpandedWeekendIds(prev => {
                      const next = new Set(prev);
                      next.has(wk.id) ? next.delete(wk.id) : next.add(wk.id);
                      return next;
                    })}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-on-surface">{wk.name}</span>
                        {isActiveWk && <span className="font-mono text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Active</span>}
                        {isWeekendFinished(wk) && <span className="font-mono text-xs border border-outline-variant text-on-surface-variant px-1.5 py-0.5 rounded uppercase font-bold">Finished</span>}
                      </div>
                      <span className="font-mono text-sm text-on-surface-variant">
                        {wk.track}{wk.date ? ` · ${wk.date}` : ''} · {wkSessions.length} run{wkSessions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isActiveWk && !isWeekendFinished(wk) && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={event => { event.stopPropagation(); onActivateWeekend(wk.id); }}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onActivateWeekend(wk.id); } }}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-1 rounded border border-primary/40 text-primary font-mono text-xs font-bold uppercase"
                        >Set Active</span>
                      )}
                      {/* ⋯ menu: edit / delete */}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Race Day actions for ${wk.name}`}
                        onClick={event => { event.stopPropagation(); setMenuWeekendId(prev => prev === wk.id ? null : wk.id); }}
                        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setMenuWeekendId(prev => prev === wk.id ? null : wk.id); } }}
                        className="flex min-w-12 min-h-12 items-center justify-center rounded-full text-on-surface-variant hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {isWkExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {/* Sessions inside this weekend */}
                  {isWkExpanded && (
                    <div className="border-t border-outline-variant/30">
                      {wkSessions.length === 0 && (
                        <EmptyState
                          icon="timer"
                          title="No runs logged yet"
                          body={isWeekendFinished(wk) ? 'Test day finished with no logged runs.' : 'Log a run after your first laps.'}
                          cta={isWeekendFinished(wk) ? undefined : (isActiveWk ? { label: '+ Log run', onClick: openNewSession } : { label: 'Make Race Day active', onClick: () => onActivateWeekend(wk.id) })}
                        />
                      )}
                      {wkSessions.map(sx => {
                        const isActiveSx = sx.id === session.id;
                        return (
                          <div key={sx.id} className={`border-b border-outline-variant/20 last:border-0 ${isActiveSx ? 'bg-primary/5' : ''}`}>
                            <button
                              className="w-full p-3 flex justify-between items-center text-left"
                              onClick={() => setExpandedSessionId(expandedSessionId === sx.id ? null : sx.id)}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-primary font-bold">{sx.name}</span>
                                  {isActiveSx && <span className="font-mono text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Active</span>}
                                </div>
                                <span className="font-mono text-sm text-on-surface-variant">Best: {sx.bestLap || '--'} | Finish: {sx.finishPos || '--'}</span>
                              </div>
                              <span className="material-symbols-outlined text-on-surface-variant">
                                {expandedSessionId === sx.id ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>

                            {expandedSessionId === sx.id && (
                              <div className="p-3 bg-surface-container-lowest border-t border-outline-variant/30 text-sm font-mono text-on-surface-variant space-y-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs uppercase font-bold text-primary tracking-wider">Run Details</span>
                                  <div className="flex items-center gap-2">
                                    {!isWeekendFinished(wk) && <button
                                      onClick={(e) => { e.stopPropagation(); onSelectSession(sx, wk.id); }}
                                      className="flex min-h-11 items-center gap-1.5 px-3 py-1 bg-surface-bright hover:bg-surface-container-high border border-outline-variant rounded transition-colors text-xs font-bold uppercase font-mono text-on-surface cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[14px] text-primary">edit</span>
                                      Load
                                    </button>}
                                    <button
                                      aria-label={`Actions for ${sx.name}`}
                                      onClick={(e) => { e.stopPropagation(); setMenuSession({ weekendId: wk.id, session: sx }); }}
                                      className="flex min-h-12 min-w-12 items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                                    </button>
                                  </div>
                                </div>
                                <SessionSetupDetails record={sx} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {currentWeekend && !isWeekendFinished(currentWeekend) && (
        <section className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div>
            <h2 className="font-display font-bold uppercase text-on-surface">Finish Race Day</h2>
            <p className="font-mono text-sm text-on-surface-variant mt-1">Saves {lifecycleLabel('final', currentWeekend)}, closes this race night or test day, and makes that setup your new Current Setup.</p>
          </div>
          <button
            type="button"
            onClick={() => setPendingFinish({
              weekendId: currentWeekend.id,
              name: currentWeekend.name,
              finalLabel: lifecycleLabel('final', currentWeekend),
            })}
            className="w-full min-h-12 rounded-xl border-2 border-primary bg-primary text-on-primary font-display font-bold uppercase tracking-wide"
          >
            Finish Race Day
          </button>
        </section>
      )}

      {/* [13] Lap-time keypad bottom sheet */}
      <LapTimeKeypad
        open={lapPadOpen}
        title="Best lap"
        initialValue={session.bestLap || ''}
        onClose={() => setLapPadOpen(false)}
        onCommit={(v) => updateRun({ ...session, bestLap: v })}
      />

      <BottomSheet
        open={!!menuSession}
        onClose={() => setMenuSession(null)}
        title={menuSession?.session.name ?? 'Run'}
      >
        {menuSession && (
          <div className="space-y-1 pb-2">
            <button
              type="button"
              onClick={() => {
                onSelectSession(menuSession.session, menuSession.weekendId);
                setMenuSession(null);
              }}
              className="tap-target-block w-full gap-3 rounded-xl px-3 text-left text-on-surface hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-primary">edit</span>
              Load run
            </button>
            <button
              type="button"
              onClick={() => requestDeleteSession(menuSession.weekendId, menuSession.session)}
              className="tap-target-block w-full gap-3 rounded-xl px-3 text-left text-red-400 hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">delete</span>
              Delete run
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={!!menuWeekend}
        onClose={() => setMenuWeekendId(null)}
        title={menuWeekend?.name ?? 'Race Day'}
      >
        {menuWeekend && (
          <div className="space-y-1 pb-2">
            <button
              type="button"
              disabled={sharingWeekendId === menuWeekend.id}
              onClick={() => { void handleShareWeekend(menuWeekend); }}
              className="tap-target-block w-full gap-3 rounded-xl px-3 text-left text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-primary">{sharingWeekendId === menuWeekend.id ? 'progress_activity' : 'share'}</span>
              Share Race Day PDF
            </button>
            <button
              type="button"
              onClick={() => { setMenuWeekendId(null); openWeekendForm(menuWeekend); }}
              className="tap-target-block w-full gap-3 rounded-xl px-3 text-left text-on-surface hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-primary">edit</span>
              Edit Race Day
            </button>
            <button
              type="button"
              onClick={() => requestDeleteWeekend(menuWeekend)}
              className="tap-target-block w-full gap-3 rounded-xl px-3 text-left text-red-400 hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">delete</span>
              Delete Race Day
            </button>
          </div>
        )}
      </BottomSheet>

      {weekendFormModal}
      {sessionFormModal}
      {undoToastEl}
      <ConfirmSheet
        open={!!pendingFinish}
        title={`Finish ${pendingFinish?.name ?? 'Race Day'}?`}
        body={`${pendingFinish?.finalLabel ?? 'Final setup'} will be saved and this Race Day will move to history.`}
        confirmLabel="Finish"
        cancelLabel="Keep"
        onConfirm={confirmFinishWeekend}
        onCancel={() => setPendingFinish(null)}
      />
    </div>
  );
}
