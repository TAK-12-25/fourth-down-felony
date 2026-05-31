// ============================================================================
// MayhemSystem.ts — the Mayhem meter + special-move activation.
// Vibe Check = shockwave that launches nearby defenders. Prophecy Pass arms
// the next throw for guaranteed accuracy + glowing trail.
// ============================================================================
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MAYHEM, PLAYER } from "../config";
import { getSpecial } from "../data/specials";
import type { GameContext } from "../GameContext";
import type { PlayerSystem } from "./PlayerSystem";

export class MayhemSystem {
  private players: PlayerSystem;
  constructor(players: PlayerSystem) {
    this.players = players;
  }

  add(ctx: GameContext, amount: number) {
    ctx.mayhem = Math.min(MAYHEM.MAX, ctx.mayhem + amount);
    if (ctx.mayhem >= MAYHEM.MAX && !ctx.mayhemReady) {
      ctx.mayhemReady = true;
      ctx.hud.toast("MAYHEM READY", "#ffd23f", "Press R");
    }
  }

  /** Fire the controlled player's special. Returns true if something happened. */
  activateSpecial(ctx: GameContext): boolean {
    if (!ctx.mayhemReady) return false;
    const hero = ctx.ent(ctx.controlledId);
    if (!hero) return false;
    const special = getSpecial(hero.data.specialMoveId);

    ctx.mayhem = 0;
    ctx.mayhemReady = false;

    if (special && special.kind === "passBoost") {
      ctx.prophecyArmed = true;
      ctx.hud.toast(special.name.toUpperCase(), "#ffd23f", "Next pass is money");
      ctx.audio.fire();
      return true;
    }

    if (special && special.kind === "speedBurst") {
      hero.onFire = true;
      hero.fireTimer = 6;
      const mesh = this.players.bodyMesh(hero);
      if (mesh) ctx.effects.setFire(hero, mesh, true);
      ctx.hud.toast(special.name.toUpperCase(), "#ff8a1f");
      ctx.audio.fire();
      return true;
    }

    // default + shockwave kind: Vibe Check blast
    const center = new Vector3(hero.pos.x, PLAYER.Y, hero.pos.z);
    ctx.effects.shockwaveRing(center);
    ctx.camera.addShake(1.1);
    ctx.hud.doFlash(0.5);
    ctx.audio.shockwave();
    const radius = 10;
    for (const e of ctx.entities) {
      if (e.side === hero.side) continue;
      const dx = e.pos.x - hero.pos.x;
      const dz = e.pos.z - hero.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        const power = 22 * (1 - d / radius) + 6;
        this.players.knockback(e, dx, dz, power, 1.3);
        ctx.effects.bloodBurst(new Vector3(e.pos.x, PLAYER.Y, e.pos.z), 1.0);
      }
    }
    ctx.hud.toast(special ? special.name.toUpperCase() : "VIBE CHECK", "#ff3b30");
    return true;
  }
}
