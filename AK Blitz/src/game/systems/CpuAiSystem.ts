// ============================================================================
// CpuAiSystem.ts — CPU control. Defense plays rush/man/zone/spy per the called
// defensive play, then everyone rallies to the ball. Also a light CPU offense
// for when possession flips (structured for future full CPU drives).
// ============================================================================
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { getDefensivePlay } from "../data/plays";
import { PLAYER, FIELD } from "../config";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

export class CpuAiSystem {
  /** Called at snap: hand out coverage assignments to defenders. */
  assignCoverage(ctx: GameContext) {
    const dplay = getDefensivePlay(ctx.defensePlayId);
    const defenders = ctx.entities.filter((e) => e.side === "defense").sort((a, b) => a.slot - b.slot);
    const receivers = ctx.entities.filter(
      (e) => e.side === "offense" && e.role !== "QB" && e.role !== "BLOCK"
    );
    let manIdx = 0;
    defenders.forEach((d, i) => {
      const intent = dplay.intents[i] ?? "zone";
      d.defIntent = intent;
      d.coverTargetId = null;
      d.zoneAnchor = null;
      if (intent === "man") {
        const tgt = receivers[manIdx % receivers.length];
        manIdx++;
        d.coverTargetId = tgt ? tgt.data.id : null;
      } else if (intent === "zone") {
        // spread zone anchors across the field a few yards downfield
        const lane = (i - 2) * 7;
        d.zoneAnchor = new Vector3(lane, PLAYER.Y, ctx.losZ + 9);
      }
    });
  }

  private speedOf(e: RuntimeEntity, ctx: GameContext): number {
    let s = PLAYER.MAX_SPEED * (e.data.speed / 100) * ctx.diff.cpuSpeedMult;
    if (e.onFire) s *= 1.15;
    if (e.stunTimer > 0) s = 0;
    return s;
  }

  private steer(e: RuntimeEntity, tx: number, tz: number, speed: number) {
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    e.vel.set((dx / d) * speed, 0, (dz / d) * speed);
  }

  updateDefense(ctx: GameContext, dt: number) {
    void dt;
    const carrier = ctx.ball.carrierId ? ctx.ent(ctx.ball.carrierId) : null;
    const carrierIsOffense = carrier?.side === "offense";
    const qb = ctx.entities.find((e) => e.side === "offense" && e.role === "QB");

    for (const d of ctx.entities) {
      if (d.side !== "defense") continue;
      if (d.stunTimer > 0) continue;
      const speed = this.speedOf(d, ctx);

      // Ball in the air → break on the ball / target receiver
      if (ctx.ball.inAir) {
        this.steer(d, ctx.ball.pos.x, ctx.ball.pos.z, speed);
        continue;
      }

      // Offense has a ball carrier (post-catch or QB scramble) → pursue with lead
      if (carrierIsOffense && carrier) {
        const lead = 0.25;
        this.steer(d, carrier.pos.x + carrier.vel.x * lead, carrier.pos.z + carrier.vel.z * lead, speed);
        continue;
      }

      // Pre-throw: play your assignment
      const intent = d.defIntent ?? "zone";
      if (intent === "rush" && qb) {
        this.steer(d, qb.pos.x, qb.pos.z, speed);
      } else if (intent === "spy" && qb) {
        this.steer(d, qb.pos.x, ctx.losZ + 2.5, speed * 0.8);
      } else if (intent === "man") {
        const tgt = d.coverTargetId ? ctx.entities.find((e) => e.data.id === d.coverTargetId) : null;
        if (tgt) {
          // sit a yard goal-side of the receiver
          this.steer(d, tgt.pos.x, tgt.pos.z + 1.2, speed * 0.96);
        } else if (qb) {
          this.steer(d, qb.pos.x, qb.pos.z, speed);
        }
      } else {
        // zone: hold anchor, jump nearest receiver that enters the zone
        const anchor = d.zoneAnchor ?? new Vector3(0, PLAYER.Y, ctx.losZ + 9);
        let threat: RuntimeEntity | null = null;
        let best = 9;
        for (const r of ctx.entities) {
          if (r.side !== "offense" || r.role === "QB" || r.role === "BLOCK") continue;
          const dd = Math.hypot(r.pos.x - anchor.x, r.pos.z - anchor.z);
          if (dd < best) { best = dd; threat = r; }
        }
        if (threat && best < 7) this.steer(d, threat.pos.x, threat.pos.z, speed);
        else this.steer(d, anchor.x, anchor.z, speed * 0.6);
      }
    }
  }

  /** Light CPU offense for future full drives (used only if humanIsOffense=false). */
  updateOffense(ctx: GameContext, dt: number) {
    void dt;
    const carrier = ctx.ball.carrierId ? ctx.ent(ctx.ball.carrierId) : null;
    for (const o of ctx.entities) {
      if (o.side !== "offense" || o.stunTimer > 0) continue;
      const speed = PLAYER.MAX_SPEED * (o.data.speed / 100) * ctx.diff.cpuSpeedMult;
      if (carrier && carrier === o) {
        // run toward the goal line, drift away from nearest defender
        let nd: RuntimeEntity | null = null, best = 99;
        for (const e of ctx.entities)
          if (e.side === "defense") {
            const dd = Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z);
            if (dd < best) { best = dd; nd = e; }
          }
        let tx = o.pos.x;
        if (nd && best < 6) tx += o.pos.x - nd.pos.x;
        this.steer(o, clampX(tx), FIELD.LEN + 2, speed);
      } else if (o.role !== "QB") {
        const dir = ctx.scene; void dir;
        // run routes via RouteSystem handled elsewhere; idle drift downfield
        this.steer(o, o.pos.x, o.pos.z + 4, speed * 0.7);
      }
    }
  }
}

function clampX(x: number): number {
  const hw = FIELD.HALF_W - PLAYER.RADIUS;
  return Math.max(-hw, Math.min(hw, x));
}
