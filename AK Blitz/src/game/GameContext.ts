// ============================================================================
// GameContext.ts — the shared state bag every system reads/mutates.
// Service systems (effects/hud/camera/audio/input) are attached by GameScene.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import type {
  RuntimeEntity,
  BallState,
  Phase,
  DifficultyConfig,
} from "./types/gameTypes";
import type { EffectsSystem } from "./systems/EffectsSystem";
import type { HudSystem } from "./systems/HudSystem";
import type { CameraSystem } from "./systems/CameraSystem";
import type { AudioSystem } from "./systems/AudioSystem";
import type { InputSystem } from "./systems/InputSystem";

export interface GameContext {
  scene: Scene;
  // services
  effects: EffectsSystem;
  hud: HudSystem;
  camera: CameraSystem;
  audio: AudioSystem;
  input: InputSystem;

  // teams / possession
  offenseTeamId: string;
  defenseTeamId: string;
  humanTeamId: string;
  humanIsOffense: boolean;

  // entities + ball
  entities: RuntimeEntity[];
  ball: BallState;
  controlledId: string; // human-controlled entity id

  // phase / flow
  phase: Phase;
  deadballTimer: number;
  snapTimer: number; // time since snap
  message: string;

  // field situation
  losZ: number; // absolute line of scrimmage
  firstDownZ: number;
  down: number;
  toGo: number;
  playStartZ: number; // where the ball carrier started (for "long play")

  // plays
  offensePlayId: string;
  defensePlayId: string;
  playIndex: number; // cursor in offensive playbook (pre-snap cycling)

  // score / clock
  score: Record<string, number>;
  clock: number;

  // meters
  turbo: number;
  mayhem: number;
  wanted: number;
  mayhemReady: boolean;
  prophecyArmed: boolean; // next pass boosted

  // tuning
  diff: DifficultyConfig;

  // bookkeeping
  rng: () => number;
  ent(id: string): RuntimeEntity | undefined;
}
