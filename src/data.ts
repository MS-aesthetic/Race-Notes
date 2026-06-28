import { Setup, SessionRecord, ActiveSession, RaceWeekend } from './types';

export const INITIAL_SETUP: Setup = {
  id: '',
  chassis: '',
  track: '',
  date: '',
  carType: '',
  gear: '',
  frontStagger: '',
  rearStagger: '',
  pullBarFrameHole: '',
  pullBarRearHole: '',
  pullBarAngle: '',
  lf: {
    spring: '',
    shock: '',
    loadWeight: '',
    loadCtoC: '',
    caster: '',
    camber: '',
    tireComp: '',
    tireSize: '',
    toe: '',
    stagger: '',
    wheelSpacer: '',
    tirePress: '',
  },
  rf: {
    spring: '',
    shock: '',
    loadWeight: '',
    loadCtoC: '',
    caster: '',
    camber: '',
    tireComp: '',
    tireSize: '',
    toe: '',
    stagger: '',
    wheelSpacer: '',
    tirePress: '',
  },
  lr: {
    spring: '',
    springHeight: '',
    shock: '',
    load: '',
    loadCtoC: '',
    topBarHFrame: '',
    topBarHBird: '',
    topBarAngRH: '',
    topBarAngFD: '',
    botBarHFrame: '',
    botBarHBird: '',
    bottomBarAngle: '',
    droop: '',
    preload: '',
    tireComp: '',
    tireSize: '',
    stagger: '',
    tirePress: '',
  },
  rr: {
    spring: '',
    springHeight: '',
    shock: '',
    load: '',
    loadCtoC: '',
    topBarHFrame: '',
    topBarHBird: '',
    topBarAngRH: '',
    topBarAngFD: '',
    botBarHFrame: '',
    botBarHBird: '',
    bottomBarAngle: '',
    preload: '',
    tireComp: '',
    tireSize: '',
    stagger: '',
    tirePress: '',
  }
};

export const INITIAL_SETUPS: Setup[] = [];

export const INITIAL_WEEKENDS: RaceWeekend[] = [];

export const INITIAL_RECENT_SESSIONS: SessionRecord[] = [];

export const INITIAL_ACTIVE_SESSION: ActiveSession = {
  name: '',
  track: '',
  setupUsed: '',
  condition: '',
  weather: '',
  time: '',
  bestLap: '',
  avgLap: '',
  finishPos: '',
  gap: '',
  maxRpm: '',
  leaderLap: '',
  leaderGap: '',
  diagnostics: {
    cornerEntry: 'NEUTRAL',
    cornerEntryNotes: '',
    centerApex: 'NEUTRAL',
    centerApexNotes: '',
    cornerExit: 'NEUTRAL',
    cornerExitNotes: '',
  },
  adjustments: [],
  tires: {
    lf: { compound: '', size: '', airPressure: '' },
    rf: { compound: '', size: '', airPressure: '' },
    lr: { compound: '', size: '', airPressure: '' },
    rr: { compound: '', size: '', airPressure: '' }
  },
  pressures: {
    lf: '',
    rf: '',
    lr: '',
    rr: '',
  },
  competitionNotes: '',
};

export const INITIAL_TODOS: import('./types').Todo[] = [];

export const INITIAL_TEAMS: import('./types').Team[] = [];

export const INITIAL_TEAM_MEMBERS: import('./types').TeamMember[] = [];

export const INITIAL_TODO_ITEM: import('./types').TodoItem = {
  id: '',
  text: '',
  desc: '',
  done: false,
};

