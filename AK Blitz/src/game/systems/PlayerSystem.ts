// ============================================================================
// PlayerSystem.ts — spawns 3D player placeholders (capsule body + helmet box),
// places formations, integrates arcade movement, syncs meshes, knockback.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PLAYER, FIELD } from "../config";
import { TEAMS } from "../data/teams";
import { getPlayer } from "../data/players";
import { getOffensivePlay } from "../data/plays";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

interface Rig {
  root: TransformNode;
  body: Mesh;
  helmet: Mesh;
  ring: Mesh; // selection / target ring
  bob: number;
  mat: StandardMaterial;
}

export class PlayerSystem {
  private scene: Scene;
  private rigs = new Map<number, Rig>();
  private nextMeshId = 1;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private makeRig(color: Color3, accent: Color3): Rig {
    const root = new TransformNode("p" + this.nextMeshId, this.scene);
    const body = MeshBuilder.CreateCapsule(
      "body" + this.nextMeshId,
      { height: PLAYER.HEIGHT, radius: PLAYER.RADIUS, tessellation: 10, capSubdivisions: 4 },
      this.scene
    );
    const mat = new StandardMaterial("pm" + this.nextMeshId, this.scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    body.material = mat;
    body.parent = root;
    body.position.y = PLAYER.HEIGHT / 2;

    const helmet = MeshBuilder.CreateBox(
      "hel" + this.nextMeshId,
      { width: 1.0, height: 0.7, depth: 1.1 },
      this.scene
    );
    const hmat = new StandardMaterial("hm" + this.nextMeshId, this.scene);
    hmat.diffuseColor = accent;
    hmat.specularColor = new Color3(0.3, 0.3, 0.3);
    helmet.material = hmat;
    helmet.parent = root;
    helmet.position.set(0, PLAYER.HEIGHT + 0.1, 0.15);

    const ring = MeshBuilder.CreateTorus(
      "ring" + this.nextMeshId,
      { diameter: 2.6, thickness: 0.18, tessellation: 20 },
      this.scene
    );
    const rmat = new StandardMaterial("rm" + this.nextMeshId, this.scene);
    rmat.emissiveColor = new Color3(1, 0.85, 0.2);
    rmat.diffuseColor = new Color3(1, 0.85, 0.2);
    rmat.specularColor = new Color3(0, 0, 0);
    ring.material = rmat;
    ring.parent = root;
    ring.position.y = 0.12;
    ring.rotation.x = Math.PI / 2;
    ring.setEnabled(false);

    return { root, body, helmet, ring, bob: 0, mat };
  }

  rigOf(e: RuntimeEntity): Rig | undefined {
    return this.rigs.get(e.meshId);
  }
  bodyMesh(e: RuntimeEntity): Mesh | undefined {
    return this.rigs.get(e.meshId)?.body;
  }

  /** Build both teams' on-field entities + meshes. */
  spawn(ctx: GameContext) {
    this.dispose();
    ctx.entities.length = 0;
    const offense = TEAMS[ctx.offenseTeamId];
    const defense = TEAMS[ctx.defenseTeamId];

    offense.roster.forEach((pid, slot) => {
      const e = this.makeEntity(getPlayer(pid).id, "offense", slot, ctx, Color3.FromHexString(offense.primary), Color3.FromHexString(offense.secondary));
      ctx.entities.push(e);
    });
    defense.roster.forEach((pid, slot) => {
      const e = this.makeEntity(getPlayer(pid).id, "defense", slot, ctx, Color3.FromHexString(defense.primary), Color3.FromHexString(defense.secondary));
      ctx.entities.push(e);
    });

    this.positionFormation(ctx);
  }

  private makeEntity(
    pid: string,
    side: "offense" | "defense",
    slot: number,
    _ctx: GameContext,
    color: Color3,
    accent: Color3
  ): RuntimeEntity {
    const rig = this.makeRig(color, accent);
    const meshId = this.nextMeshId++;
    this.rigs.set(meshId, rig);
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

    // Offense: QB just behind LOS, others at formation x from their first route pt
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

    // Defense: mirror across LOS, simple spacing
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
        // friction while stunned (knockback slide)
        e.vel.scaleInPlace(Math.max(0, 1 - 6 * dt));
      }
      e.pos.addInPlace(e.vel.scale(dt));

      // clamp to field width + a little past the end zones
      const hw = FIELD.HALF_W - PLAYER.RADIUS;
      if (e.pos.x > hw) { e.pos.x = hw; e.vel.x = 0; }
      if (e.pos.x < -hw) { e.pos.x = -hw; e.vel.x = 0; }
      if (e.pos.z < -FIELD.EZ) e.pos.z = -FIELD.EZ;
      if (e.pos.z > FIELD.LEN + FIELD.EZ) e.pos.z = FIELD.LEN + FIELD.EZ;

      // facing follows velocity when moving
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

  /** Copy entity transforms to meshes + running bob + selection rings. */
  syncMeshes(ctx: GameContext, dt: number, force = false) {
    for (const e of ctx.entities) {
      const rig = this.rigs.get(e.meshId);
      if (!rig) continue;
      rig.root.position.set(e.pos.x, 0, e.pos.z);
      rig.root.rotation.y = e.facing;

      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (e.state === "stunned") {
        rig.root.rotation.x = -0.7; // knocked back tilt
        rig.bob = 0;
      } else {
        rig.root.rotation.x = 0;
        if (sp > 1) {
          rig.bob += dt * sp * 1.1;
          rig.body.position.y = PLAYER.HEIGHT / 2 + Math.abs(Math.sin(rig.bob)) * 0.18;
        } else {
          rig.body.position.y = PLAYER.HEIGHT / 2;
        }
      }

      // selection ring on human-controlled offense or ball carrier
      const show = (e.isHuman && !force) || e.hasBall;
      rig.ring.setEnabled(show);
      if (show) {
        const rmat = rig.ring.material as StandardMaterial;
        if (e.hasBall) rmat.emissiveColor.set(1, 0.85, 0.2);
        else rmat.emissiveColor.set(0.4, 0.9, 1);
      }
    }
  }

  /** Knock an entity back along dir, stun them. */
  knockback(e: RuntimeEntity, dirX: number, dirZ: number, power: number, stun: number) {
    const m = Math.hypot(dirX, dirZ) || 1;
    e.vel.set((dirX / m) * power, 0, (dirZ / m) * power);
    e.stunTimer = Math.max(e.stunTimer, stun);
    e.state = "stunned";
  }

  dispose() {
    for (const r of this.rigs.values()) r.root.dispose(false, true);
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
