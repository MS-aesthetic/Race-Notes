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
  tireInventoryId?: string; // reference to TireInventoryItem.id
  backspacing?: string; // wheel backspacing in inches

  // Rear specific
  springHeight?: string;
  springHeightUnit?: string;
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
   *  both Chromium-based. 'standard' | 'large' | 'xlarge'. */
  fontSize: 'standard' | 'large' | 'xlarge';
}
