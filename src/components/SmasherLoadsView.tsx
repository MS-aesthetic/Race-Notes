import React, { useState, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Corner = 'LF' | 'RF' | 'LR' | 'RR';

interface DataPoint {
  height: string; // shock height in inches
  load: string;   // load in lbs
}

interface ShockSession {
  id: string;
  label: string;       // user-defined name / notes
  corner: Corner;
  springRate: string;  // e.g. "175"
  shock: string;       // e.g. "Afco 26-1"
  date: string;
  points: DataPoint[];
}

// ─── Colour palette per corner ───────────────────────────────────────────────

const CORNER_COLORS: Record<Corner, { line: string; fill: string; badge: string }> = {
  LF: { line: '#ef4444', fill: 'rgba(239,68,68,0.12)',   badge: 'bg-red-600/20 text-red-400 border-red-600/40' },
  RF: { line: '#3b82f6', fill: 'rgba(59,130,246,0.12)',  badge: 'bg-blue-600/20 text-blue-400 border-blue-600/40' },
  LR: { line: '#22c55e', fill: 'rgba(34,197,94,0.12)',   badge: 'bg-green-600/20 text-green-400 border-green-600/40' },
  RR: { line: '#f59e0b', fill: 'rgba(245,158,11,0.12)',  badge: 'bg-amber-600/20 text-amber-400 border-amber-600/40' },
};

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

interface ChartProps {
  session: ShockSession;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

function ShockLineChart({ session, svgRef }: ChartProps) {
  const W = 340, H = 220;
  const PAD = { top: 18, right: 20, bottom: 44, left: 54 };

  const parsed = session.points
    .map(p => ({ x: parseFloat(p.load), y: parseFloat(p.height) }))
    .filter(p => !isNaN(p.x) && !isNaN(p.y))
    .sort((a, b) => a.x - b.x);

  const col = CORNER_COLORS[session.corner];

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (parsed.length < 2) {
    return (
      <svg
        ref={svgRef as React.RefObject<SVGSVGElement>}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', background: '#111' }}
      >
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#555" fontSize="11" fontFamily="monospace">
          Enter at least 2 data points to render graph
        </text>
      </svg>
    );
  }

  const xMin = Math.min(...parsed.map(p => p.x));
  const xMax = Math.max(...parsed.map(p => p.x));
  const yMin = Math.min(...parsed.map(p => p.y));
  const yMax = Math.max(...parsed.map(p => p.y));

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toSvg = (x: number, y: number) => ({
    sx: PAD.left + ((x - xMin) / xRange) * innerW,
    sy: PAD.top + (1 - (y - yMin) / yRange) * innerH,
  });

  const polyPoints = parsed.map(p => {
    const { sx, sy } = toSvg(p.x, p.y);
    return `${sx},${sy}`;
  }).join(' ');

  // Fill area under curve
  const firstPt = toSvg(parsed[0].x, parsed[0].y);
  const lastPt = toSvg(parsed[parsed.length - 1].x, parsed[parsed.length - 1].y);
  const fillPoints = `${firstPt.sx},${PAD.top + innerH} ${polyPoints} ${lastPt.sx},${PAD.top + innerH}`;

  // Grid lines
  const xTicks = 5;
  const yTicks = 4;

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', background: '#111', borderRadius: 6 }}
    >
      {/* Grid lines */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = PAD.top + (i / yTicks) * innerH;
        const val = yMax - (i / yTicks) * yRange;
        return (
          <g key={`gy-${i}`}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#222" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fill="#666" fontSize="9" fontFamily="monospace">
              {val.toFixed(2)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const x = PAD.left + (i / xTicks) * innerW;
        const val = xMin + (i / xTicks) * xRange;
        return (
          <g key={`gx-${i}`}>
            <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + innerH} stroke="#222" strokeWidth="1" />
            <text x={x} y={PAD.top + innerH + 14} textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">
              {Math.round(val)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#444" strokeWidth="1.5" />
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="#444" strokeWidth="1.5" />

      {/* Fill */}
      <polygon points={fillPoints} fill={col.fill} />

      {/* Line */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke={col.line}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Points */}
      {parsed.map((p, i) => {
        const { sx, sy } = toSvg(p.x, p.y);
        return (
          <g key={i}>
            <circle cx={sx} cy={sy} r={4} fill={col.line} />
            <circle cx={sx} cy={sy} r={2} fill="#111" />
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={PAD.left + innerW / 2}
        y={H - 4}
        textAnchor="middle"
        fill="#888"
        fontSize="9"
        fontFamily="monospace"
        fontWeight="bold"
      >
        LOAD (lb)
      </text>
      <text
        x={12}
        y={PAD.top + innerH / 2}
        textAnchor="middle"
        fill="#888"
        fontSize="9"
        fontFamily="monospace"
        fontWeight="bold"
        transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}
      >
        HEIGHT (in)
      </text>
    </svg>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(session: ShockSession) {
  const rows = [
    ['Race Notes — Shock Load Graph Export'],
    [`Corner: ${session.corner}`, `Spring Rate: ${session.springRate} lb/in`, `Shock: ${session.shock}`],
    [`Label: ${session.label}`, `Date: ${session.date}`],
    [],
    ['Shock Height (in)', 'Load (lb)'],
    ...session.points.map(p => [p.height, p.load]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shock-load-${session.corner}-${session.label.replace(/\s+/g, '_') || session.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PNG Export via Canvas ────────────────────────────────────────────────────

function exportPng(svgEl: SVGSVGElement, session: ShockSession) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svgEl.viewBox.baseVal.width * 2;
    canvas.height = svgEl.viewBox.baseVal.height * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `shock-load-${session.corner}-${session.label.replace(/\s+/g, '_') || session.id}.png`;
    a.click();
  };
  img.src = url;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'race_notes_shock_graphs';

function loadFromStorage(): ShockSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(sessions: ShockSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SmasherLoadsView() {
  const [sessions, setSessions] = useState<ShockSession[]>(loadFromStorage);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => loadFromStorage()[0]?.id ?? null
  );

  // New session form
  const [showNewForm, setShowNewForm] = useState(false);
  const [formCorner, setFormCorner] = useState<Corner>('LF');
  const [formSpring, setFormSpring] = useState('');
  const [formShock, setFormShock] = useState('');
  const [formLabel, setFormLabel] = useState('');

  // New data point entry
  const [entryHeight, setEntryHeight] = useState('');
  const [entryLoad, setEntryLoad] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);

  const persist = (next: ShockSession[]) => {
    setSessions(next);
    saveToStorage(next);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  // ── Create new session ────────────────────────────────────────────────────

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession: ShockSession = {
      id: `shock-${Date.now()}`,
      label: formLabel.trim() || `${formCorner} Session`,
      corner: formCorner,
      springRate: formSpring,
      shock: formShock,
      date: new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }),
      points: [],
    };
    const next = [newSession, ...sessions];
    persist(next);
    setActiveSessionId(newSession.id);
    setShowNewForm(false);
    setFormLabel('');
    setFormSpring('');
    setFormShock('');
    setFormCorner('LF');
  };

  // ── Add data point ────────────────────────────────────────────────────────

  const handleAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const newPoint: DataPoint = { height: entryHeight, load: entryLoad };
    const updatedPoints = [...activeSession.points, newPoint];
    const next = sessions.map(s =>
      s.id === activeSession.id ? { ...s, points: updatedPoints } : s
    );
    persist(next);
    setEntryHeight('');
    setEntryLoad('');
  };

  // ── Delete data point ─────────────────────────────────────────────────────

  const handleDeletePoint = (idx: number) => {
    if (!activeSession) return;
    const next = sessions.map(s => {
      if (s.id !== activeSession.id) return s;
      return { ...s, points: s.points.filter((_, i) => i !== idx) };
    });
    persist(next);
  };

  // ── Delete session ────────────────────────────────────────────────────────

  const handleDeleteSession = (id: string) => {
    if (!window.confirm('Delete this shock session and all its data points?')) return;
    const next = sessions.filter(s => s.id !== id);
    persist(next);
    setActiveSessionId(next[0]?.id ?? null);
  };

  // ── Update session metadata inline ────────────────────────────────────────

  const updateMeta = (field: keyof ShockSession, value: string) => {
    if (!activeSession) return;
    const next = sessions.map(s =>
      s.id === activeSession.id ? { ...s, [field]: value } : s
    );
    persist(next);
  };

  const col = activeSession ? CORNER_COLORS[activeSession.corner] : null;

  return (
    <div className="space-y-5" id="load-graphs-root">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 border-b border-outline-variant pb-4">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h2 className="font-display font-bold tracking-tight text-2xl uppercase text-on-surface">
              Load Graphs
            </h2>
            <p className="font-mono text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Shock height vs. load — per corner
            </p>
          </div>
          <button
            id="new-shock-session-btn"
            onClick={() => setShowNewForm(true)}
            className="h-9 px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            New Session
          </button>
        </div>

        {/* Session selector tabs */}
        {sessions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {sessions.map(s => {
              const c = CORNER_COLORS[s.corner];
              const isActive = s.id === activeSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded border font-mono text-[10px] uppercase font-bold transition-all ${
                    isActive
                      ? `${c.badge} shadow-sm`
                      : 'border-outline-variant/50 text-on-surface-variant/60 hover:border-outline-variant'
                  }`}
                >
                  {s.corner} — {s.label || s.shock}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">show_chart</span>
          <p className="text-on-surface-variant text-sm font-mono uppercase">No shock sessions yet</p>
          <p className="text-on-surface-variant/60 text-xs max-w-[260px]">
            Create a session for a corner, enter your height & load measurements, and a line graph will be generated automatically.
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-2 px-4 py-2 bg-primary text-on-primary font-mono text-xs font-bold uppercase rounded hover:opacity-90"
          >
            + Create First Session
          </button>
        </div>
      )}

      {/* ── Active session view ── */}
      {activeSession && col && (
        <div className="space-y-4">

          {/* Session metadata card */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${col.badge}`}>
                  {activeSession.corner}
                </span>
                <span className="text-on-surface-variant text-[10px] font-mono">{activeSession.date}</span>
              </div>
              <button
                onClick={() => handleDeleteSession(activeSession.id)}
                className="p-1 text-on-surface-variant/50 hover:text-error transition-colors"
                title="Delete session"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Session Label</label>
                <input
                  type="text"
                  value={activeSession.label}
                  onChange={e => updateMeta('label', e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Corner</label>
                  <select
                    value={activeSession.corner}
                    onChange={e => updateMeta('corner', e.target.value as Corner)}
                    className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                  >
                    {(['LF', 'RF', 'LR', 'RR'] as Corner[]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Spring Rate (lb/in)</label>
                  <input
                    type="text"
                    value={activeSession.springRate}
                    onChange={e => updateMeta('springRate', e.target.value)}
                    placeholder="e.g. 175"
                    className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Shock</label>
                <input
                  type="text"
                  value={activeSession.shock}
                  onChange={e => updateMeta('shock', e.target.value)}
                  placeholder="e.g. Afco 26-1"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#111] border border-outline-variant rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-outline-variant/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]" style={{ color: col.line }}>show_chart</span>
              <span className="font-mono text-[10px] font-bold uppercase text-on-surface">
                {activeSession.corner} — {activeSession.label}
                {activeSession.springRate && ` · ${activeSession.springRate} lb/in`}
                {activeSession.shock && ` · ${activeSession.shock}`}
              </span>
            </div>
            <div className="p-2">
              <ShockLineChart session={activeSession} svgRef={svgRef} />
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv(activeSession)}
              className="flex-1 h-9 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[10px] uppercase font-bold rounded transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Export CSV
            </button>
            <button
              onClick={() => svgRef.current && exportPng(svgRef.current, activeSession)}
              className="flex-1 h-9 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[10px] uppercase font-bold rounded transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">image</span>
              Export PNG
            </button>
          </div>

          {/* Data entry form */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="material-symbols-outlined text-primary text-[16px]">add_circle</span>
              <h4 className="font-mono text-xs uppercase font-bold text-on-surface tracking-wider">Add Measurement</h4>
            </div>
            <form onSubmit={handleAddPoint} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">
                  Height (in)
                </label>
                <input
                  id="entry-height"
                  type="number"
                  step="any"
                  placeholder="e.g. 12.50"
                  value={entryHeight}
                  required
                  onChange={e => setEntryHeight(e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono px-3 py-1.5 outline-none rounded"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">
                  Load (lb)
                </label>
                <input
                  id="entry-load"
                  type="number"
                  step="any"
                  placeholder="e.g. 325"
                  value={entryLoad}
                  required
                  onChange={e => setEntryLoad(e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono px-3 py-1.5 outline-none rounded"
                />
              </div>
              <button
                type="submit"
                id="add-point-btn"
                className="h-[34px] px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all flex items-center gap-1 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add
              </button>
            </form>
          </div>

          {/* Data table */}
          {activeSession.points.length > 0 && (
            <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-outline-variant/50 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-on-surface">
                  Data Points ({activeSession.points.length})
                </span>
                <span className="font-mono text-[9px] text-on-surface-variant/60">tap row to delete</span>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-outline-variant/40">
                    <th className="text-left px-4 py-2 text-[10px] uppercase text-on-surface-variant font-bold">#</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase text-on-surface-variant font-bold">Height (in)</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase text-on-surface-variant font-bold">Load (lb)</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeSession.points]
                    .map((p, i) => ({ ...p, origIdx: i }))
                    .sort((a, b) => parseFloat(a.load) - parseFloat(b.load))
                    .map((p, row) => (
                      <tr
                        key={p.origIdx}
                        className={`border-b border-outline-variant/20 last:border-none hover:bg-surface-container-high transition-colors ${
                          row % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-4 py-2 text-on-surface-variant/60">{row + 1}</td>
                        <td className="px-4 py-2 text-right" style={{ color: col.line }}>{p.height}"</td>
                        <td className="px-4 py-2 text-right text-on-surface">{p.load} lb</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => handleDeletePoint(p.origIdx)}
                            className="text-on-surface-variant/30 hover:text-error transition-colors"
                            title="Delete point"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── New session modal ── */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface">
            <button
              onClick={() => setShowNewForm(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>

            <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
              <span className="material-symbols-outlined text-primary">show_chart</span>
              <h3 className="font-display text-base font-bold uppercase tracking-wide">New Shock Session</h3>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Corner</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['LF', 'RF', 'LR', 'RR'] as Corner[]).map(c => {
                    const cc = CORNER_COLORS[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormCorner(c)}
                        className={`py-1.5 rounded border font-mono text-xs font-bold uppercase transition-all ${
                          formCorner === c ? `${cc.badge} shadow-sm` : 'border-outline-variant/50 text-on-surface-variant/60 hover:border-outline-variant'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Session Label / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Knoxville Practice"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Spring Rate (lb/in)</label>
                  <input
                    type="text"
                    placeholder="e.g. 175"
                    value={formSpring}
                    onChange={e => setFormSpring(e.target.value)}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Shock</label>
                  <input
                    type="text"
                    placeholder="e.g. Afco 26-1"
                    value={formShock}
                    onChange={e => setFormShock(e.target.value)}
                    className="w-full bg-[#141414] text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1 justify-end font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-3 py-2 border border-outline-variant hover:bg-surface-container text-on-surface-variant uppercase rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary font-bold uppercase rounded hover:opacity-90"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
