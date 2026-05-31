// ============================================================================
// RouteSystem.ts — pre-snap route art (glowing tubes + arrowheads above turf)
// and route-following target direction for receivers during the play.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { getOffensivePlay } from "../data/plays";
import type { GameContext } from "../GameContext";
import type { RuntimeEntity } from "../types/gameTypes";

export class RouteSystem {
  private scene: Scene;
  private art: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  buildRouteArt(ctx: GameContext) {
    this.clear();
    const play = getOffensivePlay(ctx.offensePlayId);
    const los = ctx.losZ;
    for (const a of play.assignments) {
      if (!a.route.length || a.role === "QB") continue;
      const ent = ctx.entities.find((e) => e.side === "offense" && e.slot === a.slot);
      if (!ent) continue;
      const isPrimary = a.slot === play.primarySlot;
      const pts: Vector3[] = [new Vector3(ent.pos.x, 0.35, ent.pos.z)];
      for (const wp of a.route) pts.push(new Vector3(wp.x, 0.35, los + wp.z));

      const tube = MeshBuilder.CreateTube(
        "route" + a.slot,
        { path: pts, radius: isPrimary ? 0.22 : 0.12, tessellation: 6, updatable: false },
        this.scene
      );
      const mat = new StandardMaterial("routem" + a.slot, this.scene);
      const c = isPrimary ? new Color3(1, 0.82, 0.2) : new Color3(0.42, 0.85, 1);
      mat.emissiveColor = c;
      mat.diffuseColor = c;
      mat.specularColor = new Color3(0, 0, 0);
      mat.disableLighting = true;
      tube.material = mat;
      this.art.push(tube);

      // arrowhead cone at the route end, pointing along last segment
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const dir = last.subtract(prev);
      const cone = MeshBuilder.CreateCylinder(
        "arrow" + a.slot,
        { height: 1.2, diameterTop: 0, diameterBottom: isPrimary ? 1.1 : 0.8, tessellation: 8 },
        this.scene
      );
      cone.material = mat;
      cone.position.copyFrom(last);
      cone.rotation.x = Math.PI / 2;
      cone.rotation.y = Math.atan2(dir.x, dir.z);
      this.art.push(cone);
    }
  }

  clear() {
    for (const m of this.art) m.dispose();
    this.art = [];
  }

  /** Desired world-space heading for a receiver running its route. */
  desiredDir(e: RuntimeEntity, ctx: GameContext): { x: number; z: number } | null {
    if (!e.route || !e.route.length) return null;
    const los = ctx.losZ;
    if (e.routeIdx >= e.route.length) {
      // route finished: drift downfield to stay alive
      return { x: 0, z: 1 };
    }
    const wp = e.route[e.routeIdx];
    const tx = wp.x;
    const tz = los + wp.z;
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      e.routeIdx++;
      return this.desiredDir(e, ctx);
    }
    return { x: dx / d, z: dz / d };
  }
}
