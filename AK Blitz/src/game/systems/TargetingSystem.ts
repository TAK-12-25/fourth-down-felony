// ============================================================================
// TargetingSystem.ts — picks the receiver the player is aiming at.
// Scores by aim alignment, openness, distance, and designed-primary bonus.
// ============================================================================
import { getOffensivePlay } from "../data/plays";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

export interface TargetResult {
  receiver: RuntimeEntity | null;
  status: "OPEN" | "TIGHT" | "COVERED";
  isPrimary: boolean;
  nearestDefDist: number;
}

export class TargetingSystem {
  compute(ctx: GameContext): TargetResult {
    const thrower = this.thrower(ctx);
    if (!thrower) return { receiver: null, status: "COVERED", isPrimary: false, nearestDefDist: 0 };

    const play = getOffensivePlay(ctx.offensePlayId);
    const primarySlot = play.primarySlot;
    const aimX = ctx.input.aimX;
    const aimZ = ctx.input.aimZ;

    const receivers = ctx.entities.filter(
      (e) => e.side === "offense" && e !== thrower && e.role !== "QB" && e.role !== "BLOCK"
    );
    const defenders = ctx.entities.filter((e) => e.side === "defense");

    let best: RuntimeEntity | null = null;
    let bestScore = -Infinity;
    let bestNearDef = 99;

    for (const r of receivers) {
      const dx = r.pos.x - thrower.pos.x;
      const dz = r.pos.z - thrower.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const ndx = dx / dist;
      const ndz = dz / dist;

      // aim alignment: dot of receiver direction with aim direction
      const align = ndx * aimX + ndz * aimZ; // -1..1

      // openness: distance to nearest defender
      let nearDef = 99;
      for (const d of defenders) {
        const dd = Math.hypot(d.pos.x - r.pos.x, d.pos.z - r.pos.z);
        if (dd < nearDef) nearDef = dd;
      }

      // only consider receivers generally downfield of / beside the thrower
      const forwardBias = ndz > -0.4 ? 1 : 0.4;

      const openScore = Math.min(nearDef, 10) / 10; // 0..1
      const distPenalty = dist > 34 ? (dist - 34) / 30 : 0;
      const primaryBonus = r.slot === primarySlot ? 0.25 : 0;

      const score =
        align * 1.4 + openScore * 0.8 + primaryBonus - distPenalty * 0.6;
      const adj = score * forwardBias;

      if (adj > bestScore) {
        bestScore = adj;
        best = r;
        bestNearDef = nearDef;
      }
    }

    let status: TargetResult["status"] = "OPEN";
    if (bestNearDef < 2.6) status = "COVERED";
    else if (bestNearDef < 5.5) status = "TIGHT";

    return {
      receiver: best,
      status,
      isPrimary: best ? best.slot === primarySlot : false,
      nearestDefDist: bestNearDef,
    };
  }

  thrower(ctx: GameContext): RuntimeEntity | undefined {
    if (ctx.ball.carrierId) {
      const c = ctx.ent(ctx.ball.carrierId);
      if (c && c.side === "offense") return c;
    }
    return ctx.entities.find((e) => e.side === "offense" && e.role === "QB");
  }
}
