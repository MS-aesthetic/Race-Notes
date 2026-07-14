import { useEffect, useState } from 'react';
import { Setup, SessionRecord, RaceWeekend, Team, TireInventoryItem, Todo, MaintenanceComponent } from '../types';
import { byActiveCar, sortWeekends } from '../lib/scope';
import { getComponentStatus } from '../lib/maintenance';
import { activeChecklistItems, getMainChecklist } from '../lib/mainChecklist';
import {
  describeServiceStatus,
  pickWorstComponent,
  type QuickServiceOutcome,
  type QuickServiceRequest,
} from '../lib/serviceLog';
import { useUndoableDelete } from '../lib/undo';
import BottomSheet from './ui/BottomSheet';
import CollapsibleSection from './ui/CollapsibleSection';
import EmptyState from './ui/EmptyState';
import UndoToast, { InfoToast } from './ui/UndoToast';
import GetRaceReadyCard from './GetRaceReadyCard';

interface DashboardViewProps {
  weekends: RaceWeekend[];
  savedSetups: Setup[];
  tireInventory: TireInventoryItem[];
  todos: Todo[];
  userId?: string;
  team: Team | null;
  /** [1] Get-race-ready: cars live in App/Settings — only the count is needed. */
  carCount: number;
  onStartNewWeekend: () => void;
  /** Opens weekend form and continues into quick-log after creation. */
  onStartNewWeekendForRun: () => void;
  onStartNewSession: () => void;
  /** [7] Create weekend @ most-recent track dated today, activate, deep-link new-session. */
  onQuickStartWeekend: () => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
  onGoToTodos: () => void;
  onGoToTires?: () => void;
  onGoToSetups: () => void;
  onGoToSessions: () => void;
  onGoToGarage: () => void;
  /** Immediate delete (no confirm) — the undo toast here is the safety net. */
  onDeleteWeekend: (weekendId: string) => void;
  activeCarId?: string | null;
  activeWeekendId?: string | null;
  maintenance?: MaintenanceComponent[];
  onGoToService?: () => void;
  /** [25] Quick service log; returns records for the UNDO toast (null if component vanished). */
  onQuickService: (req: QuickServiceRequest) => QuickServiceOutcome | null;
  onUndoQuickService: (outcome: QuickServiceOutcome) => void;
}

export default function DashboardView({
  weekends,
  savedSetups,
  tireInventory,
  todos,
  userId,
  team,
  carCount,
  onStartNewWeekend,
  onStartNewWeekendForRun,
  onStartNewSession,
  onQuickStartWeekend,
  onSelectSession,
  onGoToTodos,
  onGoToTires,
  onGoToSetups,
  onGoToSessions,
  onGoToGarage,
  onDeleteWeekend,
  activeCarId = null,
  activeWeekendId = null,
  maintenance = [],
  onGoToService,
  onQuickService,
  onUndoQuickService,
}: DashboardViewProps) {
  // [8] Weekend delete lives behind the ⋯ sheet with an undo window.
  const weekendUndo = useUndoableDelete<RaceWeekend>();
  const pendingDeleteId = weekendUndo.pending?.id ?? null;
  const visibleWeekends = weekends.filter(w => w.id !== pendingDeleteId);
  const sortedWeekends = sortWeekends(visibleWeekends, activeWeekendId);
  const activeWeekend = visibleWeekends.find(w => w.id === activeWeekendId) ?? null;

  // [7] Hero + no-active-weekend teaching sheet
  const [noWeekendSheetOpen, setNoWeekendSheetOpen] = useState(false);
  const [weekendMenuOpen, setWeekendMenuOpen] = useState(false);

  const lastTrack = sortedWeekends.find(w => w.track)?.track ?? '';
  const lastRun = (() => {
    for (const w of sortedWeekends) {
      if (w.sessions.length > 0) return { session: w.sessions[0], weekendId: w.id };
    }
    return null;
  })();
  const totalSessions = weekends.reduce((n, w) => n + w.sessions.length, 0);

  const handleLogRun = () => {
    if (activeWeekend) onStartNewSession();
    else setNoWeekendSheetOpen(true);
  };

  // Filter at display time — never mutate the master arrays
  const displayedSetups = byActiveCar(savedSetups, activeCarId);
  const displayedTires = byActiveCar(tireInventory, activeCarId);

  const mainChecklist = getMainChecklist(todos);
  const mainChecklistItems = mainChecklist ? activeChecklistItems(mainChecklist) : [];
  const openTaskLists = mainChecklist ? [{
    list: mainChecklist,
    openItems: mainChecklistItems.filter(i => !i.done),
    assignedToMe: mainChecklistItems.filter(i => !i.done && userId && i.assignedTo === userId),
  }].filter(entry => entry.openItems.length > 0) : [];
  const openTaskCount = openTaskLists.reduce((n, e) => n + e.openItems.length, 0);

  // [25] Service chip + quick service sheet
  // Car parts follow active-car scope; rig parts remain team-global.
  const visibleMaintenance = maintenance.filter(c => c.scope === 'rig' || !activeCarId || c.carId === activeCarId);
  const worst = pickWorstComponent(visibleMaintenance, weekends, savedSetups);
  const dueItems = visibleMaintenance.filter(c => getComponentStatus(c, weekends, savedSetups).state !== 'ok');
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcNotes, setSvcNotes] = useState('');
  const [svcCost, setSvcCost] = useState('');
  const [svcDate, setSvcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [svcComponentId, setSvcComponentId] = useState('');
  const [svcToast, setSvcToast] = useState<QuickServiceOutcome | null>(null);
  const selectedServiceComponent = visibleMaintenance.find(c => c.id === svcComponentId) ?? worst?.component ?? null;
  const selectedServiceStatus = selectedServiceComponent
    ? getComponentStatus(selectedServiceComponent, weekends, savedSetups)
    : null;

  useEffect(() => {
    if (!svcToast) return;
    const t = setTimeout(() => setSvcToast(null), 6000);
    return () => clearTimeout(t);
  }, [svcToast]);

  const openQuickService = () => {
    setSvcComponentId(worst?.component.id ?? visibleMaintenance[0]?.id ?? '');
    setSvcNotes('');
    setSvcCost('');
    setSvcDate(new Date().toISOString().slice(0, 10));
    setSvcOpen(true);
  };

  const saveQuickService = () => {
    if (!selectedServiceComponent) return;
    const cost = parseFloat(svcCost);
    const d = new Date(`${svcDate}T12:00`);
    const outcome = onQuickService({
      componentId: selectedServiceComponent.id,
      notes: svcNotes.trim(),
      cost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
      dateISO: isNaN(d.getTime()) ? undefined : d.toISOString(),
    });
    setSvcOpen(false);
    if (outcome) setSvcToast(outcome);
  };

  const requestWeekendDelete = (wk: RaceWeekend) => {
    setWeekendMenuOpen(false);
    weekendUndo.requestDelete({
      id: wk.id,
      label: wk.name,
      item: wk,
      // Local removal/restore is handled by filtering on `pending.id` in render.
      removeFromState: () => {},
      restoreToState: () => {},
      // Commit runs App's deleteWeekendNow (state + localStorage + cloud delete).
      commit: () => onDeleteWeekend(wk.id),
    });
  };

  const awLastLap = activeWeekend?.sessions.find(s => s.bestLap)?.bestLap ?? null;

  return (
    <div className="space-y-5" id="dashboard-view-root">

      {/* Team identity leads Dashboard. Text uses opaque token surfaces. */}
      {team && (
        <section id="section-team-banner">
          <div className="w-full bg-surface-container rounded-lg border border-outline-variant overflow-hidden shadow">
            {team.banner_url && (
              <div className="h-32 md:h-40 w-full relative">
                <img src={team.banner_url} alt="Team Banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-surface/55" aria-hidden="true" />
              </div>
            )}
            <div className="px-5 py-4 bg-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center font-display font-bold text-xl shadow-lg border border-outline-variant/30 shrink-0">
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface truncate">{team.name}</h2>
                  <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                    Active Team Roster
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* [1] FIRST-RUN "GET RACE-READY" */}
      <GetRaceReadyCard
        carCount={carCount}
        weekendCount={weekends.length}
        setupCount={displayedSetups.length}
        sessionCount={totalSessions}
        onAddCar={onGoToGarage}
        onStartWeekend={handleLogRun}
        onEnterSetup={onGoToSetups}
        onLogRun={handleLogRun}
      />

      {/* [7] + LOG RUN HERO */}
      <section className="space-y-2" id="section-log-run-hero">
        <button
          onClick={handleLogRun}
          className="w-full min-h-16 bg-primary text-on-primary rounded-xl shadow-lg font-display text-2xl font-bold uppercase tracking-wide flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
          + Log Run
        </button>
        {lastRun && (
          <button
            onClick={() => onSelectSession(lastRun.session, lastRun.weekendId)}
            className="w-full min-h-12 px-3 flex items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container text-left hover:bg-surface-container-high transition-colors"
          >
            <span className="font-mono text-xs text-on-surface-variant truncate">
              Last run: <span className="text-on-surface font-bold">{lastRun.session.name}</span>
              {lastRun.session.bestLap ? <> · <span className="text-primary font-bold">{lastRun.session.bestLap}</span></> : null}
            </span>
            <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px] shrink-0">arrow_forward</span>
          </button>
        )}
      </section>

      {/* [9] ACTIVE WEEKEND SUMMARY — the full list lives in the Sessions tab */}
      <section id="section-active-weekend">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Active Weekend</h2>
          <button
            onClick={onStartNewWeekend}
            className="min-h-12 px-2 font-mono text-[11px] font-bold uppercase text-primary hover:opacity-80"
          >
            + New Weekend
          </button>
        </div>

        {visibleWeekends.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-lg">
            <EmptyState
              icon="sports_score"
              title="No race weekends yet"
              body="Start a weekend, then log runs, laps, setup changes, and maintenance."
              cta={{ label: '+ Race Weekend', icon: 'calendar_today', onClick: onStartNewWeekend }}
            />
          </div>
        ) : !activeWeekend ? (
          <button
            onClick={onGoToSessions}
            className="w-full min-h-12 px-4 py-3 flex items-center justify-between gap-2 bg-surface-container border border-outline-variant rounded-lg text-left hover:bg-surface-container-high transition-colors"
          >
            <span className="font-mono text-xs text-on-surface-variant">
              No active weekend — pick one in <span className="text-primary font-bold">Sessions</span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <div className="bg-surface-container border border-primary/60 rounded-lg overflow-hidden">
            <div className="flex items-stretch">
              <button onClick={onGoToSessions} className="flex-1 min-h-12 min-w-0 p-4 text-left group">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                  <h3 className="font-display text-base font-bold text-on-surface uppercase tracking-wide truncate group-hover:text-primary transition-colors">
                    {activeWeekend.name}
                  </h3>
                </div>
                <div className="text-xs text-on-surface-variant font-mono mt-1 truncate">
                  {activeWeekend.track} • {activeWeekend.date}
                </div>
                <div className="text-[11px] font-mono mt-1.5 flex items-center gap-3">
                  <span className="text-on-surface-variant">
                    {activeWeekend.sessions.length} run{activeWeekend.sessions.length === 1 ? '' : 's'}
                  </span>
                  {awLastLap && (
                    <span className="text-on-surface-variant">
                      Last lap <span className="text-primary font-bold">{awLastLap}</span>
                    </span>
                  )}
                </div>
              </button>
              <button
                aria-label={`Weekend actions for ${activeWeekend.name}`}
                onClick={() => setWeekendMenuOpen(true)}
                className="min-w-12 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">more_horiz</span>
              </button>
            </div>
            {activeWeekend.sessions.length === 0 && (
              <div className="border-t border-outline-variant/40">
                <EmptyState
                  icon="timer"
                  title="Nothing logged yet"
                  body="Hit + LOG RUN after your first laps."
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* [25] SERVICE CHIP — worst-status component, tap → quick service log */}
      {worst && (
        <section id="section-service-chip">
          <button
            type="button"
            onClick={openQuickService}
            aria-label={`Log maintenance for ${worst.component.name}`}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1 text-left active:opacity-80"
          >
            <span className="status-chip min-w-0">
              <span
                className={`material-symbols-outlined ${worst.status.state === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}
                aria-hidden="true"
              >warning</span>
              <span className="truncate">
                {worst.component.name} — {describeServiceStatus(worst.component, worst.status)}
              </span>
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] font-bold uppercase text-primary">Log maintenance</span>
          </button>
        </section>
      )}

      {/* SERVICE DUE (collapsible) */}
      {dueItems.length > 0 && (
        <CollapsibleSection
          title={`Maintenance Due (${dueItems.length})`}
          storageKey="race_notes_dash_service_open"
          defaultOpen={false}
          badge={dueItems.some(c => getComponentStatus(c, weekends, savedSetups).state === 'overdue') ? (
            <span className="bg-red-500/20 text-red-400 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded shrink-0">Overdue</span>
          ) : undefined}
        >
          <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant/40">
            {dueItems.map(c => {
              const st = getComponentStatus(c, weekends, savedSetups);
              const chipCls = st.state === 'overdue'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30';
              return (
                <button
                  key={c.id}
                  onClick={onGoToService}
                  className="w-full px-4 py-3 min-h-12 bg-surface-container hover:bg-surface-container-high transition-colors text-left flex items-center gap-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{c.name}</span>
                      <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${chipCls}`}>
                        {st.state === 'overdue' ? 'Overdue' : 'Due'}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant/50">{c.category}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-surface-variant rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${st.state === 'overdue' ? 'bg-red-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(st.pct * 100, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-on-surface-variant shrink-0">
                        {st.used}/{st.limit}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary text-[16px] transition-colors">chevron_right</span>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* MAIN CHECKLIST (collapsible) */}
      <CollapsibleSection
        title={`Main Checklist (${openTaskCount})`}
        storageKey="race_notes_dash_checklist_open"
        defaultOpen={false}
        badge={openTaskLists.some(e => e.assignedToMe.length > 0) ? (
          <span className="bg-primary/20 text-primary text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded shrink-0">
            Assigned to me
          </span>
        ) : undefined}
      >
        {openTaskLists.length === 0 ? (
          <EmptyState
            icon="checklist"
            title="Main Checklist clear"
            body="Nothing outstanding — the rig's ready to roll."
            cta={{ label: 'Open checklist', onClick: onGoToTodos }}
          />
        ) : (
          <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant/40">
            {openTaskLists.map(({ list, openItems, assignedToMe }) => (
              <button
                key={list.id}
                onClick={onGoToTodos}
                className="w-full px-4 py-3 min-h-12 bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
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
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* [9] SETUPS / TIRES — one-line link-outs (full lists live in the Setups tab) */}
      <section className="grid grid-cols-2 gap-2" id="section-linkouts">
        <button
          onClick={onGoToSetups}
          className="min-h-12 px-3 flex items-center justify-between gap-2 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <span className="font-mono text-xs font-bold uppercase text-on-surface tracking-wider truncate">
              Setups ({displayedSetups.length})
            </span>
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
        </button>
        <button
          onClick={() => onGoToTires?.()}
          className="min-h-12 px-3 flex items-center justify-between gap-2 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[18px]">trip_origin</span>
            <span className="font-mono text-xs font-bold uppercase text-on-surface tracking-wider truncate">
              Tires ({displayedTires.length})
            </span>
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
        </button>
      </section>

      {/* [7] TEACHING SHEET — no active weekend */}
      <BottomSheet
        open={noWeekendSheetOpen}
        onClose={() => setNoWeekendSheetOpen(false)}
        title="No active weekend — start one?"
      >
        <div className="space-y-3 pb-2">
          <p className="text-sm text-on-surface-variant">
            Runs live inside a race weekend. Start one and you’ll go straight into your first run.
          </p>
          {visibleWeekends.length > 0 ? (
            <button
              onClick={() => { setNoWeekendSheetOpen(false); onQuickStartWeekend(); }}
              className="w-full min-h-14 bg-primary text-on-primary rounded-xl font-display font-bold uppercase tracking-wide flex items-center justify-center gap-2 active:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              <span className="truncate">Start weekend at {lastTrack || 'last track'} today</span>
            </button>
          ) : (
            <button
              onClick={() => { setNoWeekendSheetOpen(false); onStartNewWeekendForRun(); }}
              className="w-full min-h-14 bg-primary text-on-primary rounded-xl font-display font-bold uppercase tracking-wide flex items-center justify-center gap-2 active:opacity-90"
            >
              <span className="material-symbols-outlined">calendar_today</span>
              Set up your first weekend
            </button>
          )}
          <button
            onClick={() => { setNoWeekendSheetOpen(false); onStartNewWeekendForRun(); }}
            className="w-full min-h-12 rounded-xl border border-outline-variant text-on-surface font-mono text-xs font-bold uppercase tracking-wider active:opacity-80"
          >
            Pick track…
          </button>
        </div>
      </BottomSheet>

      {/* [8] ⋯ WEEKEND MENU */}
      <BottomSheet
        open={weekendMenuOpen}
        onClose={() => setWeekendMenuOpen(false)}
        title={activeWeekend?.name ?? 'Weekend'}
      >
        <div className="space-y-1 pb-2">
          <button
            onClick={() => { setWeekendMenuOpen(false); onGoToSessions(); }}
            className="tap-target-block gap-3 rounded-xl px-3 text-left text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">sports_score</span>
            Open in Sessions
          </button>
          <button
            onClick={() => activeWeekend && requestWeekendDelete(activeWeekend)}
            className="tap-target-block gap-3 rounded-xl px-3 text-left text-red-400 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">delete</span>
            Delete weekend
          </button>
        </div>
      </BottomSheet>

      {/* [25] QUICK SERVICE LOG SHEET */}
      <BottomSheet
        open={svcOpen}
        onClose={() => setSvcOpen(false)}
        title={selectedServiceComponent ? `Log maintenance — ${selectedServiceComponent.name}` : 'Log maintenance'}
      >
        {selectedServiceComponent && selectedServiceStatus && (
          <div className="space-y-3 pb-2">
            {visibleMaintenance.length > 1 && (
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Component</span>
                <select
                  value={selectedServiceComponent.id}
                  onChange={e => setSvcComponentId(e.target.value)}
                  className="mt-1 w-full min-h-12 bg-surface border border-outline-variant focus:border-primary rounded-lg px-3 text-sm text-on-surface outline-none"
                >
                  {visibleMaintenance.map(component => (
                    <option key={component.id} value={component.id}>{component.name}</option>
                  ))}
                </select>
              </label>
            )}
            <span className="status-chip">
              <span
                className={`material-symbols-outlined ${selectedServiceStatus.state === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}
                aria-hidden="true"
              >warning</span>
              <span>{describeServiceStatus(selectedServiceComponent, selectedServiceStatus)}</span>
            </span>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">What was done</span>
              <textarea
                value={svcNotes}
                onChange={e => setSvcNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Fresh oil + filter"
                className="mt-1 w-full bg-surface border border-outline-variant focus:border-primary rounded-lg px-3 py-3 text-sm text-on-surface outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Cost (optional)</span>
                <input
                  inputMode="decimal"
                  value={svcCost}
                  onChange={e => setSvcCost(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full min-h-12 bg-surface border border-outline-variant focus:border-primary rounded-lg px-3 text-sm text-on-surface outline-none font-mono"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Date</span>
                <input
                  type="date"
                  value={svcDate}
                  onChange={e => setSvcDate(e.target.value)}
                  className="mt-1 w-full min-h-12 bg-surface border border-outline-variant focus:border-primary rounded-lg px-3 text-sm text-on-surface outline-none font-mono"
                />
              </label>
            </div>
            <button
              onClick={saveQuickService}
              className="w-full min-h-14 bg-primary text-on-primary rounded-xl font-display font-bold uppercase tracking-wide active:opacity-90"
            >
              Save maintenance log
            </button>
            <button
              onClick={() => { setSvcOpen(false); onGoToService?.(); }}
              className="w-full min-h-12 text-primary font-mono text-xs font-bold uppercase tracking-wider"
            >
              Full maintenance log →
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Undo toasts */}
      <UndoToast pending={weekendUndo.pending} onUndo={weekendUndo.undo} onDismiss={weekendUndo.dismiss} />
      <InfoToast
        open={!!svcToast}
        title={svcToast?.result.accountingEntry ? 'Logged + added to accounting' : 'Maintenance logged'}
        icon="build_circle"
        action={svcToast ? {
          label: 'UNDO',
          onClick: () => { onUndoQuickService(svcToast); setSvcToast(null); },
        } : undefined}
        onClose={() => setSvcToast(null)}
      />

    </div>
  );
}
