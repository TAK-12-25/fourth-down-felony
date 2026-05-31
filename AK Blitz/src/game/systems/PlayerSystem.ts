// ============================================================================
// PlayerSystem.ts — spawns chunky low-poly arcade football players (built by
// PlayerModelFactory), places formations, integrates arcade movement, drives
// procedural run/idle/stun animation, knockback. Logic is unchanged from the
// capsule prototype — only the presentation got a major upgrade.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PLAYER, FIELD } from "../config";
import { TEAMS } from "../data/teams";
import { getPlayer } from "../data/players";
import { getOffensivePlay } from "../data/plays";
import { createFootballPlayer, type PlayerModel } from "../rendering/PlayerModelFactory";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

export class PlayerSystem {
  private scene: Scene;
  private rigs = new Map<number, PlayerModel>();
  private nextMeshId = 1;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  rigOf(e: RuntimeEntity): PlayerModel | undefined {
    return this.rigs.get(e.meshId);
  }
  /** torso is the fire/particle emitter anchor used by EffectsSystem. */
  bodyMesh(e: RuntimeEntity): Mesh | undefined {
    return this.rigs.get(e.meshId)?.torso;
  }

  /** Build both teams' on-field entities + meshes. */
  spawn(ctx: GameContext) {
    this.dispose();
    ctx.entities.length = 0;
    const offense = TEAMS[ctx.offenseTeamId];
    const defense = TEAMS[ctx.defenseTeamId];

    offense.roster.forEach((pid, slot) => {
      ctx.entities.push(this.makeEntity(getPlayer(pid).id, "offense", slot, offense.primary, offense.secondary));
    });
    defense.roster.forEach((pid, slot) => {
      ctx.entities.push(this.makeEntity(getPlayer(pid).id, "defense", slot, defense.primary, defense.secondary));
    });

    this.positionFormation(ctx);
  }

  private makeEntity(
    pid: string,
    side: "offense" | "defense",
    slot: number,
    primaryHex: string,
    secondaryHex: string
  ): RuntimeEntity {
    const jersey = Color3.FromHexString(primaryHex);
    const pants = Color3.FromHexString(secondaryHex);
    const helmet = jersey.scale(0.78);
    const model = createFootballPlayer(this.scene, jersey, pants, helmet);
    const meshId = this.nextMeshId++;
    this.rigs.set(meshId, model);
    return {
      data: getPlayer(pid),
      side,
      slot,
      pos: new Vector3(0, PLAYER.Y, 0),
      vel: new Vector3(0, 0, 0),
      facing: side === "offense" ? 0 : Math.PI,
      speedMult: 1,
      role: "DEF",
      routeIdx: 0,
      state: "idle",
      stunTimer: 0,
      invulnTimer: 0,
      armCooldown: 0,
      onFire: false,
      fireTimer: 0,
      isHuman: false,
      hasBall: false,
      meshId,
    };
  }

  /** Lay out offense + defense at the line of scrimmage for the chosen plays. */
  positionFormation(ctx: GameContext) {
    const los = ctx.losZ;
    const play = getOffensivePlay(ctx.offensePlayId);
    const off = ctx.entities.filter((e) => e.side === "offense");
    const def = ctx.entities.filter((e) => e.side === "defense");

    for (const e of off) {
      const a = play.assignments.find((x) => x.slot === e.slot);
      e.role = a?.role ?? "WR";
      e.route = a?.route ?? [];
      e.routeIdx = 0;
      e.hasBall = false;
      e.state = "idle";
      e.vel.setAll(0);
      let x = 0, z = los;
      if (e.role === "QB") { x = 0; z = los - 4; }
      else if (e.role === "RB") { x = 0; z = los - 5; }
      else {
        const first = e.route && e.route.length ? e.route[0] : { x: (e.slot - 2) * 6, z: 0 };
        x = first.x;
        z = los - 0.5;
      }
      e.pos.set(x, PLAYER.Y, z);
      e.facing = 0;
    }

    const defXs = [0, -8, 8, -4, 4];
    def.forEach((e, i) => {
      e.pos.set(defXs[i] ?? 0, PLAYER.Y, los + 3 + (i === 0 ? 0 : 2));
      e.facing = Math.PI;
      e.vel.setAll(0);
      e.state = "idle";
      e.coverTargetId = null;
      e.zoneAnchor = null;
    });

    this.syncMeshes(ctx, 0, true);
  }

  /** Apply velocity → position for all entities; clamp to field; face heading. */
  integrate(ctx: GameContext, dt: number) {
    for (const e of ctx.entities) {
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.state = e.stunTimer > 0 ? "stunned" : "idle";
        e.vel.scaleInPlace(Math.max(0, 1 - 6 * dt));
      }
      e.pos.addInPlace(e.vel.scale(dt));

      const hw = FIELD.HALF_W - PLAYER.RADIUS;
      if (e.pos.x > hw) { e.pos.x = hw; e.vel.x = 0; }
      if (e.pos.x < -hw) { e.pos.x = -hw; e.vel.x = 0; }
      if (e.pos.z < -FIELD.EZ) e.pos.z = -FIELD.EZ;
      if (e.pos.z > FIELD.LEN + FIELD.EZ) e.pos.z = FIELD.LEN + FIELD.EZ;

      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (sp > 0.5 && e.stunTimer <= 0) {
        const target = Math.atan2(e.vel.x, e.vel.z);
        e.facing = lerpAngle(e.facing, target, Math.min(1, PLAYER.TURN_RATE * dt));
        e.state = e.hasBall ? "carrying" : "running";
      } else if (e.stunTimer <= 0 && e.state !== "celebrate") {
        e.state = e.hasBall ? "carrying" : "idle";
      }
    }
  }

  /** Copy transforms to meshes + procedural run/idle/stun animation + indicators. */
  syncMeshes(ctx: GameContext, dt: number, force = false) {
    const now = performance.now() / 1000;
    for (const e of ctx.entities) {
      const m = this.rigs.get(e.meshId);
      if (!m) continue;
      m.root.position.set(e.pos.x, 0, e.pos.z);
      m.root.rotation.y = e.facing;

      const sp = Math.hypot(e.vel.x, e.vel.z);
      const downed = e.state === "stunned" || e.state === "down";

      if (downed) {
        // slump backward, splay the limbs — arcade "got trucked" pose
        m.root.rotation.x = lerp(m.root.rotation.x, -1.15, Math.min(1, 12 * dt));
        m.lHip.rotation.x = -0.9; m.rHip.rotation.x = 0.5;
        m.lSh.rotation.x = -1.4; m.rSh.rotation.x = -1.1;
        m.helmet.position.y = m.helmetBaseY;
      } else {
        m.root.rotation.x = lerp(m.root.rotation.x, sp > 1 ? 0.14 : 0, Math.min(1, 10 * dt));
        const moving = sp > 1;
        const rate = moving ? 2.2 + sp * 1.1 : 2.4;
        m.bob += dt * rate;
        const amp = moving ? Math.min(0.95, 0.3 + sp * 0.05) : 0.06;
        const s = Math.sin(m.bob);
        // legs and arms swing in opposition (contralateral gait)
        m.lHip.rotation.x = s * amp;
        m.rHip.rotation.x = -s * amp;
        m.lSh.rotation.x = -s * amp * 0.9;
        m.rSh.rotation.x = s * amp * 0.9;
        // helmet bob (double-time)
        m.helmet.position.y = m.helmetBaseY + Math.abs(Math.sin(m.bob)) * (moving ? 0.06 : 0.02);
      }

      // ---- indicators ----
      const show = (e.isHuman && !force) || e.hasBall;
      m.ring.setEnabled(show);
      m.arrow.setEnabled(show);
      if (show) {
        const pulse = 1 + 0.1 * Math.sin(now * 6);
        m.ring.scaling.set(pulse, pulse, 1);
        m.arrow.position.y = 4.2 + 0.18 * Math.sin(now * 4);
        const carrierCol = e.hasBall ? new Color3(1, 0.85, 0.2) : new Color3(0.4, 0.9, 1);
        (m.ring.material as StandardMaterial).emissiveColor = carrierCol;
        (m.arrow.material as StandardMaterial).emissiveColor = carrierCol;
      }
    }
  }

  knockback(e: RuntimeEntity, dirX: number, dirZ: number, power: number, stun: number) {
    const mag = Math.hypot(dirX, dirZ) || 1;
    e.vel.set((dirX / mag) * power, 0, (dirZ / mag) * power);
    e.stunTimer = Math.max(e.stunTimer, stun);
    e.state = "stunned";
  }

  dispose() {
    for (const m of this.rigs.values()) m.root.dispose(false, true);
    this.rigs.clear();
    this.nextMeshId = 1;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
