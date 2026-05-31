// ============================================================================
// HudSystem.ts — DOM overlay HUD. Scoreboard, meters, play card, big arcade
// toasts, worldspace TARGET label, and the red big-hit screen flash.
// ============================================================================
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { TEAMS } from "../data/teams";
import { getOffensivePlay } from "../data/plays";
import { RULES } from "../config";
import type { GameContext } from "../GameContext";

export class HudSystem {
  private root: HTMLElement;
  private flash: HTMLDivElement;
  private toastWrap: HTMLDivElement;
  private targetLabel: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    const $ = (id: string) => this.root.querySelector<HTMLElement>(id)!;
    this.els = {
      homePts: $("#homePts"), awayPts: $("#awayPts"),
      homeTeam: $(".sb-team.home"), awayTeam: $(".sb-team.away"),
      clock: $("#clock"), dd: $("#dd"),
      turbo: $("#turboBar"), mayhem: $("#mayhemBar"), wanted: $("#wantedBar"),
      mayhemMeter: $("#mayhemMeter"), heat: $("#heat"),
      pcName: $("#pcName"), pcDesc: $("#pcDesc"),
    };
    this.flash = $("#flash") as HTMLDivElement;
    this.toastWrap = $("#toastWrap") as HTMLDivElement;
    this.targetLabel = $("#tgtLabel") as HTMLDivElement;
  }

  private template(): string {
    const home = TEAMS.cannons;
    const away = TEAMS.crushers;
    return `
    <div id="flash" style="position:absolute;inset:0;background:#ff2a2a;opacity:0;pointer-events:none;"></div>
    <div class="scoreboard">
      <div class="sb-team home"><span class="abbr">${home.abbr}</span><span class="pts" id="homePts">0</span></div>
      <div class="sb-mid"><span class="clock" id="clock">2:00</span><span class="dd" id="dd">1ST &amp; 10</span></div>
      <div class="sb-team away"><span class="abbr">${away.abbr}</span><span class="pts" id="awayPts">0</span></div>
    </div>
    <div class="meters">
      <div class="meter"><div class="label"><span>TURBO</span></div><div class="bar turbo"><span id="turboBar"></span></div></div>
      <div class="meter" id="mayhemMeter"><div class="label"><span>MAYHEM</span><span id="heat" class="heat cold">COLD</span></div><div class="bar mayhem"><span id="mayhemBar"></span></div></div>
      <div class="meter"><div class="label"><span>WANTED</span></div><div class="bar wanted"><span id="wantedBar"></span></div></div>
    </div>
    <div class="playcard">
      <div class="pc-head">OFFENSE</div>
      <div class="pc-name" id="pcName">Crossfire</div>
      <div class="pc-desc" id="pcDesc"></div>
      <div class="pc-hint">[ &nbsp;] / [&nbsp;] or 1 / 2 cycle &nbsp;&bull;&nbsp; ENTER snap</div>
    </div>
    <div class="toast-wrap" id="toastWrap"></div>
    <div class="tgt hide" id="tgtLabel"></div>
    `;
  }

  setPlayCard(playId: string) {
    const p = getOffensivePlay(playId);
    this.els.pcName.textContent = p.name;
    this.els.pcDesc.textContent = p.description;
  }

  toast(main: string, color = "#fff", sub?: string) {
    const wrap = this.toastWrap;
    wrap.innerHTML = "";
    const m = document.createElement("div");
    m.className = "toast";
    m.style.color = color;
    m.textContent = main;
    wrap.appendChild(m);
    if (sub) {
      const s = document.createElement("div");
      s.className = "toast sub";
      s.textContent = sub;
      wrap.appendChild(s);
    }
    window.clearTimeout((wrap as any)._t);
    (wrap as any)._t = window.setTimeout(() => (wrap.innerHTML = ""), 1400);
  }

  doFlash(strength = 0.6) {
    this.flash.style.transition = "none";
    this.flash.style.opacity = String(strength);
    requestAnimationFrame(() => {
      this.flash.style.transition = "opacity 0.4s ease-out";
      this.flash.style.opacity = "0";
    });
  }

  private clockText(s: number): string {
    const mm = Math.floor(Math.max(0, s) / 60);
    const ss = Math.floor(Math.max(0, s) % 60);
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  }

  private ordinal(n: number): string {
    return ["1ST", "2ND", "3RD", "4TH"][n - 1] ?? `${n}TH`;
  }

  update(ctx: GameContext) {
    this.els.homePts.textContent = String(ctx.score[TEAMS.cannons.id] ?? 0);
    this.els.awayPts.textContent = String(ctx.score[TEAMS.crushers.id] ?? 0);
    this.els.clock.textContent = this.clockText(ctx.clock);

    const yardsToGoal = RULES.FIRST_DOWN_YDS;
    const toGoTxt = ctx.toGo <= 0 ? "GOAL" : Math.ceil(ctx.toGo).toString();
    this.els.dd.textContent = `${this.ordinal(ctx.down)} & ${toGoTxt}`;
    void yardsToGoal;

    // possession highlight
    this.els.homeTeam.classList.toggle("poss", ctx.offenseTeamId === TEAMS.cannons.id);
    this.els.awayTeam.classList.toggle("poss", ctx.offenseTeamId === TEAMS.crushers.id);

    (this.els.turbo.style as any).width = `${ctx.turbo}%`;
    (this.els.mayhem.style as any).width = `${ctx.mayhem}%`;
    (this.els.wanted.style as any).width = `${ctx.wanted}%`;
    this.els.mayhemMeter.classList.toggle("ready", ctx.mayhemReady);

    const human = ctx.ent(ctx.controlledId);
    const onFire = !!human?.onFire;
    this.els.heat.textContent = onFire ? "ON FIRE" : ctx.mayhemReady ? "MAYHEM READY" : "COLD";
    this.els.heat.classList.toggle("cold", !onFire && !ctx.mayhemReady);
  }

  /** Position the worldspace TARGET label above a receiver. */
  updateTargetLabel(
    scene: Scene,
    cam: Camera,
    world: Vector3 | null,
    status: "OPEN" | "TIGHT" | "COVERED",
    primary: boolean
  ) {
    if (!world) {
      this.targetLabel.classList.add("hide");
      return;
    }
    const engine = scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const p = Vector3.Project(
      new Vector3(world.x, world.y + 2.4, world.z),
      Matrix.Identity(),
      scene.getTransformMatrix(),
      cam.viewport.toGlobal(w, h)
    );
    if (p.z < 0 || p.z > 1) {
      this.targetLabel.classList.add("hide");
      return;
    }
    // scale from render pixels back to CSS pixels
    const rect = engine.getRenderingCanvasClientRect();
    const sx = rect ? rect.width / w : 1;
    const sy = rect ? rect.height / h : 1;
    this.targetLabel.classList.remove("hide");
    this.targetLabel.className = `tgt ${status}`;
    this.targetLabel.style.left = `${p.x * sx}px`;
    this.targetLabel.style.top = `${p.y * sy}px`;
    this.targetLabel.innerHTML = primary
      ? `<span class="pri">PRIMARY</span> &middot; ${status}`
      : `TARGET &middot; ${status}`;
  }

  hideTargetLabel() { this.targetLabel.classList.add("hide"); }
}
