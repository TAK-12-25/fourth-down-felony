// ============================================================================
// InputSystem.ts — keyboard → action layer. Edge-triggered actions are
// future-proofed for gamepad / second player / online intents.
// ============================================================================
export type Action =
  | "up" | "down" | "left" | "right"
  | "turbo" | "primary" | "secondary" | "dirty"
  | "special" | "taunt" | "snap" | "pause"
  | "cyclePrev" | "cycleNext";

const KEYMAP: Record<string, Action> = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  ShiftLeft: "turbo", ShiftRight: "turbo",
  Space: "primary",
  KeyE: "secondary",
  KeyQ: "dirty",
  KeyR: "special",
  KeyT: "taunt",
  Enter: "snap",
  KeyP: "pause",
  BracketLeft: "cyclePrev",
  BracketRight: "cycleNext",
  Digit1: "cyclePrev",
  Digit2: "cycleNext",
};

export class InputSystem {
  private down = new Set<Action>();
  private pressedEdge = new Set<Action>();
  /** last horizontal/vertical movement direction held, for aim. */
  aimX = 0;
  aimZ = 1; // default aim downfield
  onPause: (() => void) | null = null;

  attach() {
    window.addEventListener("keydown", this.handleDown);
    window.addEventListener("keyup", this.handleUp);
  }
  detach() {
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
  }

  private handleDown = (e: KeyboardEvent) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!this.down.has(a)) this.pressedEdge.add(a);
    this.down.add(a);
    if (a === "pause") this.onPause?.();
  };
  private handleUp = (e: KeyboardEvent) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    this.down.delete(a);
  };

  held(a: Action) { return this.down.has(a); }
  /** true once per physical press. */
  pressed(a: Action) {
    if (this.pressedEdge.has(a)) return true;
    return false;
  }
  /** clear edge set — call once at end of each frame. */
  endFrame() { this.pressedEdge.clear(); }

  /** movement vector from held keys, normalized; also updates aim. */
  moveVector(): { x: number; z: number } {
    let x = 0, z = 0;
    if (this.down.has("left")) x -= 1;
    if (this.down.has("right")) x += 1;
    if (this.down.has("up")) z += 1; // up = downfield (+z)
    if (this.down.has("down")) z -= 1;
    if (x !== 0 || z !== 0) {
      const m = Math.hypot(x, z);
      this.aimX = x / m;
      this.aimZ = z / m;
      return { x: x / m, z: z / m };
    }
    return { x: 0, z: 0 };
  }
}
