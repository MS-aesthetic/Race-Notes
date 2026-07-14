import React, { useState, useRef, useEffect } from 'react';
import { ShockSession, ShockCorner, ShockDataPoint } from '../types';
import { byActiveCar } from '../lib/scope';
import { buildComparisonRows, downloadComparisonCsv } from '../lib/shockCompare';
import EmptyState from './ui/EmptyState';

// ─── Local type aliases (for readability within this file) ────────────────────

type Corner = ShockCorner;
type DataPoint = ShockDataPoint;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SmasherLoadsViewProps {
  /** Car scoping: filters list and stamps new sessions */
  activeCarId?: string | null;
  /** When lifted to App.tsx, the full sessions array is passed in */
  sessions?: ShockSession[];
  /** When lifted to App.tsx, save handler is passed in */
  onSave?: (sessions: ShockSession[]) => void;
  onGoToGarage?: () => void;
  onHelp?: (section: string) => void;
}

// ─── Image compression helper ─────────────────────────────────────────────────

function compressImage(file: File, maxPx = 1400, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxPx) { height = Math.round(height * maxPx / width); width = maxPx; }
        } else {
          if (height > maxPx) { width = Math.round(width * maxPx / height); height = maxPx; }
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

export function toTravel(height: number, maxHeight: number): number {
  return maxHeight - height;
}

export function travelToSvgY(travel: number, maxTravel: number, top: number, innerHeight: number): number {
  const displayRange = maxTravel > 0 ? maxTravel : 1;
  return top + (1 - travel / displayRange) * innerHeight;
}

function ShockLineChart({ session, svgRef }: ChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
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
  const heightMin = Math.min(...parsed.map(p => p.y));
  const heightMax = Math.max(...parsed.map(p => p.y));

  const xRange = xMax - xMin || 1;
  const maxTravel = toTravel(heightMin, heightMax);

  const toSvg = (x: number, height: number) => ({
    sx: PAD.left + ((x - xMin) / xRange) * innerW,
    sy: travelToSvgY(toTravel(height, heightMax), maxTravel, PAD.top, innerH),
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
        const val = maxTravel * (1 - i / yTicks);
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
        const travel = toTravel(p.y, heightMax);
        const labelAtRight = sx > PAD.left + innerW - 42;
        const labelAtTop = sy < PAD.top + 12;
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`Travel ${travel.toFixed(2)} in, height ${p.y.toFixed(2)} in`}
            onClick={() => setSelectedPoint(i)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedPoint(i);
              }
            }}
            className="cursor-pointer outline-none"
          >
            <title>{`Travel ${travel.toFixed(2)} in · Height ${p.y.toFixed(2)} in`}</title>
            <circle cx={sx} cy={sy} r={4} fill={col.line} />
            <circle cx={sx} cy={sy} r={2} fill="#111" />
            <text
              x={labelAtRight ? sx - 5 : sx + 5}
              y={labelAtTop ? sy + 11 : sy - 6}
              textAnchor={labelAtRight ? 'end' : 'start'}
              fill="#aaa"
              fontSize="7"
              fontFamily="monospace"
            >
              {`H ${p.y.toFixed(2)} in`}
            </text>
          </g>
        );
      })}

      {selectedPoint !== null && parsed[selectedPoint] && (() => {
        const point = parsed[selectedPoint];
        const travel = toTravel(point.y, heightMax);
        return (
          <g pointerEvents="none">
            <rect x={PAD.left + 4} y={PAD.top + 4} width="136" height="28" rx="4" fill="#181818" stroke={col.line} />
            <text x={PAD.left + 10} y={PAD.top + 15} fill="#ddd" fontSize="8" fontFamily="monospace">{`Travel ${travel.toFixed(2)} in`}</text>
            <text x={PAD.left + 10} y={PAD.top + 26} fill="#aaa" fontSize="8" fontFamily="monospace">{`Height ${point.y.toFixed(2)} in`}</text>
          </g>
        );
      })()}

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
        TRAVEL (in)
      </text>
    </svg>
  );
}

// ─── Compare / Overlay Chart (multiple sessions on one graph) ────────────────

const COMPARE_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

export function sessionCompareColor(index: number): string {
  return COMPARE_PALETTE[index % COMPARE_PALETTE.length];
}

interface CompareChartProps {
  sessions: ShockSession[];
}

function ShockCompareChart({ sessions }: CompareChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<{ sessionId: string; index: number } | null>(null);
  const W = 340, H = 240;
  const PAD = { top: 18, right: 20, bottom: 44, left: 54 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const series = sessions
    .map((session, i) => ({
      session,
      color: sessionCompareColor(i),
      points: session.points
        .map(p => ({ x: parseFloat(p.load), y: parseFloat(p.height) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y))
        .sort((a, b) => a.x - b.x),
    }))
    .filter(s => s.points.length >= 2);

  if (series.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: '#111' }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#555" fontSize="11" fontFamily="monospace">
          Select 2+ sessions with at least 2 data points each
        </text>
      </svg>
    );
  }

  const allX = series.flatMap(s => s.points.map(p => p.x));
  const allY = series.flatMap(s => s.points.map(p => p.y));
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const heightMin = Math.min(...allY), heightMax = Math.max(...allY);
  const xRange = xMax - xMin || 1;
  const maxTravel = toTravel(heightMin, heightMax);

  const toSvg = (x: number, height: number) => ({
    sx: PAD.left + ((x - xMin) / xRange) * innerW,
    sy: travelToSvgY(toTravel(height, heightMax), maxTravel, PAD.top, innerH),
  });

  const xTicks = 5, yTicks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: '#111', borderRadius: 6 }}>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = PAD.top + (i / yTicks) * innerH;
        const val = maxTravel * (1 - i / yTicks);
        return (
          <g key={`gy-${i}`}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#222" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fill="#666" fontSize="9" fontFamily="monospace">{val.toFixed(2)}</text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const x = PAD.left + (i / xTicks) * innerW;
        const val = xMin + (i / xTicks) * xRange;
        return (
          <g key={`gx-${i}`}>
            <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + innerH} stroke="#222" strokeWidth="1" />
            <text x={x} y={PAD.top + innerH + 14} textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">{Math.round(val)}</text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#444" strokeWidth="1.5" />
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="#444" strokeWidth="1.5" />

      {/* One polyline + points per session */}
      {series.map(s => {
        const poly = s.points.map(p => { const { sx, sy } = toSvg(p.x, p.y); return `${sx},${sy}`; }).join(' ');
        return (
          <g key={s.session.id}>
            <polyline points={poly} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, i) => {
              const { sx, sy } = toSvg(p.x, p.y);
              const travel = toTravel(p.y, heightMax);
              return (
                <circle
                  key={i}
                  cx={sx}
                  cy={sy}
                  r={4}
                  fill={s.color}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.session.label || s.session.corner}: Travel ${travel.toFixed(2)} in, height ${p.y.toFixed(2)} in`}
                  onClick={() => setSelectedPoint({ sessionId: s.session.id, index: i })}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPoint({ sessionId: s.session.id, index: i });
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <title>{`Travel ${travel.toFixed(2)} in · Height ${p.y.toFixed(2)} in`}</title>
                </circle>
              );
            })}
          </g>
        );
      })}

      {selectedPoint && (() => {
        const selectedSeries = series.find(item => item.session.id === selectedPoint.sessionId);
        const point = selectedSeries?.points[selectedPoint.index];
        if (!selectedSeries || !point) return null;
        const travel = toTravel(point.y, heightMax);
        return (
          <g pointerEvents="none">
            <rect x={PAD.left + 4} y={PAD.top + 4} width="150" height="39" rx="4" fill="#181818" stroke={selectedSeries.color} />
            <text x={PAD.left + 10} y={PAD.top + 15} fill={selectedSeries.color} fontSize="8" fontFamily="monospace">{selectedSeries.session.label || selectedSeries.session.corner}</text>
            <text x={PAD.left + 10} y={PAD.top + 26} fill="#ddd" fontSize="8" fontFamily="monospace">{`Travel ${travel.toFixed(2)} in`}</text>
            <text x={PAD.left + 10} y={PAD.top + 37} fill="#aaa" fontSize="8" fontFamily="monospace">{`Height ${point.y.toFixed(2)} in`}</text>
          </g>
        );
      })()}

      {/* Axis labels */}
      <text x={PAD.left + innerW / 2} y={H - 4} textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace" fontWeight="bold">LOAD (lb)</text>
      <text x={12} y={PAD.top + innerH / 2} textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}>TRAVEL (in)</text>
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

export default function SmasherLoadsView({ activeCarId = null, sessions: sessionsProp, onSave, onGoToGarage, onHelp }: SmasherLoadsViewProps = {}) {
  // When lifted state is provided use it; otherwise fall back to localStorage.
  const [localSessions, setLocalSessions] = useState<ShockSession[]>(loadFromStorage);
  const sessions = sessionsProp ?? localSessions;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => sessions[0]?.id ?? null
  );

  // New session form
  const [showNewForm, setShowNewForm] = useState(false);
  const [formCorner, setFormCorner] = useState<Corner>('LF');
  const [formSpring, setFormSpring] = useState('');
  const [formShock, setFormShock] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formRideHeightCtoC, setFormRideHeightCtoC] = useState('');

  // New data point entry
  const [entryHeight, setEntryHeight] = useState('');
  const [entryLoad, setEntryLoad] = useState('');

  // Compare / overlay mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);

  const persist = (next: ShockSession[]) => {
    if (onSave) {
      onSave(next); // lifted state path — App.tsx handles localStorage + cloud sync
    } else {
      setLocalSessions(next);
      saveToStorage(next);
    }
  };

  // Sync local state when sessionsProp changes (e.g. after cloud pull)
  useEffect(() => {
    if (sessionsProp !== undefined) {
      // activeSessionId may be stale; ensure it still exists
      if (activeSessionId && !sessionsProp.find(s => s.id === activeSessionId)) {
        setActiveSessionId(sessionsProp[0]?.id ?? null);
      }
    }
  }, [sessionsProp]);

  // Display only sessions belonging to the active car
  const displayedSessions = activeCarId ? byActiveCar<ShockSession>(sessions, activeCarId) : [];

  const toggleCompareId = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const compareSessions = displayedSessions.filter(s => compareIds.includes(s.id));
  const comparisonRows = compareSessions.length >= 2 ? buildComparisonRows(compareSessions) : [];

  const activeSession = displayedSessions.find(s => s.id === activeSessionId)
    ?? displayedSessions[0]
    ?? null;

  // ── Create new session ────────────────────────────────────────────────────

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCarId) return;
    const newSession: ShockSession = {
      id: `shock-${Date.now()}`,
      label: formLabel.trim() || `${formCorner} Session`,
      corner: formCorner,
      springRate: formSpring,
      shock: formShock,
      rideHeightCtoC: formRideHeightCtoC.trim(),
      date: new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }),
      points: [],
      carId: activeCarId,
    };
    const next = [newSession, ...sessions];
    persist(next);
    setActiveSessionId(newSession.id);
    setShowNewForm(false);
    setFormLabel('');
    setFormSpring('');
    setFormShock('');
    setFormRideHeightCtoC('');
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
    if (!window.confirm('Delete this load session and all its data points?')) return;
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

  // ── Photo handlers ────────────────────────────────────────────────────────
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSession) return;
    const files = e.target.files;
    if (!files) return;
    const compressed = await Promise.all(Array.from(files).map(f => compressImage(f)));
    const next = sessions.map(s =>
      s.id === activeSession.id ? { ...s, photos: [...(s.photos || []), ...compressed] } : s
    );
    persist(next);
    e.target.value = '';
  };

  const handleDeletePhoto = (idx: number) => {
    if (!activeSession) return;
    const next = sessions.map(s =>
      s.id === activeSession.id ? { ...s, photos: (s.photos || []).filter((_, i) => i !== idx) } : s
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
              Height vs. load — per corner
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onHelp && <button type="button" onClick={() => onHelp('loads')} aria-label="Load Session help" title="Load Session help" className="flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"><span className="material-symbols-outlined">help</span></button>}
            {displayedSessions.length > 1 && (
              <button
                onClick={() => setCompareMode(prev => !prev)}
                className={`h-9 px-3 font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5 border ${
                  compareMode ? 'bg-primary/15 text-primary border-primary/40' : 'border-outline-variant/50 text-on-surface-variant/70 hover:border-outline-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: compareMode ? "'FILL' 1" : "'FILL' 0" }}>compare_arrows</span>
                Compare
              </button>
            )}
            <button
              id="new-shock-session-btn"
              onClick={() => activeCarId ? setShowNewForm(true) : onGoToGarage?.()}
              className="h-9 px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5 flex-shrink-0 hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[15px]">{activeCarId ? 'add' : 'directions_car'}</span>
              {activeCarId ? 'New Load Session' : 'Go to Garage'}
            </button>
          </div>
        </div>

        {/* Session selector tabs — filtered to active car */}
        {displayedSessions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {displayedSessions.map(s => {
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

      {!activeCarId && (
        <EmptyState
          icon="directions_car"
          title="Add a car before logging load graphs"
          body="Load graphs stay tied to one car so shock data cannot cross cars."
          cta={{ label: 'Go to Garage', onClick: () => onGoToGarage?.() }}
        />
      )}

      {/* ── Compare / Overlay mode ── */}
      {compareMode && displayedSessions.length > 0 && (
        <div className="space-y-4">
          {/* Session picker */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">
                Select sessions to overlay ({compareSessions.length} selected)
              </span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {displayedSessions.map(s => {
                const idx = compareIds.indexOf(s.id);
                const isSelected = idx !== -1;
                const c = CORNER_COLORS[s.corner];
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded border cursor-pointer transition-all ${
                      isSelected ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/40 hover:border-outline-variant'
                    }`}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggleCompareId(s.id)} className="accent-primary" />
                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sessionCompareColor(idx) }} />
                    )}
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${c.badge} flex-shrink-0`}>{s.corner}</span>
                    <span className="font-mono text-xs text-on-surface truncate flex-1">
                      {s.label || s.shock} {s.springRate && `· ${s.springRate} lb/in`}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant/60 flex-shrink-0">{s.date}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {compareSessions.length < 2 ? (
            <p className="text-center text-xs font-mono text-on-surface-variant/50 py-6">Select at least 2 sessions above to overlay them.</p>
          ) : (
            <>
              {/* Overlay chart */}
              <div className="bg-[#111] border border-outline-variant rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-outline-variant/50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">compare_arrows</span>
                  <span className="font-mono text-[10px] font-bold uppercase text-on-surface">Overlay — {compareSessions.length} sessions</span>
                </div>
                <div className="p-2">
                  <ShockCompareChart sessions={compareSessions} />
                </div>
                {/* Legend */}
                <div className="px-4 py-2.5 border-t border-outline-variant/50 flex flex-wrap gap-x-4 gap-y-1.5">
                  {compareSessions.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sessionCompareColor(i) }} />
                      <span className="font-mono text-[10px] text-on-surface-variant">{s.corner} {s.label || s.shock}{s.springRate ? ` (${s.springRate} lb/in)` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interpolated comparison table */}
              <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-outline-variant/50 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-on-surface">Comparison Table (interpolated)</span>
                  <button
                    onClick={() => downloadComparisonCsv(compareSessions)}
                    className="h-7 px-2.5 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[9px] uppercase font-bold rounded transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[12px]">download</span>
                    CSV
                  </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-outline-variant/40">
                        <th className="text-left px-3 py-2 text-[10px] uppercase text-on-surface-variant font-bold whitespace-nowrap">Height (in)</th>
                        {compareSessions.map((s, i) => (
                          <th key={s.id} className="text-right px-3 py-2 text-[10px] uppercase font-bold whitespace-nowrap" style={{ color: sessionCompareColor(i) }}>
                            {s.corner} {s.label || s.shock}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, r) => (
                        <tr key={row.height} className={`border-b border-outline-variant/20 last:border-none ${r % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}>
                          <td className="px-3 py-1.5 text-on-surface-variant/70">{row.height}"</td>
                          {row.values.map((v, i) => (
                            <td key={i} className="px-3 py-1.5 text-right text-on-surface">
                              {v === null ? <span className="text-on-surface-variant/30">—</span> : `${v.toFixed(1)} lb`}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-2 text-[9px] font-mono text-on-surface-variant/50 border-t border-outline-variant/30">
                  Values are linearly interpolated between each session's own measured points — "—" means that height is outside what was measured for that session.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {activeCarId && !compareMode && displayedSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">show_chart</span>
          <p className="text-on-surface-variant text-sm font-mono uppercase">No load sessions yet</p>
          <p className="text-on-surface-variant/60 text-xs max-w-[260px]">
            Create a load session for a corner, enter height and load measurements, and the graph builds automatically.
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-2 px-4 py-2 bg-primary text-on-primary font-mono text-xs font-bold uppercase rounded hover:opacity-90"
          >
            + Create First Load Session
          </button>
        </div>
      )}

      {/* ── Active session view ── */}
      {!compareMode && activeSession && col && (
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
                title="Delete load session"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Load Session Label</label>
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
                  placeholder="e.g. 26-1"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Ride Height C-to-C (in)</label>
                <input
                  type="text"
                  value={activeSession.rideHeightCtoC ?? ''}
                  onChange={e => updateMeta('rideHeightCtoC', e.target.value)}
                  placeholder="Optional"
                  inputMode="decimal"
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
                  type="text"
                  inputMode="decimal"
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
                  type="text"
                  inputMode="decimal"
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

          {/* ── Dyno Graph Photos ── */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[16px]">photo_library</span>
                <h4 className="font-mono text-xs uppercase font-bold text-on-surface tracking-wider">Dyno Graph Photos</h4>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer h-8 px-3 border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary font-mono text-[10px] uppercase font-bold rounded transition-colors">
                <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                Add Photo
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleAddPhotos} />
              </label>
            </div>

            {(!activeSession.photos || activeSession.photos.length === 0) ? (
              <p className="text-on-surface-variant/40 font-mono text-[11px] italic text-center py-4">
                No photos yet — attach dyno graph images or printouts here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {activeSession.photos.map((photo, idx) => (
                  <div key={idx} className="relative group rounded overflow-hidden border border-outline-variant/50">
                    <img src={photo} alt={`Dyno photo ${idx + 1}`} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => handleDeletePhoto(idx)}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-error text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── New session modal ── */}
      {showNewForm && activeCarId && (
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
              <h3 className="font-display text-base font-bold uppercase tracking-wide">New Load Session</h3>
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
                <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Load Session Label / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Knoxville Practice"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className="w-full bg-surface text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
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
                    className="w-full bg-surface text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Shock</label>
                  <input
                    type="text"
                    placeholder="e.g. 26-1"
                    value={formShock}
                    onChange={e => setFormShock(e.target.value)}
                    className="w-full bg-surface text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Ride Height C-to-C (in) <span className="normal-case opacity-60">optional</span></label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 17"
                  value={formRideHeightCtoC}
                  onChange={e => setFormRideHeightCtoC(e.target.value)}
                  className="w-full bg-surface text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded"
                />
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
                  Create Load Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
