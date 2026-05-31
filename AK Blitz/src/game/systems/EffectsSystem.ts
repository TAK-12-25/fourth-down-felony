// ============================================================================
// EffectsSystem.ts — arcade FX: blood bursts, debris, shockwave rings,
// on-fire trails. All textures generated procedurally (no asset files).
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { RuntimeEntity } from "../types/gameTypes";

function dotTexture(scene: Scene, name: string, color: string): DynamicTexture {
  const size = 64;
  const tex = new DynamicTexture(name, size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.6, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

export class EffectsSystem {
  private scene: Scene;
  private bloodTex: DynamicTexture;
  private sparkTex: DynamicTexture;
  private fireTex: DynamicTexture;
  private fires = new Map<number, ParticleSystem>();
  private rings: { mesh: Mesh; life: number; max: number }[] = [];
  private decalCount = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.bloodTex = dotTexture(scene, "fx_blood", "rgba(220,30,30,1)");
    this.sparkTex = dotTexture(scene, "fx_spark", "rgba(255,220,120,1)");
    this.fireTex = dotTexture(scene, "fx_fire", "rgba(255,150,40,1)");
  }

  bloodBurst(pos: Vector3, scale = 1) {
    const ps = new ParticleSystem("blood", 120, this.scene);
    ps.particleTexture = this.bloodTex;
    ps.emitter = pos.clone();
    ps.minEmitBox = new Vector3(-0.2, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 1.4, 0.2);
    ps.color1 = new Color4(0.85, 0.05, 0.05, 1);
    ps.color2 = new Color4(0.5, 0.0, 0.0, 1);
    ps.colorDead = new Color4(0.2, 0, 0, 0);
    ps.minSize = 0.25 * scale;
    ps.maxSize = 0.7 * scale;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 800;
    ps.gravity = new Vector3(0, -22, 0);
    ps.direction1 = new Vector3(-6, 6, -6);
    ps.direction2 = new Vector3(6, 10, 6);
    ps.minEmitPower = 3;
    ps.maxEmitPower = 9 * scale;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = 0.12;
    ps.start();
    this.spawnDecal(pos);
  }

  debris(pos: Vector3) {
    const ps = new ParticleSystem("debris", 40, this.scene);
    ps.particleTexture = this.sparkTex;
    ps.emitter = pos.clone();
    ps.color1 = new Color4(1, 1, 1, 1);
    ps.color2 = new Color4(0.7, 0.7, 0.8, 1);
    ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    ps.minSize = 0.2;
    ps.maxSize = 0.5;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 0.9;
    ps.emitRate = 300;
    ps.gravity = new Vector3(0, -20, 0);
    ps.direction1 = new Vector3(-8, 8, -8);
    ps.direction2 = new Vector3(8, 14, 8);
    ps.minEmitPower = 4;
    ps.maxEmitPower = 11;
    ps.disposeOnStop = true;
    ps.targetStopDuration = 0.1;
    ps.start();
  }

  private spawnDecal(pos: Vector3) {
    // keep a modest number of turf splats
    if (this.decalCount > 22) return;
    this.decalCount++;
    const disc = MeshBuilder.CreateDisc(
      "splat" + this.decalCount,
      { radius: 0.7 + Math.random() * 0.7, tessellation: 10 },
      this.scene
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(pos.x, 0.06, pos.z);
    const mat = new StandardMaterial("splatm", this.scene);
    mat.diffuseColor = new Color3(0.35, 0.02, 0.02);
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0.85;
    disc.material = mat;
  }

  shockwaveRing(pos: Vector3) {
    const ring = MeshBuilder.CreateTorus(
      "shock",
      { diameter: 2, thickness: 0.5, tessellation: 24 },
      this.scene
    );
    ring.position.set(pos.x, 0.4, pos.z);
    ring.rotation.x = Math.PI / 2;
    const mat = new StandardMaterial("shockm", this.scene);
    mat.emissiveColor = new Color3(1, 0.4, 0.1);
    mat.diffuseColor = new Color3(1, 0.4, 0.1);
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0.9;
    ring.material = mat;
    this.rings.push({ mesh: ring, life: 0, max: 0.5 });
    // spark burst too
    this.debris(pos);
  }

  setFire(entity: RuntimeEntity, mesh: Mesh, on: boolean) {
    const has = this.fires.has(entity.meshId);
    if (on && !has) {
      const ps = new ParticleSystem("fire" + entity.meshId, 80, this.scene);
      ps.particleTexture = this.fireTex;
      ps.emitter = mesh as any;
      ps.minEmitBox = new Vector3(-0.5, -0.8, -0.5);
      ps.maxEmitBox = new Vector3(0.5, 1.0, 0.5);
      ps.color1 = new Color4(1, 0.6, 0.1, 1);
      ps.color2 = new Color4(1, 0.2, 0.0, 1);
      ps.colorDead = new Color4(0.2, 0.0, 0.0, 0);
      ps.minSize = 0.4;
      ps.maxSize = 1.1;
      ps.minLifeTime = 0.2;
      ps.maxLifeTime = 0.45;
      ps.emitRate = 120;
      ps.gravity = new Vector3(0, 6, 0);
      ps.direction1 = new Vector3(-1, 4, -1);
      ps.direction2 = new Vector3(1, 7, 1);
      ps.minEmitPower = 1;
      ps.maxEmitPower = 3;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.start();
      this.fires.set(entity.meshId, ps);
    } else if (!on && has) {
      const ps = this.fires.get(entity.meshId)!;
      ps.stop();
      ps.dispose();
      this.fires.delete(entity.meshId);
    }
  }

  update(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const t = r.life / r.max;
      const s = 1 + t * 9;
      r.mesh.scaling.set(s, s, 1);
      const mat = r.mesh.material as StandardMaterial;
      mat.alpha = Math.max(0, 0.9 * (1 - t));
      if (r.life >= r.max) {
        r.mesh.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  reset() {
    for (const ps of this.fires.values()) {
      ps.stop();
      ps.dispose();
    }
    this.fires.clear();
  }
}
