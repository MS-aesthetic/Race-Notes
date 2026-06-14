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

  // Rear specific
  springHeight?: string;
  springHeightUnit?: string;
  load?: string;
  loadUnit?: string;
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
  rearGear?: string;
  pullBarHole?: string;
  pullBarAngle?: string;
  pullBarAngleUnit?: string;
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
  frontStagger?: string;
  rearStagger?: string;
  pullBarFrameHole?: string;
  pullBarRearHole?: string;
  pullBarAngle?: string;
}

export interface TireDetails {
  tireId: string;
  compound: string;
  size: string;
  durometer: string;
  airPressure: string;
  backSpacing: string;
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
