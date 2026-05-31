// ============================================================================
// TackleSystem.ts — contact resolution. Defenders tackle the ball carrier;
// big hits spray blood + shake the camera. Carriers fight back with stiff-arms
// and hurdles. Mayhem/Heat rewards go to the human side.
// ============================================================================
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PLAYER, MAYHEM, WANTED } from "../config";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";
import type { PlayerSystem } from "./PlayerSystem";

export interface TackleOutcome {
  ended: boolean;
  bigHit: boolean;
  tacklerId?: string;
  carrierId?: string;
}

export class TackleSystem {
  private players: PlayerSystem;
  constructor(players: PlayerSystem) {
    this.players = players;
  }

  /** Per-frame: resolve the ball carrier getting tackled. Returns play-ending info. */
  resolveContacts(ctx: GameContext, humanBigHitHeld: boolean): TackleOutcome {
    const carrier = ctx.ball.carrierId ? ctx.ent(ctx.ball.carrierId) : null;
    if (!carrier) return { ended: false, bigHit: false };

    const tacklers = ctx.entities.filter((e) => e.side !== carrier.side && e.stunTimer <= 0);
    const reach = PLAYER.RADIUS * 2 + 0.4;

    for (const t of tacklers) {
      const dx = carrier.pos.x - t.pos.x;
      const dz = carrier.pos.z - t.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach) continue;

      // carrier hurdling = i-frames, jumps the tackle
      if (carrier.invulnTimer > 0) continue;

      // is this a big hit?
      const tacklerIsHuman = t.isHuman; // human on defense (future); offense slice = CPU tacklers
      const big =
        (tacklerIsHuman && humanBigHitHeld) ||
        t.onFire ||
        ctx.rng() < ctx.diff.cpuBigHitChance * (t.data.bigHit / 80);

      // chance the carrier breaks a non-big tackle via strength
      const breakChance = Math.max(
        0,
        (carrier.data.strength + carrier.data.stiffArm) / 2 / 100 - t.data.tackling / 130
      ) * 0.5;
      if (!big && ctx.rng() < breakChance) {
        // broken tackle: shove the would-be tackler, keep running
        this.players.knockback(t, -dx, -dz, 9, 0.5);
        ctx.audio.hit();
        continue;
      }

      // TACKLE
      this.players.knockback(carrier, dx, dz, big ? 16 : 9, big ? 1.1 : 0.7);
      carrier.state = "down";
      carrier.hasBall = true;

      const hitPos = new Vector3(carrier.pos.x, PLAYER.Y, carrier.pos.z);
      if (big) {
        ctx.effects.bloodBurst(hitPos, 1.3);
        ctx.camera.addShake(0.9);
        ctx.hud.doFlash(0.6);
        ctx.audio.bigHit();
        // helmet pop = debris
        ctx.effects.debris(new Vector3(hitPos.x, PLAYER.HEIGHT, hitPos.z));
      } else {
        ctx.effects.bloodBurst(hitPos, 0.6);
        ctx.camera.addShake(0.35);
        ctx.audio.hit();
      }

      return { ended: true, bigHit: big, tacklerId: t.data.id, carrierId: carrier.data.id };
    }
    return { ended: false, bigHit: false };
  }

  /** Human ball-carrier stiff-arm: knock back the nearest front defender. */
  stiffArm(ctx: GameContext, carrier: RuntimeEntity): boolean {
    if (carrier.armCooldown > 0) return false;
    let best: RuntimeEntity | null = null;
    let bestD = 4.5;
    for (const e of ctx.entities) {
      if (e.side === carrier.side) continue;
      const dx = e.pos.x - carrier.pos.x;
      const dz = e.pos.z - carrier.pos.z;
      const d = Math.hypot(dx, dz);
      // in front (downfield-ish) and close
      if (d < bestD && dz > -1.5) { bestD = d; best = e; }
    }
    if (!best) return false;
    const power = 14 * (carrier.data.stiffArm / 80) * (carrier.onFire ? 1.4 : 1);
    this.players.knockback(best, best.pos.x - carrier.pos.x, best.pos.z - carrier.pos.z, power, 0.9);
    carrier.armCooldown = 0.6;
    ctx.effects.bloodBurst(new Vector3(best.pos.x, PLAYER.Y, best.pos.z), 0.7);
    ctx.camera.addShake(0.3);
    ctx.audio.hit();
    return true;
  }

  /** Human ball-carrier hurdle: brief i-frames to leap a tackle. */
  hurdle(ctx: GameContext, carrier: RuntimeEntity): boolean {
    if (carrier.armCooldown > 0) return false;
    carrier.invulnTimer = 0.55;
    carrier.armCooldown = 0.8;
    ctx.audio.ui();
    return true;
  }

  /** Mayhem/heat/wanted bookkeeping when the human side lands a hit. */
  rewardHumanHit(ctx: GameContext, big: boolean, dirty = false) {
    void big;
    void dirty;
    void MAYHEM;
    void WANTED;
  }
}
