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

export interface Setup {
  id: string;
  chassis: string;
  track: string;
  date: string;
  carType: string;
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
}

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
}

export interface RaceWeekend {
  id: string;
  name: string;
  track: string;
  date: string;
  sessions: SessionRecord[];
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
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  items: TodoItem[];
  is_template?: boolean;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  banner_url?: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'owner' | 'member';
}

/** App-wide visual theme stored in localStorage key: race_notes_theme */
export interface AppTheme {
  mode: 'dark' | 'light';
  /** Hex color string e.g. "#ffb3ac" */
  accent: string;
  /** UI font scale — 'standard' (16px base) or 'large' (19px base) */
  fontSize: 'standard' | 'large';
}
