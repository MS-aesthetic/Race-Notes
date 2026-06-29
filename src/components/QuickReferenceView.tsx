import React, { useState, useMemo } from 'react';

interface Adjustment {
  component: string;
  location: string;
  action: string;
  effect: string;
}

interface ConditionGroup {
  id: string;
  title: string;
  subtitle: string;
  type: 'tighten' | 'loosen';
  adjustments: Adjustment[];
}

const MATRIX_DATA: ConditionGroup[] = [
  {
    id: 'tighten-entry',
    title: 'Tighten on Entry',
    subtitle: 'Fixes Loose-In Condition',
    type: 'tighten',
    adjustments: [
      { component: 'J-Bar', location: 'Chassis Mount', action: 'Raise', effect: 'Raises rear roll center & steepens rake; forces an instant, heavy chassis set to plant the rear end.' },
      { component: '4-Link', location: 'Right Rear Bottom Bar', action: 'Lower Chassis / Raise Birdcage', effect: 'Flattens trailing arm angle, reducing entry roll steer to stabilize the axle.' },
      { component: '4-Link Rods', location: 'Left Rear Bottom Rod', action: 'Lengthen', effect: 'Increases left wheelbase, removing aggressive static rear steer out of turn-in.' },
      { component: '4-Link Rods', location: 'Right Rear Bottom Rod', action: 'Lengthen', effect: 'Increases right wheelbase, forcing the rear axle to track squarer and more stable.' },
      { component: 'Springs', location: 'Left Front Corner', action: 'Softer Rate', effect: 'Allows front nose to drop easier, rolling weight over to the right front quickly.' },
      { component: 'Shocks', location: 'Left Front Corner', action: 'Less Compression', effect: 'Allows immediate nose drop on turn-in to pin steering tires to the track.' },
      { component: 'Shocks', location: 'Right Front Corner', action: 'Less Compression', effect: 'Speeds up chassis roll onto the RF tire footprint to engage entry steering immediately.' },
      { component: 'Shocks', location: 'Left Rear Corner', action: 'More Compression', effect: 'Resists sudden LR unloading under heavy corner entry braking to preserve cross-weight.' }
    ]
  },
  {
    id: 'tighten-center',
    title: 'Tighten in Center',
    subtitle: 'Fixes Loose-Middle Condition',
    type: 'tighten',
    adjustments: [
      { component: 'Springs', location: 'Right Rear Corner', action: 'Softer Rate', effect: 'Allows chassis to squat heavily into the RR, crushing the tire tread into dirt for side bite.' },
      { component: 'Shocks', location: 'Right Rear Corner', action: 'Less Compression', effect: 'Allows the chassis to roll over onto the RR instantly to catch side bite without delay.' },
      { component: 'Springs', location: 'Right Front Corner', action: 'Stiffer Rate', effect: 'Resists excessive body roll, keeping the front stable to induce a mild steering push.' }
    ]
  },
  {
    id: 'tighten-exit',
    title: 'Tighten on Exit',
    subtitle: 'Fixes Loose-Out / Adds Forward Bite',
    type: 'tighten',
    adjustments: [
      { component: '4-Link', location: 'Left Rear Bottom Bar', action: 'Lower Chassis / Raise Birdcage', effect: 'Flattens the bar angle, holding the LR spring load longer during chassis hike-up.' },
      { component: '4-Link', location: 'Left Rear Top Bar', action: 'Raise Chassis / Lower Birdcage', effect: 'Steepens the "Drive Bar" angle to maximize dynamic mechanical clamp on the LR tire foot.' },
      { component: '4-Link', location: 'Right Rear Top Bar', action: 'Lower Chassis / Raise Birdcage', effect: 'Flattens the bar angle, reducing frame jacking to keep the RR tire footprint planted.' },
      { component: 'J-Bar', location: 'Pinion Mount', action: 'Lower', effect: 'Steepens rake angle under power, converting cornering side forces into vertical forward bite.' },
      { component: '4-Link Rods', location: 'Left Rear Bottom Rod', action: 'Lengthen', effect: 'Limits dynamic rear steer on throttle, keeping the rear end square down the straightaway.' },
      { component: 'Pull Bar', location: 'Spring / Bushing', action: 'Softer Spring / Pliable Bushing', effect: 'Cushions initial throttle hit, progressively applying engine torque without tire spin.' },
      { component: 'Pull Bar', location: 'Physical Dimensions', action: 'Lengthen Unit', effect: 'Provides a wider leverage arc to smooth out the torque transition on slick tracks.' },
      { component: 'Shocks', location: 'Left Front Corner', action: 'Less Rebound', effect: 'Allows the LF nose to lift rapidly on throttle, quickly transferring weight to the rear drive.' },
      { component: 'Springs', location: 'Left Rear Corner', action: 'Stiffer Rate', effect: 'Restricts excessive chassis hike and limits rear steer to keep the drive linear and straight.' },
      { component: 'Shocks', location: 'Left Rear Corner', action: 'More Rebound', effect: 'Slows down the LR chassis hike-up speed to delay rear steer onset on slick tracks.' },
      { component: 'Shocks', location: 'Right Rear Corner', action: 'More Rebound', effect: 'Resists RR shock extension as the car flattens out, keeping side bite pinned longer.' },
      { component: 'Tires', location: 'Left Rear Corner', action: 'Lower Pressure (6-9 PSI)', effect: 'Maximizes the tire footprint width and length for optimal forward traction.' },
      { component: 'Tires', location: 'Right Rear Corner', action: 'Lower Pressure (11-12 PSI)', effect: 'Softens the carcass to enlarge the side bite contact patch on dry-slick surfaces.' }
    ]
  },
  {
    id: 'loosen-entry',
    title: 'Loosen on Entry',
    subtitle: 'Fixes Tight-In / Push Condition',
    type: 'loosen',
    adjustments: [
      { component: 'J-Bar', location: 'Chassis Mount', action: 'Lower', effect: 'Lowers rear roll center & flattens bar rake; allows smoother roll to cure an entry push.' },
      { component: '4-Link', location: 'Right Rear Bottom Bar', action: 'Raise Chassis / Lower Birdcage', effect: 'Steepens trailing bar angle, forcing the RR tire forward under roll to induce entry steer.' },
      { component: '4-Link Rods', location: 'Left Rear Bottom Rod', action: 'Shorten', effect: 'Pulls the LR wheel forward dynamically, introducing static turn-in steer to the right.' },
      { component: '4-Link Rods', location: 'Right Rear Bottom Rod', action: 'Shorten', effect: 'Pulls the RR wheel forward, steering the axle left statically to encourage entry rotation.' },
      { component: 'Springs', location: 'Left Front Corner', action: 'Stiffer Rate', effect: 'Props the left-front nose up and resists body roll, intentionally loosening entry.' },
      { component: 'Shocks', location: 'Left Front Corner', action: 'More Compression', effect: 'Resists the nose diving when lifting off throttle, slowing weight transfer speed.' },
      { component: 'Shocks', location: 'Right Front Corner', action: 'More Compression', effect: 'Slows down the velocity at which the car rolls onto the RF, freeing up turn-in entry.' },
      { component: 'Shocks', location: 'Left Rear Corner', action: 'Less Compression', effect: 'Allows the LR corner to compress easily under braking, helping slide initiation.' }
    ]
  },
  {
    id: 'loosen-center',
    title: 'Loosen in Center',
    subtitle: 'Fixes Tight-Middle Push',
    type: 'loosen',
    adjustments: [
      { component: 'Springs', location: 'Right Front Corner', action: 'Softer Rate', effect: 'Allows deep, compliant roll onto the RF tire footprint, maximizing front steering mid-turn.' },
      { component: 'Springs', location: 'Right Rear Corner', action: 'Stiffer Rate', effect: 'Resists excessive roll and keeps the rear flat, preventing the car from getting "stuck" on side bite.' },
      { component: 'Shocks', location: 'Right Rear Corner', action: 'More Compression', effect: 'Slows down how fast side bite builds up, helping the car rotate through the middle apex.' },
      { component: 'Shocks', location: 'Left Front Corner', action: 'More Rebound (Tie-Down)', effect: 'Holds the LF nose down on throttle, keeping cross-weight active to assist apex rotation.' }
    ]
  },
  {
    id: 'loosen-exit',
    title: 'Loosen on Exit',
    subtitle: 'Fixes Tight-Out / Push on Throttle',
    type: 'loosen',
    adjustments: [
      { component: '4-Link', location: 'Left Rear Bottom Bar', action: 'Raise Chassis / Lower Birdcage', effect: 'Steepens bar angle, accelerating chassis hike-up and roll steer to swing the rear right.' },
      { component: '4-Link', location: 'Left Rear Top Bar', action: 'Lower Chassis / Raise Birdcage', effect: 'Flattens the bar angle, relieving vertical tire loading to allow free rotation on exit.' },
      { component: '4-Link', location: 'Right Rear Top Bar', action: 'Raise Chassis / Lower Birdcage', effect: 'Steepens bar angle, increasing chassis jacking forces to help unhook a tight rear tire.' },
      { component: 'J-Bar', location: 'Pinion Mount', action: 'Raise', effect: 'Flattens the J-bar angle under power, reducing downforce to let the car rotate off the corner.' },
      { component: 'Pull Bar', location: 'Spring / Bushing', action: 'Stiffer Spring / Harder Bushing', effect: 'Delivers an immediate, aggressive torque spike to break traction if the rear is pushing on throttle.' },
      { component: 'Shocks', location: 'Right Front Corner', action: 'Less Rebound', effect: 'Allows the RF to extend quickly when transitioning to throttle, freeing up exit chassis pivot.' },
      { component: 'Springs', location: 'Left Rear Corner', action: 'Softer Rate', effect: 'Promotes deep chassis hike and suspension separation, generating rapid rear steer on power.' },
      { component: 'Shocks', location: 'Left Rear Corner', action: 'Less Rebound', effect: 'Allows the LR chassis to snap up instantly on power, triggering fast rear steer.' },
      { component: 'Shocks', location: 'Right Rear Corner', action: 'Less Rebound', effect: 'Allows the RR shock to extend easily, releasing side bite quickly so the car can square up.' },
      { component: 'Tires', location: 'Right Rear Corner', action: 'Higher Pressure (14-16 PSI)', effect: 'Stiffens the tire carcass, preventing the rear from dead-hooking and easing rotation.' }
    ]
  }
];

export default function QuickReferenceView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tighten' | 'loosen'>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');

  // ── Gear Ratio Calculator state ───────────────────────────────────────
  const [calcOpen, setCalcOpen]       = useState(true);
  const [topGear, setTopGear]         = useState('');
  const [bottomGear, setBottomGear]   = useState('');
  const [driveRatio, setDriveRatio]   = useState('4.86');
  const [customDrive, setCustomDrive] = useState('');

  const gearResult = useMemo(() => {
    const top   = parseFloat(topGear);
    const bot   = parseFloat(bottomGear);
    const drive = driveRatio === 'custom' ? parseFloat(customDrive) : parseFloat(driveRatio);
    if (!isNaN(top) && !isNaN(bot) && bot > 0 && !isNaN(drive) && drive > 0) {
      return (top / bot) * drive;
    }
    return null;
  }, [topGear, bottomGear, driveRatio, customDrive]);

  // Gather unique component names for the filter dropdown
  const uniqueComponents = useMemo(() => {
    const list = new Set<string>();
    MATRIX_DATA.forEach(group => {
      group.adjustments.forEach(adj => list.add(adj.component));
    });
    return Array.from(list).sort();
  }, []);

  // Filter logic
  const filteredData = useMemo(() => {
    return MATRIX_DATA.map(group => {
      // 1. Filter group by overall type if selected
      if (filterType !== 'all' && group.type !== filterType) {
        return null;
      }
      
      // 2. Filter group by specific condition ID if selected
      if (selectedCondition !== 'all' && group.id !== selectedCondition) {
        return null;
      }

      // 3. Filter nested adjustments by component and search term
      const matchedAdjustments = group.adjustments.filter(adj => {
        const matchesComponent = selectedComponent === 'all' || adj.component === selectedComponent;
        
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch = term === '' || 
          adj.component.toLowerCase().includes(term) ||
          adj.location.toLowerCase().includes(term) ||
          adj.action.toLowerCase().includes(term) ||
          adj.effect.toLowerCase().includes(term);

        return matchesComponent && matchesSearch;
      });

      if (matchedAdjustments.length === 0) {
        return null; // hide group if no adjustments inside matched
      }

      return {
        ...group,
        adjustments: matchedAdjustments
      };
    }).filter((g): g is ConditionGroup => g !== null);
  }, [searchTerm, filterType, selectedCondition, selectedComponent]);

  const stats = useMemo(() => {
    let totalAdjs = 0;
    filteredData.forEach(g => {
      totalAdjs += g.adjustments.length;
    });
    return {
      groupsCount: filteredData.length,
      adjustmentsCount: totalAdjs
    };
  }, [filteredData]);

  return (
    <div className="space-y-5 text-on-surface pb-8" id="quick-reference-page">

      {/* ── GEAR RATIO CALCULATOR ──────────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <button
          onClick={() => setCalcOpen(v => !v)}
          className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">calculate</span>
            <div className="text-left">
              <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">
                Gear Ratio Calculator
              </h3>
              <p className="text-[10px] font-mono text-on-surface-variant">
                (Top Gear ÷ Bottom Gear) × Drive Ratio
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">
            {calcOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {calcOpen && (
          <div className="p-4 border-t border-outline-variant/60 bg-[#0a0a0a] space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {/* Top Gear */}
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">
                  Top Gear
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={topGear}
                  onChange={e => setTopGear(e.target.value)}
                  placeholder="e.g. 22"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded"
                />
              </div>
              {/* Bottom Gear */}
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">
                  Bottom Gear
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={bottomGear}
                  onChange={e => setBottomGear(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded"
                />
              </div>
              {/* Drive Ratio */}
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">
                  Drive Ratio
                </label>
                <select
                  value={driveRatio}
                  onChange={e => setDriveRatio(e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded"
                >
                  <option value="4.86">4.86 (Default)</option>
                  <option value="4.11">4.11</option>
                  <option value="custom">Custom…</option>
                </select>
                {driveRatio === 'custom' && (
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customDrive}
                    onChange={e => setCustomDrive(e.target.value)}
                    placeholder="e.g. 5.14"
                    className="w-full mt-1.5 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded"
                  />
                )}
              </div>
            </div>

            {/* Result */}
            {gearResult !== null ? (
              <div className="bg-surface-container border border-primary/30 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-on-surface-variant font-bold">
                    Calculated Gear Ratio
                  </p>
                  <p className="text-[11px] font-mono text-on-surface-variant/70 mt-0.5">
                    ({topGear} ÷ {bottomGear}) × {driveRatio === 'custom' ? (customDrive || '?') : driveRatio}
                  </p>
                </div>
                <span className="font-mono text-4xl font-black text-primary tracking-tight">
                  {gearResult.toFixed(3)}
                </span>
              </div>
            ) : (
              <div className="bg-surface-container border border-outline-variant/40 rounded-lg p-4 text-center">
                <p className="font-mono text-xs text-on-surface-variant/50">
                  Enter Top Gear and Bottom Gear values to calculate
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Header Banner */}
      <header className="relative bg-surface-container border border-outline-variant rounded-lg p-5 overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="material-symbols-outlined text-primary text-xl font-bold">menu_book</span>
          <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-widest">
            Dirt Chassis Handbook
          </span>
        </div>
        <h2 className="font-display font-black text-xl text-on-surface uppercase tracking-tight">
          Pit-Side Troubleshooting Matrix
        </h2>
        <p className="text-xs text-on-surface-variant max-w-lg mt-1 font-sans leading-relaxed">
          Quick-reference adjustment guide grouped by track conditions and handling issues. Find the exact mechanical action to dial in entry, middle apex, or exit bite.
        </p>
      </header>

      {/* Inputs / Filters Controls */}
      <section className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3.5" id="reference-filters">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant">
            Interactive Search
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">search</span>
            <input
              type="text"
              placeholder="Search components, actions, corners, or handling symptoms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-outline-variant focus:border-primary text-xs rounded p-2.5 pl-9 outline-none text-on-surface font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-on-surface-variant hover:text-primary transition-colors text-xs font-mono font-bold"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Dropdown filters layout */}
        <div className="grid grid-cols-3 gap-2">
          {/* Action Class Filter */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold">
              Class
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setSelectedCondition('all'); // reset specific condition when high level changes
              }}
              className="w-full bg-[#161616] border border-outline-variant hover:border-outline text-[11px] text-on-surface p-2 rounded outline-none font-mono tracking-tight"
            >
              <option value="all">ALL ACTIONS</option>
              <option value="tighten">TIGHTEN</option>
              <option value="loosen">LOOSEN</option>
            </select>
          </div>

          {/* Handler Phase Filter */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold">
              Chassis Phase
            </label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full bg-[#161616] border border-outline-variant hover:border-outline text-[11px] text-on-surface p-2 rounded outline-none font-mono tracking-tight"
            >
              <option value="all">ALL PHASES</option>
              {filterType !== 'loosen' && <option value="tighten-entry">Entry (Loose-In)</option>}
              {filterType !== 'loosen' && <option value="tighten-center">Center (Loose-Middle)</option>}
              {filterType !== 'loosen' && <option value="tighten-exit">Exit (Loose-Out / Bike)</option>}
              {filterType !== 'tighten' && <option value="loosen-entry">Entry (Tight-In / Push)</option>}
              {filterType !== 'tighten' && <option value="loosen-center">Center (Tight-Middle Push)</option>}
              {filterType !== 'tighten' && <option value="loosen-exit">Exit (Tight-Out / Throttle Push)</option>}
            </select>
          </div>

          {/* Component Category Filter */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold">
              Component
            </label>
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="w-full bg-[#161616] border border-outline-variant hover:border-outline text-[11px] text-on-surface p-2 rounded outline-none font-mono tracking-tight"
            >
              <option value="all font-semibold">ALL PARTS</option>
              {uniqueComponents.map(comp => (
                <option key={comp} value={comp}>{comp.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters Active status chips or stats bar */}
        <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-mono pt-1">
          <span>
            Showing <strong className="text-primary">{stats.adjustmentsCount}</strong> adjustments in <strong className="text-on-surface">{stats.groupsCount}</strong> issues
          </span>
          {(searchTerm || filterType !== 'all' || selectedCondition !== 'all' || selectedComponent !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setSelectedCondition('all');
                setSelectedComponent('all');
              }}
              className="text-primary font-bold hover:underline"
            >
              RESET ALL
            </button>
          )}
        </div>
      </section>

      {/* Main Troubleshooting Groups Cards */}
      <article className="space-y-4" id="reference-results-area">
        {filteredData.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-lg p-10 text-center space-y-2">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">search_off</span>
            <p className="font-mono text-xs text-on-surface-variant uppercase font-bold">No Match found</p>
            <p className="text-[11px] text-[#93908f] max-w-sm mx-auto">
              Try adjusting your search keywords (e.g. "J-Bar", "stiffer", "LR Corner") or reset active filter options above.
            </p>
          </div>
        ) : (
          filteredData.map((group) => {
            const isTighten = group.type === 'tighten';

            return (
              <section
                key={group.id}
                className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden"
                id={`results-${group.id}`}
              >
                {/* Header of the troubleshooting group card */}
                <div className={`p-4 border-b border-outline-variant/60 relative ${isTighten ? 'bg-[#ba1a20]/10' : 'bg-primary/10'}`}>
                  <div>
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-on-surface uppercase tracking-wide">
                      {group.title}
                    </h3>
                    <p className={`text-[11px] font-mono uppercase mt-0.5 font-bold ${isTighten ? 'text-[#ff5555]' : 'text-primary'}`}>
                      {group.subtitle}
                    </p>
                  </div>
                </div>

                {/* Grid List of individual adjustments inside this group */}
                <div className="divide-y divide-outline-variant/40 bg-[#161616]/20">
                  {group.adjustments.map((adj, index) => (
                    <div
                      key={index}
                      className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs hover:bg-[#1f1f1f]/30 transition-colors"
                    >
                      {/* Left: Component & Location */}
                      <div className="md:w-1/3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-surface border border-outline-variant text-[10px] uppercase font-extrabold text-on-surface rounded font-mono tracking-wider">
                            {adj.component}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            {adj.location}
                          </span>
                        </div>
                        {/* Required Action block with high visibility */}
                        <div className="mt-2.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-primary">build</span>
                          <span className="text-[11px] text-primary heading-sm font-bold font-mono tracking-wide uppercase">
                            ACTION: {adj.action}
                          </span>
                        </div>
                      </div>

                      {/* Right: Effect Description info */}
                      <div className="md:w-2/3 border-t md:border-t-0 border-outline-variant/30 pt-2.5 md:pt-0 leading-relaxed font-sans text-[#dfdad8]">
                        <span className="text-[10px] text-on-surface-variant font-mono uppercase font-semibold block mb-0.5">
                          Mechanical Effect / Quick Note
                        </span>
                        {adj.effect}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </article>

      {/* Legend & Pit Quick advice block */}
      <footer className="bg-surface-container-low border border-outline-variant/60 rounded-lg p-4 text-[#bfb9b7] space-y-2">
        <h4 className="font-mono text-[10px] text-on-surface uppercase font-bold tracking-widest flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-primary">info</span>
          DIAL-IN FUNDAMENTALS
        </h4>
        <ul className="text-[11px] list-disc pl-4 space-y-1 mt-1 leading-relaxed">
          <li><strong>Loose Conditions (Loose-In, Loose-Out):</strong> The rear tires lack lateral traction (slide out). The goal is to <strong>TIGHTEN</strong> the chassis by transferring weight to tires that need planting.</li>
          <li><strong>Tight Conditions (Push):</strong> The front wheels slip or fail to steer properly, causing the car to plow straight. The goal is to <strong>LOOSEN</strong> the chassis and increase roll or rotation.</li>
          <li><strong>Cross-Weight & Shocks:</strong> Adjusting shock compression and rebound controls how fast weight transfers during braking and gas transitions.</li>
        </ul>
      </footer>
    </div>
  );
}
