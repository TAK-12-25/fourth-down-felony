// ============================================================================
// CameraSystem.ts — angled arcade chase cam. Follows focus point, shakes on
// big hits, punches (quick zoom) on throws. Not a flat overhead cam.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CAMERA } from "../config";

export class CameraSystem {
  cam: UniversalCamera;
  private focus = new Vector3(0, 1, 20);
  private shake = 0;
  private punch = 0;

  constructor(scene: Scene) {
    this.cam = new UniversalCamera("arcadeCam", new Vector3(0, CAMERA.HEIGHT, -CAMERA.BACK), scene);
    this.cam.fov = CAMERA.FOV;
    this.cam.minZ = 0.1;
    this.cam.maxZ = 400;
    this.cam.inputs.clear(); // fully script-driven
  }

  setFocusImmediate(x: number, z: number) {
    this.focus.set(x, 1, z);
    this.cam.position.set(x, CAMERA.HEIGHT, z - CAMERA.BACK);
    this.cam.setTarget(new Vector3(x, 1, z + CAMERA.LOOK_AHEAD));
  }

  addShake(amount: number) { this.shake = Math.min(1.4, this.shake + amount); }
  addPunch(amount: number) { this.punch = Math.min(1, this.punch + amount); }

  update(dt: number, targetX: number, targetZ: number) {
    // smooth the focus toward the action
    const k = 1 - Math.exp(-CAMERA.FOLLOW_LERP * dt);
    this.focus.x += (targetX - this.focus.x) * k;
    this.focus.z += (targetZ - this.focus.z) * k;

    // punch pulls camera in slightly (quick zoom), then relaxes
    const back = CAMERA.BACK - this.punch * 6;
    const height = CAMERA.HEIGHT - this.punch * 2;

    let sx = 0, sy = 0;
    if (this.shake > 0.001) {
      const mag = this.shake * 1.6;
      sx = (Math.random() * 2 - 1) * mag;
      sy = (Math.random() * 2 - 1) * mag;
    }

    this.cam.position.set(this.focus.x + sx, height + sy, this.focus.z - back);
    this.cam.setTarget(new Vector3(this.focus.x, 1.2, this.focus.z + CAMERA.LOOK_AHEAD));

    this.shake = Math.max(0, this.shake - CAMERA.SHAKE_DECAY * dt * this.shake - 0.01 * dt);
    if (this.shake < 0.002) this.shake = 0;
    this.punch = Math.max(0, this.punch - 3 * dt);
  }
}
