// ============================================================================
// PlayerModelFactory.ts — builds a chunky low-poly arcade football player out
// of Babylon primitives (no external assets). Returns a PlayerModel whose part
// references the PlayerSystem animates procedurally (arms/legs swing, lean,
// helmet bob, slump on tackle).
//
// Arcade proportions on purpose: big helmet, wide shoulder pads, fat torso,
// short thick legs. Reads like a football player, not a capsule.
// ============================================================================
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface PlayerModel {
  root: TransformNode;
  torso: Mesh; // main body + fire emitter anchor
  helmet: Mesh;
  lHip: TransformNode; // leg swing pivots
  rHip: TransformNode;
  lSh: TransformNode; // arm swing pivots
  rSh: TransformNode;
  ring: Mesh; // selection ring on the turf
  arrow: Mesh; // floating arcade indicator above the player
  helmetBaseY: number;
  bob: number; // animation phase accumulator
}

// part heights (local Y, root sits on the ground at y=0)
const HIP_Y = 1.0;
const TORSO_Y = 1.7;
const PADS_Y = 2.15;
const SH_Y = 2.05;
const HELMET_Y = 2.85;

let UID = 0;

function mat(scene: Scene, c: Color3, opts: { emissive?: boolean; spec?: number } = {}): StandardMaterial {
  const m = new StandardMaterial("plm" + UID++, scene);
  m.diffuseColor = c;
  const s = opts.spec ?? 0.05;
  m.specularColor = new Color3(s, s, s);
  if (opts.emissive) m.emissiveColor = c.scale(0.4);
  return m;
}

function clampColor(c: Color3): Color3 {
  return new Color3(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));
}

export function createFootballPlayer(
  scene: Scene,
  jersey: Color3,
  pants: Color3,
  helmetColor: Color3
): PlayerModel {
  const id = UID++;
  const root = new TransformNode("ftp" + id, scene);

  const jerseyMat = mat(scene, jersey);
  const padMat = mat(scene, clampColor(jersey.scale(1.2)));
  const armMat = mat(scene, jersey.scale(0.82));
  const pantsMat = mat(scene, pants);
  const helmetMat = mat(scene, helmetColor, { spec: 0.3 });
  const darkMat = mat(scene, new Color3(0.08, 0.08, 0.09));
  const skinMat = mat(scene, new Color3(0.78, 0.58, 0.44));
  const maskMat = mat(scene, new Color3(0.72, 0.73, 0.76), { spec: 0.4 });

  // ---- shadow ----
  const shadow = MeshBuilder.CreateDisc("sh" + id, { radius: 1.25, tessellation: 16 }, scene);
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.04;
  const shMat = mat(scene, new Color3(0, 0, 0));
  shMat.disableLighting = true;
  shMat.alpha = 0.34;
  shadow.material = shMat;
  shadow.parent = root;

  // ---- legs (swing from hips) ----
  const makeLeg = (side: number): TransformNode => {
    const hip = new TransformNode("hip" + id + side, scene);
    hip.parent = root;
    hip.position.set(0.34 * side, HIP_Y, 0);
    const leg = MeshBuilder.CreateCylinder("leg" + id + side, { height: 1.0, diameter: 0.52, tessellation: 8 }, scene);
    leg.material = pantsMat;
    leg.parent = hip;
    leg.position.y = -0.5; // foot hangs below the hip pivot
    const cleat = MeshBuilder.CreateBox("cleat" + id + side, { width: 0.5, height: 0.22, depth: 0.8 }, scene);
    cleat.material = darkMat;
    cleat.parent = hip;
    cleat.position.set(0, -1.0, 0.15);
    return hip;
  };
  const lHip = makeLeg(-1);
  const rHip = makeLeg(1);

  // ---- torso (jersey) ----
  const torso = MeshBuilder.CreateBox("torso" + id, { width: 1.35, height: 1.2, depth: 0.85 }, scene);
  torso.material = jerseyMat;
  torso.parent = root;
  torso.position.y = TORSO_Y;

  // ---- shoulder pads (wide, the arcade signature) ----
  const pads = MeshBuilder.CreateBox("pads" + id, { width: 2.0, height: 0.55, depth: 1.05 }, scene);
  pads.material = padMat;
  pads.parent = root;
  pads.position.y = PADS_Y;

  // ---- arms (swing from shoulders) ----
  const makeArm = (side: number): TransformNode => {
    const sh = new TransformNode("sh" + id + side, scene);
    sh.parent = root;
    sh.position.set(1.02 * side, SH_Y, 0);
    const arm = MeshBuilder.CreateCylinder("arm" + id + side, { height: 1.05, diameter: 0.44, tessellation: 8 }, scene);
    arm.material = armMat;
    arm.parent = sh;
    arm.position.y = -0.5;
    const hand = MeshBuilder.CreateSphere("hand" + id + side, { diameter: 0.42, segments: 6 }, scene);
    hand.material = skinMat;
    hand.parent = sh;
    hand.position.y = -1.05;
    return sh;
  };
  const lSh = makeArm(-1);
  const rSh = makeArm(1);

  // ---- neck + helmet ----
  const neck = MeshBuilder.CreateCylinder("neck" + id, { height: 0.3, diameter: 0.42, tessellation: 8 }, scene);
  neck.material = skinMat;
  neck.parent = root;
  neck.position.y = 2.5;

  const helmet = MeshBuilder.CreateSphere("hel" + id, { diameter: 1.1, segments: 10 }, scene);
  helmet.material = helmetMat;
  helmet.parent = root;
  helmet.position.y = HELMET_Y;

  // facemask (a couple of thin bars at the front of the helmet)
  const maskH = MeshBuilder.CreateBox("maskH" + id, { width: 0.62, height: 0.08, depth: 0.18 }, scene);
  maskH.material = maskMat;
  maskH.parent = helmet;
  maskH.position.set(0, -0.12, 0.52);
  const maskV = MeshBuilder.CreateBox("maskV" + id, { width: 0.08, height: 0.34, depth: 0.16 }, scene);
  maskV.material = maskMat;
  maskV.parent = helmet;
  maskV.position.set(0, -0.02, 0.54);

  // ---- turf selection ring ----
  const ring = MeshBuilder.CreateTorus("ring" + id, { diameter: 2.5, thickness: 0.16, tessellation: 24 }, scene);
  const ringMat = mat(scene, new Color3(1, 0.85, 0.2));
  ringMat.emissiveColor = new Color3(1, 0.85, 0.2);
  ringMat.disableLighting = true;
  ring.material = ringMat;
  ring.parent = root;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  ring.setEnabled(false);

  // ---- floating arcade arrow ----
  const arrow = MeshBuilder.CreateCylinder("arr" + id, { height: 1.0, diameterTop: 0, diameterBottom: 0.95, tessellation: 4 }, scene);
  const arrMat = mat(scene, new Color3(1, 0.85, 0.2));
  arrMat.emissiveColor = new Color3(1, 0.85, 0.2);
  arrMat.disableLighting = true;
  arrow.material = arrMat;
  arrow.parent = root;
  arrow.rotation.x = Math.PI; // apex points down at the player
  arrow.position.y = 4.2;
  arrow.setEnabled(false);

  return { root, torso, helmet, lHip, rHip, lSh, rSh, ring, arrow, helmetBaseY: HELMET_Y, bob: 0 };
}
