// ============================================================================
// CollisionSystem.ts — keeps players from overlapping (soft push-apart) and
// lets offensive blockers slow rushing defenders.
// ============================================================================
import { PLAYER } from "../config";
import type { GameContext } from "../GameContext";

export class CollisionSystem {
  update(ctx: GameContext) {
    const ents = ctx.entities;
    const minDist = PLAYER.RADIUS * 2;
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        let dx = b.pos.x - a.pos.x;
        let dz = b.pos.z - a.pos.z;
        let d = Math.hypot(dx, dz);
        if (d < 0.0001) { dx = 0.01; d = 0.01; }
        if (d < minDist) {
          const overlap = (minDist - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          // stunned players get pushed more (ragdoll feel)
          const aw = a.stunTimer > 0 ? 1.6 : 1;
          const bw = b.stunTimer > 0 ? 1.6 : 1;
          a.pos.x -= nx * overlap * aw;
          a.pos.z -= nz * overlap * aw;
          b.pos.x += nx * overlap * bw;
          b.pos.z += nz * overlap * bw;

          // blocking: an offensive blocker engaging a defender saps its speed
          if (a.side !== b.side) {
            const blocker = a.role === "BLOCK" ? a : b.role === "BLOCK" ? b : null;
            const defender = a.side === "defense" ? a : b.side === "defense" ? b : null;
            if (blocker && defender && defender.stunTimer <= 0) {
              defender.vel.scaleInPlace(0.55);
            }
          }
        }
      }
    }
  }
}
