// ============================================================================
// GameScene.ts — owns the Babylon Scene, builds the 3D field + lighting, wires
// every system together, and runs the gameplay loop (presnap → live → deadball
// → score → gameover). This is the orchestrator.
// ============================================================================
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import { FIELD, PLAYER, RULES, TURBO, MAYHEM } from "../config";
import { TEAMS, HUMAN_TEAM, CPU_TEAM } from "../data/teams";
import { getOffensivePlay, OFFENSIVE_PLAYS } from "../data/plays";
import { DIFFICULTIES } from "../data/difficulty";
import type { Difficulty, RuntimeEntity, BallState } from "../types/gameTypes";
import type { GameContext } from "../GameContext";

import { AudioSystem } from "../systems/AudioSystem";
import { InputSystem } from "../systems/InputSystem";
import { EffectsSystem } from "../systems/EffectsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { HudSystem } from "../systems/HudSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { RouteSystem } from "../systems/RouteSystem";
import { PlaybookSystem } from "../systems/PlaybookSystem";
import { TargetingSystem } from "../systems/TargetingSystem";
import { PassingSystem } from "../systems/PassingSystem";
import { CpuAiSystem } from "../systems/CpuAiSystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { TackleSystem } from "../systems/TackleSystem";
import { HeatSystem } from "../systems/HeatSystem";
import { MayhemSystem } from "../systems/MayhemSystem";
import { WantedSystem } from "../systems/WantedSystem";

type PendingKind = "tackle" | "incomplete" | "touchdown" | "turnover" | "oob";

export class GameScene {
  scene: Scene;
  private ctx: GameContext;
  private paused = false;
  private thrown = false;
  private pendingSpotZ = 0;
  private pendingKind: PendingKind = "tackle";

  // systems
  private effects: EffectsSystem;
  private cameraSys: CameraSystem;
  private hud: HudSystem;
  private input: InputSystem;
  private players: PlayerSystem;
  private route: RouteSystem;
  private playbook: PlaybookSystem;
  private targeting: TargetingSystem;
  private passing: PassingSystem;
  private cpu: CpuAiSystem;
  private collision: CollisionSystem;
  private tackle: TackleSystem;
  private heat: HeatSystem;
  private mayhem: MayhemSystem;
  private wanted: WantedSystem;

  private losMarker!: Mesh;
  private firstDownMarker!: Mesh;
  onGameOver: ((summary: string) => void) | null = null;

  constructor(engine: Engine, audio: AudioSystem, hudRoot: HTMLElement, difficulty: Difficulty) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.03, 0.05, 0.06, 1);

    this.buildLights();
    this.buildField();

    // services
    this.effects = new EffectsSystem(this.scene);
    this.cameraSys = new CameraSystem(this.scene);
    this.scene.activeCamera = this.cameraSys.cam;
    this.hud = new HudSystem(hudRoot);
    this.input = new InputSystem();
    this.input.attach();
    this.input.onPause = () => this.togglePause();

    // logic systems
    this.players = new PlayerSystem(this.scene);
    this.route = new RouteSystem(this.scene);
    this.playbook = new PlaybookSystem();
    this.targeting = new TargetingSystem();
    this.passing = new PassingSystem(this.scene);
    this.cpu = new CpuAiSystem();
    this.collision = new CollisionSystem();
    this.tackle = new TackleSystem(this.players);
    this.heat = new HeatSystem(this.players);
    this.mayhem = new MayhemSystem(this.players);
    this.wanted = new WantedSystem();

    const ball: BallState = {
      pos: new Vector3(0, PLAYER.Y, 20),
      vel: new Vector3(0, 0, 0),
      inAir: false,
      carrierId: null,
      targetId: null,
      height: 0,
      accuracy: 1,
      glow: false,
    };

    this.ctx = {
      scene: this.scene,
      effects: this.effects,
      hud: this.hud,
      camera: this.cameraSys,
      audio,
      input: this.input,
      offenseTeamId: HUMAN_TEAM,
      defenseTeamId: CPU_TEAM,
      humanTeamId: HUMAN_TEAM,
      humanIsOffense: true,
      entities: [],
      ball,
      controlledId: "",
      phase: "presnap",
      deadballTimer: 0,
      snapTimer: 0,
      message: "",
      losZ: 20,
      firstDownZ: 30,
      down: 1,
      toGo: 10,
      playStartZ: 20,
      offensePlayId: OFFENSIVE_PLAYS[0].id,
      defensePlayId: "bloodZone",
      playIndex: 0,
      score: { [TEAMS.cannons.id]: 0, [TEAMS.crushers.id]: 0 },
      clock: RULES.QUARTER_SECONDS,
      turbo: TURBO.MAX,
      mayhem: 0,
      wanted: 0,
      mayhemReady: false,
      prophecyArmed: false,
      diff: DIFFICULTIES[difficulty],
      rng: Math.random,
      ent: (id: string) => this.ctx.entities.find((e) => e.data.id === id),
    };

    this.players.spawn(this.ctx);
    this.newSeries(20);
    this.hud.toast("FOURTH DOWN FELONY", "#ffd23f", "Cycle plays, then ENTER to snap");
  }

  // -------------------------------------------------------------------------
  private buildLights() {
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.05, 0.06, 0.07);
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, 0.3), this.scene);
    dir.intensity = 0.8;
    dir.position = new Vector3(20, 40, -10);
  }

  private mat(name: string, r: number, g: number, b: number, emissive = false): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    if (emissive) m.emissiveColor = new Color3(r, g, b);
    m.diffuseColor = new Color3(r, g, b);
    m.specularColor = new Color3(0, 0, 0);
    return m;
  }

  private buildField() {
    const totalLen = FIELD.LEN + FIELD.EZ * 2;
    const fieldCenterZ = FIELD.LEN / 2;

    // turf
    const turf = MeshBuilder.CreateGround(
      "turf",
      { width: FIELD.HALF_W * 2 + 6, height: totalLen + 6 },
      this.scene
    );
    turf.position.set(0, 0, fieldCenterZ);
    turf.material = this.mat("turfm", 0.07, 0.16, 0.09);

    // playable field tint
    const field = MeshBuilder.CreateGround("field", { width: FIELD.HALF_W * 2, height: totalLen }, this.scene);
    field.position.set(0, 0.01, fieldCenterZ);
    field.material = this.mat("fieldm", 0.09, 0.22, 0.12);

    // end zones
    const ezNear = MeshBuilder.CreateGround("ezN", { width: FIELD.HALF_W * 2, height: FIELD.EZ }, this.scene);
    ezNear.position.set(0, 0.02, -FIELD.EZ / 2);
    ezNear.material = this.mat("ezNm", 0.18, 0.05, 0.05);
    const ezFar = MeshBuilder.CreateGround("ezF", { width: FIELD.HALF_W * 2, height: FIELD.EZ }, this.scene);
    ezFar.position.set(0, 0.02, FIELD.LEN + FIELD.EZ / 2);
    ezFar.material = this.mat("ezFm", 0.05, 0.1, 0.22);

    // yard lines every 10 + goal lines
    const lineMat = this.mat("linem", 0.85, 0.88, 0.9, true);
    for (let z = 0; z <= FIELD.LEN; z += 10) {
      const bright = z === 0 || z === FIELD.LEN;
      const line = MeshBuilder.CreateBox("yl" + z, { width: FIELD.HALF_W * 2, height: 0.02, depth: bright ? 0.5 : 0.28 }, this.scene);
      line.position.set(0, 0.04, z);
      line.material = lineMat;
      // hash marks
      const h1 = MeshBuilder.CreateBox("h" + z, { width: 0.6, height: 0.02, depth: 0.18 }, this.scene);
      h1.position.set(-3, 0.045, z);
      h1.material = lineMat;
      const h2 = h1.clone("h2" + z);
      h2.position.x = 3;
    }

    // sidelines
    const slMat = this.mat("slm", 0.8, 0.82, 0.85, true);
    for (const sx of [-FIELD.HALF_W, FIELD.HALF_W]) {
      const sl = MeshBuilder.CreateBox("sl" + sx, { width: 0.3, height: 0.02, depth: totalLen }, this.scene);
      sl.position.set(sx, 0.04, fieldCenterZ);
      sl.material = slMat;
    }

    // LOS + first-down markers (repositioned each down)
    this.losMarker = MeshBuilder.CreateBox("los", { width: FIELD.HALF_W * 2, height: 0.03, depth: 0.35 }, this.scene);
    this.losMarker.material = this.mat("losm", 0.2, 0.5, 1, true);
    this.firstDownMarker = MeshBuilder.CreateBox("fd", { width: FIELD.HALF_W * 2, height: 0.03, depth: 0.35 }, this.scene);
    this.firstDownMarker.material = this.mat("fdm", 1, 0.82, 0.1, true);
  }

  private placeMarkers() {
    this.losMarker.position.set(0, 0.06, this.ctx.losZ);
    const fd = Math.min(this.ctx.firstDownZ, FIELD.LEN);
    this.firstDownMarker.position.set(0, 0.06, fd);
    this.firstDownMarker.setEnabled(this.ctx.firstDownZ <= FIELD.LEN);
  }

  // -------------------------------------------------------------------------
  // Drive / down flow
  // -------------------------------------------------------------------------
  private newSeries(z: number) {
    this.ctx.losZ = Math.max(3, Math.min(FIELD.LEN - 1, z));
    this.ctx.down = 1;
    this.ctx.firstDownZ = Math.min(this.ctx.losZ + RULES.FIRST_DOWN_YDS, FIELD.LEN);
    this.ctx.toGo = this.ctx.firstDownZ - this.ctx.losZ;
    this.preSnapSetup();
  }

  private nextPlay(spotZ: number) {
    this.ctx.losZ = Math.max(2, Math.min(FIELD.LEN - 1, spotZ));
    this.preSnapSetup();
  }

  private preSnapSetup() {
    const ctx = this.ctx;
    ctx.phase = "presnap";
    ctx.snapTimer = 0;
    this.thrown = false;
    ctx.ball.inAir = false;
    ctx.ball.carrierId = null;
    ctx.ball.targetId = null;
    this.passing.hideBall();

    // reset heat at the start of each play (clean slate)
    for (const e of ctx.entities) { e.onFire = false; e.fireTimer = 0; e.invulnTimer = 0; e.armCooldown = 0; }
    this.effects.reset();

    ctx.defensePlayId = this.playbook.pickCpuDefense(ctx);
    this.players.positionFormation(ctx);
    this.route.buildRouteArt(ctx);
    this.hud.setPlayCard(ctx.offensePlayId);
    this.placeMarkers();

    const qb = ctx.entities.find((e) => e.side === "offense" && e.role === "QB");
    if (qb) {
      ctx.controlledId = qb.data.id;
      for (const e of ctx.entities) e.isHuman = false;
      qb.isHuman = true;
      this.cameraSys.setFocusImmediate(qb.pos.x, qb.pos.z);
    }
    this.players.syncMeshes(ctx, 0, true);
  }

  private snap() {
    const ctx = this.ctx;
    const qb = ctx.entities.find((e) => e.side === "offense" && e.role === "QB");
    if (!qb) return;
    ctx.phase = "live";
    ctx.snapTimer = 0;
    ctx.playStartZ = ctx.losZ;
    this.route.clear();
    this.passing.giveBall(ctx, qb);
    ctx.controlledId = qb.data.id;
    this.cpu.assignCoverage(ctx);
    ctx.audio.snap();
  }

  private concludePlay(spotZ: number, kind: PendingKind) {
    this.pendingSpotZ = spotZ;
    this.pendingKind = kind;
    this.ctx.phase = "deadball";
    this.ctx.deadballTimer = 1.3;
    if (kind !== "touchdown") this.ctx.audio.whistle();
  }

  private resolveDeadball() {
    const ctx = this.ctx;
    const spot = this.pendingSpotZ;

    if (this.pendingKind === "touchdown") {
      ctx.score[ctx.offenseTeamId] += RULES.TD_POINTS;
      if (this.checkGameOver()) return;
      this.newSeries(20);
      return;
    }
    if (this.pendingKind === "turnover") {
      this.hud.toast("TURNOVER", "#ff3b30", "Cannons ball");
      this.newSeries(20);
      return;
    }

    // tackle / incomplete / oob → advance down & distance
    const gain = spot - ctx.losZ;
    if (this.pendingKind !== "incomplete" && spot >= ctx.firstDownZ) {
      ctx.down = 1;
      ctx.firstDownZ = Math.min(spot + RULES.FIRST_DOWN_YDS, FIELD.LEN);
      ctx.toGo = ctx.firstDownZ - spot;
      this.hud.toast("FIRST DOWN", "#6fd0ff");
      this.nextPlay(spot);
    } else {
      ctx.down += 1;
      ctx.toGo = ctx.firstDownZ - spot;
      if (ctx.down > RULES.DOWNS) {
        this.hud.toast("TURNOVER ON DOWNS", "#ff3b30");
        this.newSeries(20);
      } else {
        this.nextPlay(spot);
      }
    }
    void gain;
  }

  private checkGameOver(): boolean {
    const ctx = this.ctx;
    const top = Math.max(ctx.score[TEAMS.cannons.id], ctx.score[TEAMS.crushers.id]);
    if (top >= RULES.TARGET_SCORE || ctx.clock <= 0) {
      ctx.phase = "gameover";
      const c = ctx.score[TEAMS.cannons.id];
      const k = ctx.score[TEAMS.crushers.id];
      const won = c >= k;
      this.hud.toast(won ? "CANNONS WIN" : "CRUSHERS WIN", won ? "#6fd0ff" : "#ff3b30", `${c} - ${k}`);
      setTimeout(() => this.onGameOver?.(`${c} - ${k}`), 2600);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------
  update(dtRaw: number) {
    if (this.paused) { this.input.endFrame(); return; }
    const dt = Math.min(dtRaw, 0.05); // clamp big frame gaps
    const ctx = this.ctx;

    switch (ctx.phase) {
      case "presnap": this.updatePresnap(dt); break;
      case "live": this.updateLive(dt); break;
      case "deadball":
        ctx.deadballTimer -= dt;
        this.players.integrate(ctx, dt);
        this.collision.update(ctx);
        this.players.syncMeshes(ctx, dt);
        this.followCamera(dt);
        if (ctx.deadballTimer <= 0) this.resolveDeadball();
        break;
      case "gameover": break;
    }

    this.effects.update(dt);
    this.hud.update(ctx);
    this.input.endFrame();
  }

  private updatePresnap(dt: number) {
    const ctx = this.ctx;
    if (this.input.pressed("cyclePrev")) { this.playbook.cycleOffense(ctx, -1); this.afterCycle(); }
    if (this.input.pressed("cycleNext")) { this.playbook.cycleOffense(ctx, 1); this.afterCycle(); }
    if (this.input.pressed("snap")) { this.snap(); return; }

    // live target preview while aiming pre-snap
    const tr = this.targeting.compute(ctx);
    this.showTarget(tr);
    this.players.syncMeshes(ctx, dt, true);
    this.followCamera(dt);
  }

  private afterCycle() {
    this.ctx.audio.ui();
    this.players.positionFormation(this.ctx);
    this.route.buildRouteArt(this.ctx);
    this.hud.setPlayCard(this.ctx.offensePlayId);
    this.placeMarkers();
  }

  private updateLive(dt: number) {
    const ctx = this.ctx;
    ctx.snapTimer += dt;
    ctx.clock = Math.max(0, ctx.clock - dt);
    if (ctx.clock <= 0) { this.checkGameOver(); return; }

    // ---- human control ----
    this.controlHuman(dt);

    // ---- receivers run routes (offense AI for non-controlled) ----
    for (const e of ctx.entities) {
      if (e.side !== "offense" || e.isHuman || e.stunTimer > 0) continue;
      const speed = PLAYER.MAX_SPEED * (e.data.speed / 100) * this.heat.speedMult(e);
      if (e.role === "BLOCK") {
        // blockers slide forward into the rush lane
        const tgt = this.nearestDefender(e);
        if (tgt) this.steer(e, tgt.pos.x, tgt.pos.z, speed * 0.8);
        else this.steer(e, e.pos.x, e.pos.z + 3, speed * 0.5);
      } else {
        const dir = this.route.desiredDir(e, ctx);
        if (dir) this.steer(e, e.pos.x + dir.x * 5, e.pos.z + dir.z * 5, speed);
        else e.vel.scaleInPlace(0.8);
      }
    }

    // ---- defense AI ----
    this.cpu.updateDefense(ctx, dt);

    // ---- physics ----
    this.players.integrate(ctx, dt);
    this.collision.update(ctx);

    // decay action timers
    for (const e of ctx.entities) {
      if (e.invulnTimer > 0) e.invulnTimer -= dt;
      if (e.armCooldown > 0) e.armCooldown -= dt;
    }

    // ---- ball ----
    const outcome = this.passing.update(ctx, dt);
    this.handlePassOutcome(outcome);

    // ---- tackle ----
    if (ctx.ball.carrierId) {
      const carrier = ctx.ent(ctx.ball.carrierId)!;
      // touchdown check first
      if (carrier.side === "offense" && carrier.pos.z >= FIELD.GOAL_Z) {
        this.scoreTouchdown(carrier);
      } else {
        const res = this.tackle.resolveContacts(ctx, false);
        if (res.ended) this.onTackle(res.carrierId!, res.bigHit, carrier.pos.z);
      }
    }

    // ---- heat / wanted upkeep ----
    this.heat.update(ctx, dt);
    this.wanted.update(ctx, dt);

    // ---- camera + target label ----
    this.followCamera(dt);
    if (!ctx.ball.inAir && ctx.ball.carrierId && this.isQbCarrier()) {
      const tr = this.targeting.compute(ctx);
      this.showTarget(tr);
    } else {
      this.hud.hideTargetLabel();
    }

    this.players.syncMeshes(ctx, dt);
  }

  private controlHuman(dt: number) {
    const ctx = this.ctx;
    const hero = ctx.ent(ctx.controlledId);
    if (!hero || hero.stunTimer > 0) return;

    const mv = this.input.moveVector();
    let speed = PLAYER.MAX_SPEED * (hero.data.speed / 100) * this.heat.speedMult(hero);

    // turbo
    if (this.input.held("turbo") && ctx.turbo > 0 && (mv.x !== 0 || mv.z !== 0)) {
      speed *= PLAYER.TURBO_MULT;
      ctx.turbo = Math.max(0, ctx.turbo - TURBO.DRAIN * dt);
    } else {
      ctx.turbo = Math.min(TURBO.MAX, ctx.turbo + TURBO.REGEN * dt);
    }

    if (mv.x !== 0 || mv.z !== 0) hero.vel.set(mv.x * speed, 0, mv.z * speed);
    else hero.vel.set(0, 0, 0);

    const qbHasBall = this.isQbCarrier();

    // primary: throw (QB) — tackling only matters when on defense (future)
    if (this.input.pressed("primary") && qbHasBall && !ctx.ball.inAir && !this.thrown) {
      const tr = this.targeting.compute(ctx);
      if (tr.receiver) {
        this.passing.throwTo(ctx, tr.receiver, hero);
        this.thrown = true;
        ctx.audio.throwBall();
        this.cameraSys.addPunch(0.7);
        this.hud.hideTargetLabel();
      }
    }

    // carrier moves (after catch or QB scramble)
    const isCarrier = ctx.ball.carrierId === hero.data.id;
    if (isCarrier) {
      if (this.input.pressed("secondary")) {
        if (this.tackle.hurdle(ctx, hero)) {
          this.mayhem.add(ctx, MAYHEM.GAIN_HURDLE);
          this.hud.toast("HURDLE", "#6fd0ff");
        }
      }
      if (this.input.pressed("dirty")) {
        if (this.tackle.stiffArm(ctx, hero)) {
          this.mayhem.add(ctx, MAYHEM.GAIN_STIFF);
          this.wanted.add(ctx, 4);
          this.hud.toast("STIFF ARM", "#ff8a1f");
        }
      }
    }

    // special
    if (this.input.pressed("special")) {
      if (this.mayhem.activateSpecial(ctx)) this.cameraSys.addPunch(0.4);
    }
    // taunt
    if (this.input.pressed("taunt")) {
      this.wanted.taunt(ctx);
      this.mayhem.add(ctx, 4);
      this.hud.toast("TALKIN' TRASH", "#ffd23f");
    }
  }

  private handlePassOutcome(outcome: ReturnType<PassingSystem["update"]>) {
    const ctx = this.ctx;
    if (outcome.type === "complete") {
      const r = outcome.receiver;
      this.hud.toast("COMPLETE", "#16a34a");
      ctx.audio.catchBall();
      // control switches to the receiver
      for (const e of ctx.entities) e.isHuman = false;
      r.isHuman = true;
      ctx.controlledId = r.data.id;
    } else if (outcome.type === "incomplete") {
      this.hud.toast("INCOMPLETE", "#cccccc");
      ctx.audio.incomplete();
      this.concludePlay(ctx.losZ, "incomplete");
    } else if (outcome.type === "intercept") {
      this.hud.toast("PICKED OFF", "#ff3b30");
      ctx.audio.pickoff();
      this.cameraSys.addShake(0.6);
      this.heat.ignite(ctx, outcome.defender);
      this.concludePlay(ctx.losZ, "turnover");
    }
  }

  private onTackle(carrierId: string, big: boolean, spotZ: number) {
    const ctx = this.ctx;
    const carrier = ctx.ent(carrierId);
    if (big) this.hud.toast("BIG HIT", "#ff3b30", "BLOOD HIT");
    else this.hud.toast("TACKLE", "#ffffff");
    // sack? (QB tackled behind LOS)
    if (carrier && carrier.role === "QB" && spotZ < ctx.losZ) {
      this.hud.toast("SACK", "#ff3b30");
    }
    // long play heat for the human ball carrier
    const gain = spotZ - ctx.playStartZ;
    if (carrier && carrier.side === "offense" && gain >= 20) {
      this.heat.ignite(ctx, carrier);
      this.mayhem.add(ctx, MAYHEM.GAIN_LONG);
    }
    this.concludePlay(Math.max(spotZ, -FIELD.EZ), "tackle");
  }

  private scoreTouchdown(carrier: RuntimeEntity) {
    const ctx = this.ctx;
    if (ctx.phase !== "live") return;
    carrier.state = "celebrate";
    carrier.vel.setAll(0);
    this.hud.toast("TOUCHDOWN", "#ffd23f");
    this.hud.doFlash(0.3);
    ctx.audio.touchdown();
    this.cameraSys.addShake(0.5);
    this.heat.ignite(ctx, carrier);
    this.mayhem.add(ctx, MAYHEM.GAIN_TD);
    this.concludePlay(FIELD.GOAL_Z, "touchdown");
  }

  // -------------------------------------------------------------------------
  private showTarget(tr: ReturnType<TargetingSystem["compute"]>) {
    if (!tr.receiver) { this.hud.hideTargetLabel(); return; }
    this.hud.updateTargetLabel(this.scene, this.cameraSys.cam, tr.receiver.pos, tr.status, tr.isPrimary);
  }

  private isQbCarrier(): boolean {
    const c = this.ctx.ball.carrierId ? this.ctx.ent(this.ctx.ball.carrierId) : null;
    return !!c && c.role === "QB" && c.side === "offense";
  }

  private steer(e: RuntimeEntity, tx: number, tz: number, speed: number) {
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    e.vel.set((dx / d) * speed, 0, (dz / d) * speed);
  }

  private nearestDefender(e: RuntimeEntity): RuntimeEntity | null {
    let best: RuntimeEntity | null = null;
    let bd = 99;
    for (const d of this.ctx.entities) {
      if (d.side !== "defense") continue;
      const dd = Math.hypot(d.pos.x - e.pos.x, d.pos.z - e.pos.z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  private followCamera(dt: number) {
    const ctx = this.ctx;
    let fx = 0, fz = ctx.losZ;
    if (ctx.ball.inAir) { fx = ctx.ball.pos.x; fz = ctx.ball.pos.z; }
    else if (ctx.ball.carrierId) {
      const c = ctx.ent(ctx.ball.carrierId)!;
      fx = c.pos.x; fz = c.pos.z;
    } else {
      const qb = ctx.entities.find((e) => e.side === "offense" && e.role === "QB");
      if (qb) { fx = qb.pos.x; fz = qb.pos.z; }
    }
    this.cameraSys.update(dt, fx, fz);
  }

  private togglePause() {
    if (this.ctx.phase === "gameover" || this.ctx.phase === "menu") return;
    this.paused = !this.paused;
    if (this.paused) this.hud.toast("PAUSED", "#ffffff");
  }

  dispose() {
    this.input.detach();
    this.players.dispose();
    this.effects.reset();
    this.scene.dispose();
  }
}
