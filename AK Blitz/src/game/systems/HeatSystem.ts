// ============================================================================
// HeatSystem.ts — "On Fire" state. Triggers from big plays; boosts speed and
// hit power; renders a flame trail; decays over time.
// ============================================================================
import { HEAT } from "../config";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";
import type { PlayerSystem } from "./PlayerSystem";

export class HeatSystem {
  private players: PlayerSystem;
  constructor(players: PlayerSystem) {
    this.players = players;
  }

  ignite(ctx: GameContext, e: RuntimeEntity) {
    if (e.onFire) {
      e.fireTimer = HEAT.DURATION; // refresh
      return;
    }
    e.onFire = true;
    e.fireTimer = HEAT.DURATION;
    const mesh = this.players.bodyMesh(e);
    if (mesh) ctx.effects.setFire(e, mesh, true);
    ctx.audio.fire();
    if (e.side === ctx.offenseTeamId || e.isHuman) ctx.hud.toast("ON FIRE", "#ff8a1f");
  }

  /** Multiplier applied to a player's top speed. */
  speedMult(e: RuntimeEntity): number {
    return e.onFire ? HEAT.SPEED_BOOST : 1;
  }

  update(ctx: GameContext, dt: number) {
    for (const e of ctx.entities) {
      if (!e.onFire) continue;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.onFire = false;
        const mesh = this.players.bodyMesh(e);
        if (mesh) ctx.effects.setFire(e, mesh, false);
      }
    }
  }
}
