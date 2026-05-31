// ============================================================================
// gameTypes.ts — shared types for Fourth Down Felony
// ============================================================================
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type Side = "offense" | "defense";
export type Difficulty = "rookie" | "pro" | "psycho";

// ---------------------------------------------------------------------------
// Players (data model — built to expand into full rosters later)
// ---------------------------------------------------------------------------
export interface PlayerData {
  id: string;
  name: string;
  short: string; // jersey / label name
  teamId: string;
  position: string;
  speed: number; // 0..100
  acceleration: number;
  strength: number;
  throwingPower: number;
  throwingAccuracy: number;
  catching: number;
  routeRunning: number;
  tackling: number;
  bigHit: number;
  stiffArm: number;
  hurdle: number;
  durability: number;
  stamina: number;
  violence: number;
  swagger: number;
  chaos: number;
  specialMoveId: string | null;
  traits: string[];
}

export interface TeamData {
  id: string;
  name: string;
  abbr: string;
  primary: string; // hex
  secondary: string; // hex
  roster: string[]; // player ids
}

// ---------------------------------------------------------------------------
// Playbook
// ---------------------------------------------------------------------------
export type RoutePoint = { x: number; z: number }; // local to LOS, +z downfield
export interface Assignment {
  slot: number; // lineup slot 0..4
  role: "QB" | "RB" | "WR" | "TE" | "BLOCK";
  route: RoutePoint[]; // empty for QB/blockers
}
export interface OffensivePlay {
  id: string;
  name: string;
  type: "pass" | "run" | "trick";
  description: string;
  formation: string;
  primarySlot: number;
  assignments: Assignment[];
  risk: number; // 1..5
  reward: number; // 1..5
}
export interface DefensivePlay {
  id: string;
  name: string;
  type: "blitz" | "zone" | "man" | "contain";
  description: string;
  // per-slot intent: who rushes, who covers man, who plays zone
  intents: ("rush" | "man" | "zone" | "spy")[];
  risk: number;
  reward: number;
}

export interface SpecialMove {
  id: string;
  name: string;
  desc: string;
  kind: "shockwave" | "passBoost" | "speedBurst";
}

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  cpuSpeedMult: number;
  cpuReaction: number; // 0..1 lower = slower to react
  cpuBigHitChance: number;
  cpuThrowAccuracy: number;
  cpuInterceptSkill: number;
}

// ---------------------------------------------------------------------------
// Runtime entity (a player instance on the field)
// ---------------------------------------------------------------------------
export type EntityState =
  | "idle"
  | "running"
  | "stunned"
  | "carrying"
  | "blocking"
  | "celebrate"
  | "down";

export interface RuntimeEntity {
  data: PlayerData;
  side: Side; // which side THIS PLAY
  slot: number;
  // movement (we keep our own physics on the XZ plane; y is fixed)
  pos: Vector3;
  vel: Vector3;
  facing: number; // radians, 0 = +z
  speedMult: number;
  // role for the current play
  role: Assignment["role"] | "DEF";
  route?: RoutePoint[];
  routeIdx: number;
  defIntent?: "rush" | "man" | "zone" | "spy";
  coverTargetId?: string | null;
  zoneAnchor?: Vector3 | null;
  // state
  state: EntityState;
  stunTimer: number;
  invulnTimer: number; // hurdling / juke i-frames
  armCooldown: number; // stiff-arm / big-hit cooldown
  onFire: boolean;
  fireTimer: number;
  isHuman: boolean; // currently human-controlled
  hasBall: boolean;
  // visuals (set by PlayerSystem)
  meshId: number;
}

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------
export interface BallState {
  pos: Vector3;
  vel: Vector3;
  inAir: boolean;
  carrierId: string | null;
  targetId: string | null;
  height: number;
  accuracy: number; // computed at throw, affects landing scatter
  glow: boolean; // prophecy-pass style
}

// ---------------------------------------------------------------------------
// Top-level game phase
// ---------------------------------------------------------------------------
export type Phase =
  | "menu"
  | "presnap"
  | "live"
  | "pass" // ball in air
  | "deadball" // tackle / incompletion resolved, short pause
  | "score"
  | "gameover";
