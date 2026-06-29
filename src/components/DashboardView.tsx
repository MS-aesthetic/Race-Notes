import React, { useState } from 'react';
import { Setup, SessionRecord, RaceWeekend, Team, TireInventoryItem, Todo } from '../types';
import { byActiveCar } from '../lib/scope';

// Maps legacy full session type names to the short codes used in v2
const SESSION_NAME_MAP: [string, string][] = [
  ['HOT LAPS', 'HL'],
  ['Hot Laps', 'HL'],
  ['QUALIFYING', 'Qual'],
  ['Qualifying', 'Qual'],
  ['HEAT RACE', 'Heat'],
  ['Heat Race', 'Heat'],
  ['HEAT', 'Heat'],
  ['FEATURE', 'Feat.'],
  ['Feature', 'Feat.'],
  ['TEST', 'Test'],
];

function normalizeSessionName(name: string): string {
  for (const [full, code] of SESSION_NAME_MAP) {
    if (name.toUpperCase() === full.toUpperCase()) return code;
    if (name.toUpperCase().startsWith(full.toUpperCase() + ' ')) {
      const suffix = name.slice(full.length).trim();
      return `${code} ${suffix}`;
    }
  }
  return name;
}

interface DashboardViewProps {
  weekends: RaceWeekend[];
  savedSetups: Setup[];
  tireInventory: TireInventoryItem[];
  todos: Todo[];
  userId?: string;
  team: Team | null;
  onStartNewWeekend: () => void;
  onStartNewSession: () => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
  onSelectSetup: (setupId: string) => void;
  onGoToTodos: () => void;
  onDeleteWeekend: (weekendId: string) => void;
  activeCarId?: string | null;
}

export default function DashboardView({
  weekends,
  savedSetups,
  tireInventory,
  todos,
  userId,
  team,
  onStartNewWeekend,
  onStartNewSession,
  onSelectSession,
  onSelectSetup,
  onGoToTodos,
  onDeleteWeekend,
  activeCarId = null,
}: DashboardViewProps) {
  const [expandedWeekendId, setExpandedWeekendId] = useState<string | null>(
    weekends.length > 0 ? weekends[0].id : null
  );
  const [trackFilter, setTrackFilter] = useState<string>('');
  const [setupsOpen, setSetupsOpen] = useState(false);
  const [tiresOpen, setTiresOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  // Filter at display time — never mutate the master arrays
  const displayedSetups = byActiveCar(savedSetups, activeCarId);
  const displayedTires = byActiveCar(tireInventory, activeCarId);

  const uniqueTracks = Array.from(new Set(weekends.map(w => w.track).filter(Boolean))).sort();
  const filteredWeekends = trackFilter ? weekends.filter(w => w.track === trackFilter) : weekends;

  // Open tasks across all todo lists
  const openTaskLists = todos
    .map(list => ({
      list,
      openItems: list.items.filter(i => !i.done),
      assignedToMe: list.items.filter(i => !i.done && userId && i.assignedTo === userId),
    }))
    .filter(entry => entry.openItems.length > 0);

  return (
    <div className="space-y-5" id="dashboard-view-root">

      {/* TEAM BANNER */}
      {team && (
        <section id="section-team-banner">
          <div className="w-full bg-surface-container rounded-lg border border-outline-variant overflow-hidden relative shadow">
            {team.banner_url ? (
              <div className="h-32 md:h-40 w-full relative">
                <img src={team.banner_url} alt="Team Banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/60 to-transparent"></div>
              </div>
            ) : (
              <div className="h-24 w-full bg-surface-container-high relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#5b403d_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent"></div>
              </div>
            )}
            <div className={`px-5 pb-4 ${team.banner_url ? 'pt-0 -mt-10 relative z-10' : 'pt-4'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center font-display font-bold text-xl shadow-lg border border-outline-variant/30 shrink-0">
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface">{team.name}</h2>
                  <p className="font-mono text-[10px] text-primary uppercase tracking-widest font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    Active Team Roster
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA BUTTONS */}
      <section className="grid grid-cols-2 gap-2" id="section-ctas">
        <button
          onClick={onStartNewWeekend}
          className="bg-surface-container-high border border-outline-variant/40 text-on-surface hover:bg-surface-container-highest active:scale-[0.98] transition-all cursor-pointer font-bold tracking-wider rounded h-12 uppercase font-mono text-[11px] flex items-center justify-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-base">calendar_today</span>
          + Race Weekend
        </button>
        <button
          onClick={onStartNewSession}
          className="bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer font-bold tracking-wider rounded h-12 uppercase font-mono text-[11px] flex items-center justify-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
          + Session Entry
        </button>
      </section>

      {/* RACE WEEKENDS */}
      <section id="section-recent-sessions">
        <div className="flex flex-col gap-2 mb-3">
          <h2 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Race Weekends & Sessions</h2>
          {uniqueTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">filter_list</span>
              <div className="relative flex-1">
                <select
                  value={trackFilter}
                  onChange={e => setTrackFilter(e.target.value)}
                  className="w-full bg-surface-container border-2 border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-3 rounded-lg outline-none appearance-none cursor-pointer pr-8"
                >
                  <option value="">All Tracks</option>
                  {uniqueTracks.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
              </div>
              {trackFilter && (
                <button
                  onClick={() => setTrackFilter('')}
                  className="flex items-center justify-center w-11 h-11 rounded-lg border-2 border-outline-variant bg-surface-container shrink-0 active:opacity-70"
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">close</span>
                </button>
              )}
            </div>
          )}
        </div>

        {weekends.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-lg p-6 text-center text-on-surface-variant/80 font-mono text-xs">
            No race weekends logged yet. Create a weekend to get started.
          </div>
        ) : filteredWeekends.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-lg p-6 text-center text-on-surface-variant/80 font-mono text-xs">
            No weekends found for <span className="text-primary font-bold">{trackFilter}</span>.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWeekends.map((weekend) => {
              const isExpanded = expandedWeekendId === weekend.id;
              return (
                <div key={weekend.id} className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                  <div
                    onClick={() => setExpandedWeekendId(isExpanded ? null : weekend.id)}
                    className="p-4 flex justify-between items-center bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[22px]">calendar_today</span>
                      <div>
                        <h3 className="font-display text-base font-bold text-on-surface uppercase tracking-wide">{weekend.name}</h3>
                        <div className="text-xs text-on-surface-variant font-mono mt-0.5">{weekend.track} • {weekend.date}</div>
                        {weekend.setupName && (
                          <div className="text-[10px] text-on-surface-variant/60 font-mono mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">settings_input_component</span>
                            {weekend.setupName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-surface-bright border border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant rounded font-mono">
                        {weekend.sessions.length} {weekend.sessions.length === 1 ? 'Sess.' : 'Sess.'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteWeekend(weekend.id); }}
                        className="material-symbols-outlined text-on-surface-variant/40 hover:text-red-400 text-[18px] transition-colors p-1 rounded"
                        title="Delete weekend"
                      >delete</button>
                      <span
                        className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                      >expand_more</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="divide-y divide-outline-variant/30 bg-[#161616]/30">
                      {weekend.sessions.length === 0 ? (
                        <div className="p-4 text-xs font-mono text-center text-on-surface-variant/50">No sessions logged yet.</div>
                      ) : (
                        weekend.sessions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => onSelectSession(s, weekend.id)}
                            className="p-3.5 pl-6 flex justify-between items-center hover:bg-surface-container-high/40 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-semibold text-sm text-on-surface uppercase tracking-wide group-hover:text-primary transition-colors">{s.name}</div>
                                <div className="text-[11px] text-on-surface-variant/80 font-mono">{s.condition}{s.time ? ` • ${s.time}` : ''}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[9px] uppercase text-on-surface-variant block font-mono">Best Lap</span>
                                <span className="font-mono text-xs font-bold text-primary">{s.bestLap || '--'}</span>
                              </div>
                              <span className="material-symbols-outlined text-xs text-on-surface-variant/40 group-hover:text-primary transition-colors">arrow_forward</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SETUPS */}
      <section>
        <button
          onClick={() => setSetupsOpen(v => !v)}
          className="w-full flex items-center justify-between p-3 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            <span className="font-mono text-xs font-bold uppercase text-on-surface tracking-wider">
              Setups ({displayedSetups.length})
            </span>
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ transform: setupsOpen ? 'rotate(180deg)' : 'none' }}
          >expand_more</span>
        </button>

        {setupsOpen && (
          <div className="mt-1 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant/40">
            {displayedSetups.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-on-surface-variant/50">No setups saved yet.</div>
            ) : (
              displayedSetups.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectSetup(s.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
                >
                  <div>
                    <div className="font-mono text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{s.chassis}</div>
                    <div className="font-mono text-[10px] text-on-surface-variant">{s.track} · {s.date}</div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary text-[18px] transition-colors">chevron_right</span>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* TIRES */}
      <section>
        <button
          onClick={() => setTiresOpen(v => !v)}
          className="w-full flex items-center justify-between p-3 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">trip_origin</span>
            <span className="font-mono text-xs font-bold uppercase text-on-surface tracking-wider">
              Tires ({displayedTires.length})
            </span>
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ transform: tiresOpen ? 'rotate(180deg)' : 'none' }}
          >expand_more</span>
        </button>

        {tiresOpen && (
          <div className="mt-1 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant/40">
            {displayedTires.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-on-surface-variant/50">No tires in inventory — add tires under Setups.</div>
            ) : (
              displayedTires.map(t => (
                <div key={t.id} className="px-4 py-2.5 bg-surface-container flex items-baseline gap-4">
                  <span className="font-mono text-xs font-bold text-primary shrink-0">#{t.tireNumber}</span>
                  <span className="font-mono text-[11px] text-on-surface">
                    {t.size}{t.size && !t.size.includes('"') ? '"' : ''} <span className="text-outline-variant mx-1">|</span> BS {t.wheelBackspacing}" <span className="text-outline-variant mx-1">|</span> {t.compound} <span className="text-outline-variant mx-1">|</span> Duro {t.durometer || '—'}{t.airPressure ? <><span className="text-outline-variant mx-1">|</span> {t.airPressure} psi</> : null}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* OPEN TASKS */}
      <section>
        <button
          onClick={() => setTasksOpen(v => !v)}
          className="w-full flex items-center justify-between p-3 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
            <span className="font-mono text-xs font-bold uppercase text-on-surface tracking-wider">
              Open Tasks ({openTaskLists.reduce((n, e) => n + e.openItems.length, 0)})
            </span>
            {openTaskLists.some(e => e.assignedToMe.length > 0) && (
              <span className="bg-primary/20 text-primary text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded">
                Assigned to me
              </span>
            )}
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ transform: tasksOpen ? 'rotate(180deg)' : 'none' }}
          >expand_more</span>
        </button>

        {tasksOpen && (
          <div className="mt-1 border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant/40">
            {openTaskLists.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-on-surface-variant/50">No open tasks.</div>
            ) : (
              openTaskLists.map(({ list, openItems, assignedToMe }) => (
                <button
                  key={list.id}
                  onClick={onGoToTodos}
                  className="w-full px-4 py-3 bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{list.title}</span>
                    <div className="flex items-center gap-1.5">
                      {assignedToMe.length > 0 && (
                        <span className="bg-primary/20 text-primary text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded">
                          {assignedToMe.length} mine
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-on-surface-variant">{openItems.length} open</span>
                      <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary text-[16px] transition-colors">chevron_right</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {openItems.slice(0, 3).map(item => (
                      <div key={item.id} className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.assignedTo === userId ? 'bg-primary' : 'bg-outline-variant'}`}></span>
                        <span className={`font-mono text-[10px] truncate ${item.assignedTo === userId ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                    {openItems.length > 3 && (
                      <span className="font-mono text-[9px] text-on-surface-variant/50 pl-3">+{openItems.length - 3} more</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </section>

    </div>
  );
}
