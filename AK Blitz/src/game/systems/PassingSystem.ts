// ============================================================================
// PassingSystem.ts — the 3D football: throw arc, homing-by-accuracy, and
// catch / drop / interception resolution.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { BALL, PLAYER } from "../config";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

export type PassOutcome =
  | { type: "none" }
  | { type: "complete"; receiver: RuntimeEntity }
  | { type: "incomplete" }
  | { type: "intercept"; defender: RuntimeEntity };

export class PassingSystem {
  private scene: Scene;
  private ballMesh: Mesh;
  private ballMat: StandardMaterial;
  private flightTime = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.ballMesh = MeshBuilder.CreateSphere("ball", { diameter: BALL.RADIUS * 2, segments: 8 }, scene);
    this.ballMesh.scaling.z = 1.6; // football-ish
    this.ballMat = new StandardMaterial("ballm", scene);
    this.ballMat.diffuseColor = new Color3(0.45, 0.25, 0.08);
    this.ballMat.specularColor = new Color3(0.2, 0.2, 0.2);
    this.ballMesh.material = this.ballMat;
    this.ballMesh.setEnabled(false);
  }

  syncCarried(ctx: GameContext) {
    const c = ctx.ball.carrierId ? ctx.ent(ctx.ball.carrierId) : null;
    if (c) {
      ctx.ball.pos.set(c.pos.x, PLAYER.Y + 0.4, c.pos.z);
      this.ballMesh.position.copyFrom(ctx.ball.pos);
      this.ballMesh.setEnabled(true);
    }
  }

  throwTo(ctx: GameContext, receiver: RuntimeEntity, thrower: RuntimeEntity) {
    const b = ctx.ball;
    b.inAir = true;
    b.carrierId = null;
    b.targetId = receiver.data.id;
    b.glow = ctx.prophecyArmed;
    this.flightTime = 0;

    // accuracy 0..1
    const baseAcc = thrower.data.throwingAccuracy / 100;
    b.accuracy = ctx.prophecyArmed ? 1 : Math.min(1, baseAcc * (thrower.onFire ? 1.1 : 1));
    ctx.prophecyArmed = false;

    b.pos.set(thrower.pos.x, PLAYER.Y + 0.9, thrower.pos.z);

    // lead the receiver
    const lead = 0.35;
    const tx = receiver.pos.x + receiver.vel.x * lead;
    const tz = receiver.pos.z + receiver.vel.z * lead;
    const dx = tx - b.pos.x;
    const dz = tz - b.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const t = dist / BALL.SPEED;
    b.vel.set(dx / t, 0.5 * BALL.GRAVITY * t, dz / t);

    this.ballMat.emissiveColor = b.glow ? new Color3(1, 0.8, 0.2) : new Color3(0, 0, 0);
    this.ballMesh.setEnabled(true);
  }

  /** advance ball flight; resolve catch/drop/pick. */
  update(ctx: GameContext, dt: number): PassOutcome {
    const b = ctx.ball;
    if (!b.inAir) {
      this.syncCarried(ctx);
      return { type: "none" };
    }
    this.flightTime += dt;
    const receiver = b.targetId ? ctx.entities.find((e) => e.data.id === b.targetId) : null;

    // homing toward receiver scaled by accuracy (accurate = catchable)
    if (receiver) {
      const dx = receiver.pos.x - b.pos.x;
      const dz = receiver.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const steer = 18 * b.accuracy;
      b.vel.x += (dx / d) * steer * dt;
      b.vel.z += (dz / d) * steer * dt;
    }

    b.vel.y -= BALL.GRAVITY * dt;
    b.pos.addInPlace(b.vel.scale(dt));
    b.height = b.pos.y;
    this.ballMesh.position.copyFrom(b.pos);
    this.ballMesh.rotation.x += dt * 18;

    const catchable = b.pos.y < 3.2 && this.flightTime > 0.12;

    if (catchable) {
      // defenders first (interception)
      const defs = ctx.entities.filter((e) => e.side === "defense" && e.stunTimer <= 0);
      for (const d of defs) {
        if (this.near(d, b)) {
          const pickChance =
            0.25 + ctx.diff.cpuInterceptSkill * 0.5 + d.data.catching / 400 - b.accuracy * 0.35;
          if (ctx.rng() < Math.max(0.04, pickChance)) {
            this.giveBall(ctx, d);
            return { type: "intercept", defender: d };
          }
        }
      }
      // intended receiver
      if (receiver && receiver.stunTimer <= 0 && this.near(receiver, b)) {
        const contested = this.nearestDefDist(ctx, receiver) < 2.6;
        const catchChance =
          receiver.data.catching / 100 * b.accuracy * (contested ? 0.6 : 1.05);
        if (ctx.rng() < Math.min(0.97, catchChance)) {
          this.giveBall(ctx, receiver);
          return { type: "complete", receiver };
        } else {
          b.inAir = false;
          this.ballMesh.setEnabled(false);
          return { type: "incomplete" };
        }
      }
    }

    // hit the ground
    if (b.pos.y <= 0.3) {
      b.inAir = false;
      b.vel.setAll(0);
      this.ballMesh.setEnabled(false);
      return { type: "incomplete" };
    }
    return { type: "none" };
  }

  private near(e: RuntimeEntity, b: GameContext["ball"]): boolean {
    return Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) < BALL.CATCH_RADIUS;
  }
  private nearestDefDist(ctx: GameContext, r: RuntimeEntity): number {
    let m = 99;
    for (const d of ctx.entities)
      if (d.side === "defense") m = Math.min(m, Math.hypot(d.pos.x - r.pos.x, d.pos.z - r.pos.z));
    return m;
  }

  giveBall(ctx: GameContext, e: RuntimeEntity) {
    ctx.ball.inAir = false;
    ctx.ball.carrierId = e.data.id;
    ctx.ball.targetId = null;
    for (const o of ctx.entities) o.hasBall = false;
    e.hasBall = true;
    this.syncCarried(ctx);
  }

  hideBall() {
    this.ballMesh.setEnabled(false);
  }
}
