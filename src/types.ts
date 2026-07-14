export interface CornerSetup {
  spring: string;
  shock: string;
  loadWeight?: string; // or load
  loadWeightUnit?: string; // lb
  loadCtoC?: string;
  loadCtoCUnit?: string; // in
  caster?: string;
  casterUnit?: string; // deg
  camber?: string;
  camberUnit?: string; // deg
  tireComp: string;
  tireSize: string;
  toe?: string;
  stagger?: string;
  staggerUnit?: string; // in
  wheelSpacer?: string;
  wheelSpacerUnit?: string; // in
  tirePress: string;
  tirePressUnit?: string; // psi
  /** Where this corner's current pressure block was copied from. */
  pressureSourceNote?: string;
  tireInventoryId?: string; // reference to TireInventoryItem.id
  backspacing?: string; // wheel backspacing in inches

  // Rear specific
  springHeight?: string;
  springHeightUnit?: string;
  /** @deprecated Legacy rear scale-weight key. Read for compatibility; write `loadWeight`. */
  load?: string;
  loadUnit?: string;
  topBarLength?: string; // Top bar length
  bottomBarLength?: string; // Bottom bar length
  topBarHFrame?: string;
  topBarHBird?: string;
  topBarAngRH?: string;
  topBarAngRHUnit?: string;
  topBarAngFD?: string;
  topBarAngFDUnit?: string;
  botBarHFrame?: string;
  botBarHBird?: string;
  /** Bottom-bar angle measured with car at ride height. */
  bottomBarAngRH?: string;
  bottomBarAngRHUnit?: string;
  /** Bottom-bar angle measured with suspension at full droop. */
  bottomBarAngFD?: string;
  bottomBarAngFDUnit?: string;
  /** @deprecated Legacy single bottom-bar angle. Read as ride-height fallback. */
  bottomBarAngle?: string;
  bottomBarAngleUnit?: string;
  droop?: string;
  droopUnit?: string;
  preload?: string;
  preloadUnit?: string;
  boundGraphId?: string;
}

/** Allowed car types — drives the Garage dropdown. Keep extensible. */
export const CAR_TYPES = ['Dirt Late Model', 'A Mod', 'B Mod'] as const;
export type CarType = typeof CAR_TYPES[number] | string; // string fallback for forward-compat

export interface Car {
  id: string;               // client-generated, e.g. `car-${Date.now()}-${rand}`
  teamId?: string | null;   // set when user is on a team; else null
  userId: string;           // creator / owner (always set)
  carType: CarType;
  chassis: string;          // free text — chassis name/number
  division: string;         // free text — division being raced
  /** Optional friendly label; if empty, UI derives "{chassis} · {carType}" */
  name?: string;
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
}

// ─── Smasher / Shock-Load Graph ───────────────────────────────────────────────

export type ShockCorner = 'LF' | 'RF' | 'LR' | 'RR';

export interface ShockDataPoint {
  height: string; // shock height in inches
  load: string;   // load in lbs
}

export interface ShockSession {
  id: string;
  label: string;
  corner: ShockCorner;
  springRate: string;
  shock: string;
  /** Optional car ride height recorded when this load session was started. */
  rideHeightCtoC?: string;
  date: string;
  points: ShockDataPoint[];
  /** Base64 dyno graph photos */
  photos?: string[];
  /** Car this session belongs to */
  carId?: string;
}

export interface Setup {
  id: string;
  chassis: string;
  track: string;
  date: string;
  carType: string;
  /** Car profile this setup belongs to */
  carId?: string;
  lf: CornerSetup;
  rf: CornerSetup;
  lr: CornerSetup;
  rr: CornerSetup;
  gear?: string;
  toe?: string;
  jbar?: string;
  jbarFrameHeight?: string;
  jbarPinionHeight?: string;
  frontStagger?: string;
  rearStagger?: string;
  pullBarFrameHole?: string;
  pullBarRearHole?: string;
  pullBarAngle?: string;
  notes?: string;
  /** Supabase Storage public URLs for attached photos/files */
  screenshots?: string[];
}

export interface TireInventoryItem {
  id: string;
  tireNumber: string;
  size: string;
  compound: string;
  wheelBackspacing: '2' | '3' | '4';
  durometer: string;
  airPressure?: string;
  createdAt?: string;
  /** Car profile this tire belongs to */
  carId?: string;
  /** ISO date when the tire was added to inventory */
  dateAdded?: string;
  /** User-entered age (days) at the time the tire was added — for used-tire import */
  initialAgeDays?: number;
  /** ISO dates when this tire was mounted in a session (deduped) */
  usageDates?: string[];
  /** Auto-derived: length of usageDates; persisted for fast display */
  heatCycles?: number;
}

// ─── Session type / lap estimates ─────────────────────────────────────────────

export const SESSION_TYPES = ['Test', 'Hot Laps', 'Qualifying', 'Heat Race', 'Feature'] as const;
export type SessionType = typeof SESSION_TYPES[number];

/** Estimated laps run per session type — used for tire-life / usage reporting. */
export const SESSION_TYPE_LAPS: Record<SessionType, number> = {
  'Test': 5,
  'Hot Laps': 5,
  'Qualifying': 3,
  'Heat Race': 10,
  'Feature': 30,
};

// ─── Track condition presets (WS-L) ───────────────────────────────────────────

export const TRACK_CONDITION_PRESETS = ['Wet/Green', 'Tacky/Heavy', 'Cleaned Off', 'Rubbered Up', 'Dry Slick'] as const;
export type TrackConditionPreset = typeof TRACK_CONDITION_PRESETS[number];

export interface TireDetails {
  compound: string;
  size: string;
  airPressure: string;
  tireId?: string;
  durometer?: string;
  backSpacing?: string;
}

export interface SessionRecord {
  id: string;
  type: 'H1' | 'Q1' | 'P2' | 'A-MAIN' | string;
  /** Structured session type — used for tire usage / lap estimate reporting.
   *  Sessions logged before this field existed won't have it set; consumers
   *  should fall back to inferring from `name`/`type`. */
  sessionType?: SessionType;
  name: string;
  track: string;
  condition: string;
  /** Track-condition preset from the dropdown (WS-L) */
  trackConditionPreset?: TrackConditionPreset;
  /** Free-text condition notes supplementing the preset (WS-L) */
  conditionNotes?: string;
  bestLap: string;
  isBest?: boolean;
  avgLap?: string;
  finishPos?: string;
  gap?: string;
  maxRpm?: string;
  leaderLap?: string;
  leaderGap?: string;
  diagnostics?: {
    cornerEntry: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerEntryNotes?: string;
    centerApex: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    centerApexNotes?: string;
    cornerExit: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerExitNotes?: string;
  };
  adjustments?: SetupAdjustment[];
  tires?: {
    lf: TireDetails;
    rf: TireDetails;
    lr: TireDetails;
    rr: TireDetails;
  };
  pressures?: {
    lf: string;
    rf: string;
    lr: string;
    rr: string;
  };
  /** Where this session pressure block was copied from. */
  pressureSourceNote?: string;
  competitionNotes?: string;
  weather?: string;
  time?: string;
  setupUsed?: string;
  screenshots?: string[];
  /** Shock dyno graph images (base64) */
  dynoPhotos?: string[];
}

/** Weather snapshot fetched via GPS or zip code */
export interface WeatherSnapshot {
  temp: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  location: string;
  fetchedAt: string;
}

/** A single day's weather data — used for history & forecast strips */
export interface WeatherHistoryDay {
  date: string;          // ISO yyyy-mm-dd
  tempMaxF?: number;
  tempMinF?: number;
  precipIn?: number;     // total precipitation inches
  windMph?: number;
  code?: number;         // WMO weather code
  summary?: string;      // human-readable description
}

export interface RaceWeekend {
  id: string;
  name: string;
  track: string;
  date: string;
  sessions: SessionRecord[];
  /** Free-text notes for the entire weekend */
  notes?: string;
  /** Weather fetched from GPS or zip */
  weather?: WeatherSnapshot;
  /** Human-readable location string */
  location?: string;
  /** Setup bound to this weekend */
  setupId?: string;
  setupName?: string;
  /** Weather history for the 7 days leading up to race day */
  weatherHistory?: WeatherHistoryDay[];
  /** Weather forecast for race day + a few days out */
  weatherForecast?: WeatherHistoryDay[];
}

export interface SetupAdjustment {
  id: string;
  icon: string;
  label: string;
  value: string;
}

export interface ActiveSession {
  id?: string;
  weekendId?: string;
  /** Structured session type — used for tire usage / lap estimate reporting. */
  sessionType?: SessionType;
  name: string;
  track: string;
  setupUsed: string;
  condition: string;
  /** Track-condition preset from the dropdown (WS-L) */
  trackConditionPreset?: TrackConditionPreset;
  /** Free-text condition notes supplementing the preset (WS-L) */
  conditionNotes?: string;
  weather: string;
  time: string;
  bestLap: string;
  avgLap: string;
  finishPos: string;
  gap: string;
  maxRpm: string;
  leaderLap: string;
  leaderGap: string;
  diagnostics: {
    cornerEntry: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerEntryNotes?: string;
    centerApex: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    centerApexNotes?: string;
    cornerExit: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerExitNotes?: string;
  };
  adjustments: SetupAdjustment[];
  tires?: {
    lf: TireDetails;
    rf: TireDetails;
    lr: TireDetails;
    rr: TireDetails;
  };
  pressures: {
    lf: string;
    rf: string;
    lr: string;
    rr: string;
  };
  /** Where this active-session pressure block was copied from. */
  pressureSourceNote?: string;
  competitionNotes: string;
  screenshots?: string[];
  /** Shock dyno graph images (base64) */
  dynoPhotos?: string[];
}

export interface TodoItem {
  id: string;
  text: string;
  /** Notes/description set when the item is created */
  desc?: string;
  /** Note recorded when the item is checked off */
  completionNote?: string;
  /** ISO timestamp when item was completed */
  completedAt?: string;
  done: boolean;
  /** user_id of the team member assigned to this task */
  assignedTo?: string;
  /** Display name of assigned member (cached for offline display) */
  assignedToName?: string;
  /** Optional link to a race weekend */
  weekendId?: string;
  weekendName?: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  items: TodoItem[];
  is_template?: boolean;
  updated_at: string;
  /** Optional link to a race weekend (list-level association) */
  weekendId?: string;
  weekendName?: string;
}

export interface TeamProfile {
  racePassUrl?: string;
  transponderIds?: string;
  hometown?: string;
  age?: string;
  carNumber?: string;
  division?: string;
}

export interface Team {
  id: string;
  name: string;
  banner_url?: string;
  created_at: string;
  profile?: TeamProfile;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'owner' | 'member';
}

/** Single line item in the accounting ledger */
export interface AccountingEntry {
  id: string;
  name: string;
  description?: string;
  /** Positive value; type field determines income vs expense */
  amount: number;
  type: 'income' | 'expense';
  /** Who paid / where money came from */
  payer?: string;
  /** Who received / where money went */
  payee?: string;
  date: string;
  /** Optional link to a race weekend */
  weekendId?: string;
  weekendName?: string;
  /** Base64 receipt photo */
  receiptPhoto?: string;
}

/** Single item on a shopping list */
export interface ShoppingItem {
  id: string;
  name: string;
  description?: string;
  cost?: number;
  purchased: boolean;
  purchasedAt?: string;
  /** Optional link to a race weekend */
  weekendId?: string;
  weekendName?: string;
}

/** App-wide visual theme stored in localStorage key: race_notes_theme */
export interface AppTheme {
  mode: 'dark' | 'light';
  /** Hex color string e.g. "#ffb3ac" */
  accent: string;
  /** UI scale — applied as a CSS zoom factor so it renders identically on
   *  the installed PWA (Chrome) and the Capacitor APK (Android WebView),
   *  both Chromium-based. 'standard' | 'large' | 'xlarge' | 'xxlarge'. */
  fontSize: 'standard' | 'large' | 'xlarge' | 'xxlarge';
}

// ===========================================================================
// v2 feature batch (plan-v2.md) — WS-N Data Model Foundation
// ===========================================================================

// ---- Maintenance / ERP (WS-N/O/P) -----------------------------------------

export const MAINTENANCE_CATEGORIES = [
  'Oil', 'Motor', 'Transmission', 'Bearings', 'Shocks', 'Rear End', 'Trailer', 'Other',
] as const;
export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number] | string;

/** How a component's service interval is measured */
export type MaintenanceIntervalType = 'laps' | 'sessions' | 'races' | 'days';

/** Usage fraction at which a component is flagged "due" (before overdue) */
export const MAINTENANCE_DUE_THRESHOLD = 0.8;

/**
 * A tracked part / service item (oil, motor, bearings, trailer, ...).
 * scope 'car'  → filtered by byActiveCar (carId required)
 * scope 'rig'  → truck/trailer/global — never car-filtered
 * localStorage: race_notes_maintenance · Supabase: maintenance_components
 */
export interface MaintenanceComponent {
  id: string;
  scope: 'car' | 'rig';
  carId?: string;
  name: string;                       // e.g. "Engine oil", "LR bearing"
  category: MaintenanceCategory;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;              // e.g. 250 (laps), 3 (races), 60 (days)
  /** ISO — usage is derived from sessions/weekends AFTER this timestamp */
  lastServicedAt: string;
  /** Manual counter for items that can't be derived from session data */
  manualUnits?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Service history entry — logging one resets the component's counter.
 *  localStorage: race_notes_maintenance_logs · Supabase: maintenance_logs */
export interface MaintenanceLog {
  id: string;
  componentId: string;
  date: string;                       // ISO
  type: 'service' | 'replace' | 'inspect';
  notes?: string;
  cost?: number;
  /** Link into the accounting ledger when the service created an expense */
  accountingEntryId?: string;
  /** Usage snapshot at time of service (for history display) */
  usedAtService?: number;
  doneBy?: string;
  doneByName?: string;
}

/** Derived status for display (computed in src/lib/maintenance.ts) */
export interface MaintenanceStatus {
  used: number;
  limit: number;
  pct: number;                        // 0..n (can exceed 1)
  state: 'ok' | 'due' | 'overdue';
}

// ---- Pre-race checklists (WS-N/Q/R) ---------------------------------------

export const CHECKLIST_CATEGORIES = [
  'Supplies', 'Trailer Loading', 'Truck Loading', 'Car Prep', 'Custom',
] as const;
export type ChecklistCategory = typeof CHECKLIST_CATEGORIES[number] | string;

export interface ChecklistTemplateItem {
  id: string;
  text: string;
}

/** Reusable checklist template.
 *  localStorage: race_notes_checklist_templates · Supabase: checklist_templates */
export interface ChecklistTemplate {
  id: string;
  name: string;
  category: ChecklistCategory;
  items: ChecklistTemplateItem[];
  updatedAt: string;
}

export interface ChecklistItemState {
  id: string;
  text: string;
  done: boolean;
  doneBy?: string;                    // user_id
  doneByName?: string;                // cached display name (offline)
  doneAt?: string;                    // ISO
}

/** Per-weekend checklist instance (snapshot copy of a template, or ad-hoc).
 *  localStorage: race_notes_weekend_checklists · Supabase: weekend_checklists */
export interface WeekendChecklist {
  id: string;
  weekendId?: string;                 // nulled if the weekend is deleted
  weekendName?: string;
  templateId?: string;
  name: string;
  category: ChecklistCategory;
  items: ChecklistItemState[];
  updatedAt: string;
}

// ---- Location sharing & push (WS-N/S/T/U) ----------------------------------

/** Supabase: push_tokens (owner-only RLS; Edge Function reads via service role) */
export interface PushTokenRecord {
  userId: string;
  token: string;
  platform: 'android' | 'web';
  deviceId: string;
  updatedAt: string;
}

export type AppNotificationType = 'ping' | 'come_here' | 'system';

/** Supabase: notifications (team-scoped RLS; delivered via FCM + Realtime) */
export interface AppNotification {
  id: string;
  toUser: string;
  fromUser?: string;
  fromUserName?: string;
  teamId?: string;
  type: AppNotificationType;
  title: string;
  body: string;
  /** e.g. { lat, lng, label } for come_here targets */
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

/** Live, ephemeral team member location (NOT part of local-first sync —
 *  written directly + subscribed via Supabase Realtime; TTL via expires_at).
 *  Supabase: team_locations */
export interface TeamLocation {
  userId: string;
  userName?: string;
  teamId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedMph?: number;
  /** Optional status label, e.g. "On the way to the track" */
  label?: string;
  updatedAt: string;
  expiresAt: string;
}

// ---- Truck directions (WS-N/V/W/X) -----------------------------------------

/** Rig profile used for HERE truck routing restrictions.
 *  localStorage: race_notes_truck_profile (+ mirrored into Team.profile) */
export interface TruckProfile {
  grossWeightLb?: number;
  heightIn?: number;
  lengthIn?: number;
  widthIn?: number;
  axleCount?: number;
  trailerCount?: number;
  /** Saved home base / shop origin */
  homeBase?: { lat: number; lng: number; label: string };
}

/** Default rig profile (decision #5, 2026-07-06) — editable per team.
 *  20,000 lb gross · 10 ft height · 48 ft length · 7 ft width. */
export const DEFAULT_TRUCK_PROFILE: TruckProfile = {
  grossWeightLb: 20000,
  heightIn: 120,
  lengthIn: 576,
  widthIn: 84,
  axleCount: 2,
  trailerCount: 1,
};

export interface TripStop {
  id: string;
  kind: 'truck_stop' | 'rest_area' | 'custom';
  name: string;
  lat: number;
  lng: number;
  /** Meters from route start, for along-route ordering */
  distAlongRouteM?: number;
  selected?: boolean;                 // include in navigation handoff
}

/** A planned truck route (HERE), cached locally to preserve API quota.
 *  localStorage: race_notes_trips · Supabase: saved_trips */
export interface SavedTrip {
  id: string;
  weekendId?: string;
  weekendName?: string;
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  /** Decoded route geometry [lat, lng][] (from HERE flexible polyline) */
  polyline?: [number, number][];
  distanceM?: number;
  durationS?: number;
  /** Raw HERE notices (grade warnings, restrictions) for display */
  notices?: string[];
  stops: TripStop[];
  createdAt: string;
  updatedAt: string;
}
