import React, { useState } from 'react';
import { Setup, SessionRecord, RaceWeekend, Team } from '../types';

interface DashboardViewProps {
  setup: Setup;
  weekends: RaceWeekend[];
  team: Team | null;
  onStartNewWeekend: () => void;
  onStartNewSession: () => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
  onEditSetup?: () => void;
}

export default function DashboardView({
  setup,
  weekends,
  team,
  onStartNewWeekend,
  onStartNewSession,
  onSelectSession,
  onEditSetup,
}: DashboardViewProps) {
  // Use mockup tire readings or the custom modified values
  const lfPress = setup.lf.tirePress !== '10.0' ? setup.lf.tirePress : '12.5';
  const rfPress = setup.rf.tirePress !== '11.0' ? setup.rf.tirePress : '14.0';
  const lrPress = setup.lr.tirePress !== '8.0' ? setup.lr.tirePress : '10.0';
  const rrPress = setup.rr.tirePress !== '8.0' ? setup.rr.tirePress : '11.5';

  // Toggle state to track which Race Weekend is expanded
  // Default to expand the first weekend so it looks immediately rich but collapsible
  const [expandedWeekendId, setExpandedWeekendId] = useState<string | null>(
    weekends.length > 0 ? weekends[0].id : null
  );

  return (
    <div className="space-y-6" id="dashboard-view-root">
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
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface">
                    {team.name}
                  </h2>
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

      {/* RACEDAY WEEKENDS & SESSIONS ACCORDION LOG */}
      <section id="section-recent-sessions">
        <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
          Race Weekends & Sessions Log
        </h2>

        {weekends.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-lg p-6 text-center text-on-surface-variant/80 font-mono text-xs">
            No Race Weekend logs captured yet. Start a new session above!
          </div>
        ) : (
          <div className="space-y-3.5">
            {weekends.map((weekend) => {
              const isExpanded = expandedWeekendId === weekend.id;

              return (
                <div
                  key={weekend.id}
                  className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden transition-all duration-300"
                  id={`weekend-card-${weekend.id}`}
                >
                  {/* Outer Weekend Accordion Header Row */}
                  <div
                    onClick={() => setExpandedWeekendId(isExpanded ? null : weekend.id)}
                    className="p-4 flex justify-between items-center bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer select-none"
                    id={`weekend-header-${weekend.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[22px]">calendar_today</span>
                      <div>
                        <h3 className="font-display text-base font-bold text-on-surface uppercase tracking-wide">
                          {weekend.name}
                        </h3>
                        <div className="text-xs text-on-surface-variant font-mono mt-0.5">
                          {weekend.track} • {weekend.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-surface-bright border border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant rounded font-mono">
                        {weekend.sessions.length} {weekend.sessions.length === 1 ? 'Sess.' : 'Sess.'}
                      </span>
                      <span
                        className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Nested Sessions Expanded List */}
                  {isExpanded && (
                    <div className="divide-y divide-outline-variant/30 bg-[#161616]/30" id={`weekend-sessions-${weekend.id}`}>
                      {weekend.sessions.length === 0 ? (
                        <div className="p-4 text-xs font-mono text-center text-on-surface-variant/50">
                          No sessions logged for this weekend yet.
                        </div>
                      ) : (
                        weekend.sessions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => onSelectSession(s, weekend.id)}
                            id={`session-item-${s.id}`}
                            className="p-3.5 pl-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-surface-container-high/40 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-3.5 mb-2 sm:mb-0">
                              <div className="bg-surface border border-outline-variant/50 w-9 h-9 rounded flex items-center justify-center flex-shrink-0 group-hover:border-primary transition-all">
                                <span className="text-[11px] text-on-surface font-mono font-bold">
                                  {s.type}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-on-surface uppercase tracking-wide group-hover:text-primary transition-colors">
                                  {s.name}
                                </div>
                                <div className="text-[11px] text-on-surface-variant/80 font-mono">
                                  {s.condition} {s.time ? `• ${s.time}` : ''}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                              <div className="text-left sm:text-right">
                                <span className="text-[9px] uppercase text-on-surface-variant block font-mono">Best Lap</span>
                                <span className={`font-mono text-xs font-bold ${s.isBest ? 'text-tertiary font-bold' : 'text-primary'}`}>
                                  {s.bestLap}
                                </span>
                              </div>
                              <span className="material-symbols-outlined text-xs text-on-surface-variant/40 group-hover:text-primary transition-colors pl-1">
                                arrow_forward
                              </span>
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

      {/* CTA Section */}
      <section className="grid grid-cols-2 gap-2" id="section-ctas">
        <button
          onClick={onStartNewWeekend}
          id="btn-start-new-weekend"
          className="flex-grow bg-surface-container-high border border-outline-variant/40 text-on-surface hover:bg-surface-container-highest active:scale-[0.98] transition-all cursor-pointer font-bold tracking-wider rounded h-12 uppercase font-mono text-[11px] flex items-center justify-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-base">
            calendar_today
          </span>
          + race weekend
        </button>
        <button
          onClick={onStartNewSession}
          id="btn-start-new-session"
          className="flex-grow bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer font-bold tracking-wider rounded h-12 uppercase font-mono text-[11px] flex items-center justify-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            timer
          </span>
          + session entry
        </button>
      </section>

      {/* Active Setup Summary */}
      <section id="section-active-setup">
        <h2 className="font-label-md text-label-md text-on-surface-variant uppercase mb-2">
          Current Active Setup
        </h2>
        <div className="bg-surface-container border border-outline-variant rounded-lg p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-[#d32f2f]/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full status-glow-green"></span>
                <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider">
                  Ready
                </span>
              </div>
              <h3 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight uppercase">
                {setup.chassis}
              </h3>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <div className="font-label-md text-label-md text-on-surface-variant font-mono">
                {setup.track}
              </div>
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                {setup.date}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 border-t border-outline-variant/60 pt-4">
            <div className="bg-surface-container-low p-2.5 rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors">
              <div className="font-label-sm text-xs text-on-surface-variant uppercase mb-1 font-mono">
                LF Pressure
              </div>
              <div className="font-display-lg text-lg sm:text-xl text-on-surface font-semibold font-mono">
                {lfPress} <span className="text-xs text-on-surface-variant font-normal">psi</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors">
              <div className="font-label-sm text-xs text-on-surface-variant uppercase mb-1 font-mono">
                RF Pressure
              </div>
              <div className="font-display-lg text-lg sm:text-xl text-on-surface font-semibold font-mono">
                {rfPress} <span className="text-xs text-on-surface-variant font-normal">psi</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors">
              <div className="font-label-sm text-xs text-on-surface-variant uppercase mb-1 font-mono">
                LR Pressure
              </div>
              <div className="font-display-lg text-lg sm:text-xl text-on-surface font-semibold font-mono">
                {lrPress} <span className="text-xs text-on-surface-variant font-normal">psi</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors">
              <div className="font-label-sm text-xs text-on-surface-variant uppercase mb-1 font-mono">
                RR Pressure
              </div>
              <div className="font-display-lg text-lg sm:text-xl text-on-surface font-semibold font-mono">
                {rrPress} <span className="text-xs text-on-surface-variant font-normal">psi</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}