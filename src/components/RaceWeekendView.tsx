import React, { useState } from 'react';
import { ActiveSession, TireDetails, TireInventoryItem, RaceWeekend, SessionRecord, WeatherSnapshot } from '../types';
import { User } from '@supabase/supabase-js';

interface RaceWeekendViewProps {
  user: User | null;
  session: ActiveSession;
  weekends: RaceWeekend[];
  tireInventory?: TireInventoryItem[];
  onUpdateSession: (updatedSession: ActiveSession) => void;
  onUpdateWeekend: (updated: RaceWeekend) => void;
  onDeleteSession: (weekendId: string, sessionId: string) => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
  onNewSession?: () => void;
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

export default function RaceWeekendView({
  session, weekends, tireInventory = [], onUpdateSession, onUpdateWeekend, onDeleteSession, onSelectSession, onNewSession,
}: RaceWeekendViewProps) {
  const [newAdjInput, setNewAdjInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [showZipInput, setShowZipInput] = useState(false);
  const [zipCode, setZipCode] = useState('');

  // ── Weekend lookup: prefer weekendId, fall back to track match ───────────────
  const currentWeekend =
    weekends.find(w => w.id === session.weekendId) ||
    weekends.find(w => w.track === session.track) ||
    weekends[0];

  const displaySessions = currentWeekend?.sessions || [];

  // ── Session helpers ──────────────────────────────────────────────────────────

  const updateDiagnostics = (phase: 'cornerEntry' | 'centerApex' | 'cornerExit', value: 'TIGHT' | 'NEUTRAL' | 'LOOSE') => {
    onUpdateSession({ ...session, diagnostics: { ...session.diagnostics, [phase]: value } });
  };

  const handleNotesChange = (phase: 'cornerEntryNotes' | 'centerApexNotes' | 'cornerExitNotes', value: string) => {
    onUpdateSession({ ...session, diagnostics: { ...session.diagnostics, [phase]: value } });
  };

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdjInput.trim()) return;
    let icon = 'build';
    const text = newAdjInput.toLowerCase();
    if (text.includes('pressure') || text.includes('tire') || text.includes('psi')) icon = 'air';
    else if (text.includes('bar') || text.includes('height')) icon = 'height';
    else if (text.includes('shock') || text.includes('click')) icon = 'settings_input_component';
    let label = newAdjInput;
    let value = '';
    const match = newAdjInput.match(/([+-]?\d+(?:\.\d+)?\s*\w+["']?|up\s*\d+\/\d+"?|down\s*\d+\/\d+"?)\s+(.+)/i);
    if (match) { value = match[1]; label = match[2].toUpperCase(); }
    else {
      const parts = newAdjInput.split(/(?=[+-]\d)|\s(?=\d)/);
      if (parts.length > 1) { label = parts[0].trim().toUpperCase(); value = parts.slice(1).join(' ').trim(); }
    }
    onUpdateSession({
      ...session,
      adjustments: [{ id: `adj-${Date.now()}`, icon, label: label.substring(0, 30), value: value || '+1 Adj' }, ...(session.adjustments || [])],
    });
    setNewAdjInput('');
  };

  const handleTireChange = (corner: 'lf' | 'rf' | 'lr' | 'rr', field: keyof TireDetails, val: string) => {
    const currentTires = session.tires || {
      lf: { compound: '', size: '', airPressure: session.pressures?.lf || '' },
      rf: { compound: '', size: '', airPressure: session.pressures?.rf || '' },
      lr: { compound: '', size: '', airPressure: session.pressures?.lr || '' },
      rr: { compound: '', size: '', airPressure: session.pressures?.rr || '' },
    };
    const updatedTires = { ...currentTires, [corner]: { ...currentTires[corner], [field]: val } };
    const updatedPressures = { ...session.pressures, [corner]: field === 'airPressure' ? val : currentTires[corner].airPressure };
    onUpdateSession({ ...session, tires: updatedTires, pressures: updatedPressures });
  };

  const handleTireInventorySelect = (corner: 'lf' | 'rf' | 'lr' | 'rr', tireId: string) => {
    const tire = tireInventory.find(t => t.id === tireId);
    const currentTires = session.tires || {
      lf: { compound: '', size: '', airPressure: session.pressures?.lf || '' },
      rf: { compound: '', size: '', airPressure: session.pressures?.rf || '' },
      lr: { compound: '', size: '', airPressure: session.pressures?.lr || '' },
      rr: { compound: '', size: '', airPressure: session.pressures?.rr || '' },
    };
    const updated: TireDetails = tire
      ? {
          ...currentTires[corner],
          tireId: tire.id,
          compound: tire.compound,
          size: tire.size,
          durometer: tire.durometer,
          backSpacing: tire.wheelBackspacing,
        }
      : { ...currentTires[corner], tireId: '' };
    onUpdateSession({ ...session, tires: { ...currentTires, [corner]: updated } });
  };

  // ── Photo helpers ────────────────────────────────────────────────────────────

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const compressed = await Promise.all(Array.from(files).map(f => compressImage(f)));
    onUpdateSession({ ...session, screenshots: [...(session.screenshots || []), ...compressed] });
    e.target.value = '';
  };

  const handleDeletePhoto = (idx: number) => {
    onUpdateSession({ ...session, screenshots: (session.screenshots || []).filter((_, i) => i !== idx) });
  };

  // ── Weather fetch ────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Weekend Info Banner ───────────────────────────────────────────── */}
      {currentWeekend && (
        <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">

          {/* Header row */}
          <div className="flex items-start gap-3 p-4 border-b border-outline-variant/50">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold uppercase text-base text-on-surface tracking-wide leading-tight">{currentWeekend.name}</h2>
              <p className="font-mono text-xs text-on-surface-variant mt-0.5">{currentWeekend.track} · {currentWeekend.date}</p>
              {currentWeekend.setupName && (
                <p className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">settings_input_component</span>
                  {currentWeekend.setupName}
                </p>
              )}
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider mt-1">
                {currentWeekend.sessions.length} Session{currentWeekend.sessions.length !== 1 ? 's' : ''} logged
              </p>
            </div>
          </div>

          {/* Weather */}
          <div className="p-4 border-b border-outline-variant/50 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Location & Weather</span>
              <div className="flex gap-2">
                <button
                  onClick={handleGPSWeather}
                  disabled={weatherLoading}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  {weatherLoading ? 'Fetching…' : 'GPS'}
                </button>
                <button
                  onClick={() => setShowZipInput(v => !v)}
                  className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded border transition-colors ${showZipInput ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
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
                  className="flex-1 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-sm text-on-surface outline-none"
                />
                <button type="submit" disabled={weatherLoading} className="bg-primary text-on-primary px-4 py-2 rounded font-mono text-xs font-bold uppercase disabled:opacity-50">
                  {weatherLoading ? '…' : 'Get'}
                </button>
              </form>
            )}

            {weatherError && <p className="font-mono text-[11px] text-red-400">{weatherError}</p>}

            {currentWeekend.weather ? (
              <div className="bg-surface rounded-lg border border-outline-variant/50 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="font-mono text-xs font-bold text-on-surface">{currentWeekend.weather.location}</span>
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
                      <span className="font-mono text-[10px] text-on-surface-variant">{label}:</span>
                      <span className="font-mono text-[10px] font-bold text-on-surface">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-[9px] text-on-surface-variant/40">
                  Fetched {new Date(currentWeekend.weather.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  <button className="underline hover:text-primary" onClick={() => { setShowZipInput(false); handleGPSWeather(); }}>Refresh</button>
                </p>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-on-surface-variant/40 italic">No weather data yet. Use GPS or enter a zip code above.</p>
            )}
          </div>

          {/* Weekend Notes */}
          <div className="p-4">
            <label className="font-mono text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-2">Weekend Notes</label>
            <textarea
              className="w-full bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded p-3 text-sm text-on-surface font-mono min-h-[72px] outline-none resize-none"
              placeholder="Overall notes for this weekend — goals, track conditions, key takeaways…"
              value={currentWeekend.notes || ''}
              onChange={e => handleWeekendNotes(e.target.value)}
            />
          </div>
        </section>
      )}

      {/* ── Active Session Editor ─────────────────────────────────────────── */}
      <section className="bg-surface-container rounded-lg p-4 border border-outline-variant">
        <h2 className="text-primary font-display font-bold uppercase mb-4">Active Log: {session.name}</h2>

        {/* Core Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Best Lap', key: 'bestLap' as const },
            { label: 'Quick Time', key: 'leaderLap' as const },
            { label: 'Finish Pos', key: 'finishPos' as const },
            { label: 'Max RPM', key: 'maxRpm' as const },
            { label: 'Condition', key: 'condition' as const },
            { label: 'Weather', key: 'weather' as const },
          ].map(({ label, key }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono text-on-surface-variant">{label}</span>
              <input
                type="text"
                className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono"
                value={(session as any)[key] || ''}
                onChange={e => onUpdateSession({ ...session, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>

        {/* Driver Feedback Diagnostics */}
        <div className="space-y-4 mb-6 pt-4 border-t border-outline-variant/60">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Driver Feedback Diagnostics</h3>
          {(['cornerEntry', 'centerApex', 'cornerExit'] as const).map(phase => {
            const val = session.diagnostics[phase];
            const notesField = `${phase}Notes` as const;
            const notesVal = session.diagnostics[notesField] || '';
            const labels = { cornerEntry: 'Corner Entry', centerApex: 'Center Apex', cornerExit: 'Corner Exit' };
            return (
              <div key={phase} className="bg-[#0a0a0a] border border-outline-variant/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs uppercase font-mono font-bold text-on-surface">{labels[phase]}</span>
                  <div className="flex rounded overflow-hidden border border-outline-variant/50">
                    {(['LOOSE', 'NEUTRAL', 'TIGHT'] as const).map((opt, idx) => (
                      <button
                        key={opt}
                        onClick={() => updateDiagnostics(phase, opt)}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${idx === 1 ? 'border-x border-outline-variant/50' : ''} ${
                          val === opt
                            ? opt === 'LOOSE' ? 'bg-red-500/20 text-red-400'
                            : opt === 'NEUTRAL' ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                            : 'bg-surface text-on-surface-variant hover:bg-surface-bright'
                        }`}
                      >{opt[0] + opt.slice(1).toLowerCase()}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Additional driver notes…"
                  value={notesVal}
                  onChange={e => handleNotesChange(notesField, e.target.value)}
                  className="w-full bg-surface border border-outline-variant/50 text-on-surface text-xs font-mono p-2 rounded"
                />
              </div>
            );
          })}
        </div>

        {/* Tire Selection */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-3">Tires Installed</h3>
          {tireInventory.length === 0 ? (
            <div className="bg-[#0e0e0e] border border-outline-variant rounded p-3 text-center">
              <p className="font-mono text-[11px] text-on-surface-variant/50 italic">No tires in inventory — add tires under Setups first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(['lf', 'rf', 'lr', 'rr'] as const).map(corner => {
                const selectedTireId = session.tires?.[corner]?.tireId || '';
                const airPressure = session.tires?.[corner]?.airPressure || session.pressures[corner] || '';
                return (
                  <div key={corner} className="bg-[#0e0e0e] border border-outline-variant rounded p-2 space-y-2">
                    <span className="text-[10px] font-bold text-primary uppercase block">{corner.toUpperCase()}</span>
                    <div className="relative">
                      <select
                        value={selectedTireId}
                        onChange={e => handleTireInventorySelect(corner, e.target.value)}
                        className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-[10px] px-2 py-1.5 rounded outline-none appearance-none pr-5"
                      >
                        <option value="">-- Select Tire --</option>
                        {tireInventory.map(t => (
                          <option key={t.id} value={t.id}>
                            #{t.tireNumber} · {t.compound} · {t.size}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-on-surface-variant pointer-events-none">expand_more</span>
                    </div>
                    {selectedTireId && (() => {
                      const t = tireInventory.find(x => x.id === selectedTireId);
                      return t ? (
                        <p className="font-mono text-[9px] text-on-surface-variant/60">
                          {t.compound} · {t.size} · {t.durometer} duro · {t.wheelBackspacing}" BS
                        </p>
                      ) : null;
                    })()}
                    <div>
                      <label className="block text-[9px] font-mono uppercase text-on-surface-variant/60 mb-0.5">Air Pressure (psi)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 11.5"
                        value={airPressure}
                        onChange={e => handleTireChange(corner, 'airPressure', e.target.value)}
                        className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-2 py-1 rounded outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Setup Adjustments */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Setup Adjustments</h3>
          <form onSubmit={handleAddAdjustment} className="flex gap-2 mb-3">
            <input type="text" className="flex-1 bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm font-mono" placeholder="e.g. +1/2 inch track bar" value={newAdjInput} onChange={e => setNewAdjInput(e.target.value)} />
            <button type="submit" className="bg-primary text-on-primary font-bold px-4 rounded">+</button>
          </form>
          <div className="flex flex-col gap-1">
            {session.adjustments?.map(adj => (
              <div key={adj.id} className="flex justify-between bg-surface p-2 rounded text-xs font-mono">
                <span className="text-on-surface-variant">{adj.label}</span>
                <span className="text-primary font-bold">{adj.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Competition Notes */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Competition Notes</h3>
          <textarea
            className="w-full bg-[#0e0e0e] border border-outline-variant rounded p-3 text-sm text-on-surface font-mono min-h-[80px]"
            placeholder="Log general session feedback…"
            value={session.competitionNotes || ''}
            onChange={e => onUpdateSession({ ...session, competitionNotes: e.target.value })}
          />
        </div>

        {/* Attachments / Time Slips */}
        <div className="pt-4 border-t border-outline-variant/60">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-mono text-xs uppercase text-on-surface-variant">Attachments / Time Slips</h3>
            <label className="text-[10px] uppercase font-mono text-primary font-bold cursor-pointer hover:underline">
              + Add Image
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddPhotos} />
            </label>
          </div>
          {(session.screenshots || []).length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
              {session.screenshots!.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={src} alt="attachment" className="h-20 rounded border border-outline-variant object-cover" />
                  <button onClick={() => handleDeletePhoto(i)} className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center text-white hover:bg-black/90">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── All Sessions in Weekend ───────────────────────────────────────── */}
      {currentWeekend && (
        <section>
          <h2 className="text-on-surface font-display font-bold uppercase mb-3 text-sm tracking-wide">
            All Sessions — {currentWeekend.name}
          </h2>

          {/* Prominent new session CTA */}
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="w-full flex items-center justify-center gap-3 py-4 mb-4 rounded-xl border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/10 transition-all active:scale-[0.98] text-primary font-display font-bold uppercase tracking-wider text-base"
            >
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              Start New Session
            </button>
          )}

          <div className="flex flex-col gap-2">
            {displaySessions.length === 0 && (
              <p className="font-mono text-xs text-on-surface-variant/40 text-center py-4">No sessions logged yet for this weekend.</p>
            )}
            {displaySessions.map((sx) => {
              const isActive = sx.id === session.id;
              return (
                <div key={sx.id} className={`bg-surface-container border rounded-lg overflow-hidden ${isActive ? 'border-primary/50' : 'border-outline-variant'}`}>
                  <button
                    className="w-full p-3 flex justify-between items-center text-left"
                    onClick={() => setExpandedSessionId(expandedSessionId === sx.id ? null : sx.id)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary font-bold">{sx.name}</span>
                        {isActive && <span className="font-mono text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Active</span>}
                      </div>
                      <span className="font-mono text-[10px] text-on-surface-variant">Best: {sx.bestLap || '--'} | Finish: {sx.finishPos || '--'}</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {expandedSessionId === sx.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {expandedSessionId === sx.id && (
                    <div className="p-3 bg-[#0e0e0e] border-t border-outline-variant/30 text-xs font-mono text-on-surface-variant space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Session Details</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectSession(sx, currentWeekend.id); }}
                            className="flex items-center gap-1.5 px-3 py-1 bg-surface-bright hover:bg-surface-container-high border border-outline-variant rounded transition-colors text-[10px] font-bold uppercase font-mono text-on-surface cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px] text-primary">edit</span>
                            Load
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(currentWeekend.id, sx.id); }}
                            className="flex items-center gap-1.5 px-3 py-1 border border-outline-variant hover:border-red-500/50 hover:bg-red-900/20 rounded transition-colors text-[10px] font-bold uppercase font-mono text-on-surface-variant hover:text-red-400 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Delete
                          </button>
                        </div>
                      </div>
                      <p><strong>Config:</strong> {sx.setupUsed || '—'}</p>
                      <p><strong>Conditions:</strong> {sx.condition}</p>
                      <p><strong>Notes:</strong> {sx.competitionNotes || 'None'}</p>
                      {sx.adjustments && sx.adjustments.length > 0 && (
                        <div>
                          <strong>Adjustments:</strong>
                          <ul className="list-disc pl-4 mt-1">
                            {sx.adjustments.map((a: any) => <li key={a.id}>{a.label} {a.value}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
