// ============================================================================
// WantedSystem.ts — Wanted meter. Mostly placeholder UI for this slice; in
// future, high Wanted spawns refs/security/hazards.
// ============================================================================
import { WANTED } from "../config";
import type { GameContext } from "../GameContext";

export class WantedSystem {
  add(ctx: GameContext, amount: number) {
    ctx.wanted = Math.min(WANTED.MAX, ctx.wanted + amount);
  }
  dirty(ctx: GameContext) { this.add(ctx, WANTED.GAIN_DIRTY); }
  cartOff(ctx: GameContext) { this.add(ctx, WANTED.GAIN_CARTOFF); }
  taunt(ctx: GameContext) { this.add(ctx, WANTED.GAIN_TAUNT); }

  update(ctx: GameContext, dt: number) {
    // slow passive cool-down so it doesn't peg forever
    ctx.wanted = Math.max(0, ctx.wanted - 0.6 * dt);
  }
}
