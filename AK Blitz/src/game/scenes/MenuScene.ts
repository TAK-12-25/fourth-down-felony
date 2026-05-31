// ============================================================================
// MenuScene.ts — title screen. Pick difficulty, read the controls, hit START.
// Renders into the HUD overlay div; tears itself down on start.
// ============================================================================
import type { Difficulty } from "../types/gameTypes";
import type { AudioSystem } from "../systems/AudioSystem";
import { TEAMS } from "../data/teams";

export class MenuScene {
  private root: HTMLElement;
  private audio: AudioSystem;
  private onStart: (d: Difficulty) => void;
  private diff: Difficulty = "pro";

  constructor(root: HTMLElement, audio: AudioSystem, onStart: (d: Difficulty) => void) {
    this.root = root;
    this.audio = audio;
    this.onStart = onStart;
    this.render();
  }

  private render() {
    const home = TEAMS.cannons;
    const away = TEAMS.crushers;
    this.root.innerHTML = `
      <div class="screen" id="menuScreen">
        <h1>FOURTH DOWN <span class="b">FELONY</span></h1>
        <div class="tag">3D ARCADE FOOTBALL &bull; VERTICAL SLICE</div>
        <div class="matchup">${home.name}<span class="vs">VS</span>${away.name}</div>
        <div class="diffrow" id="diffRow">
          <button class="diffbtn" data-d="rookie">ROOKIE</button>
          <button class="diffbtn sel" data-d="pro">PRO</button>
          <button class="diffbtn" data-d="psycho">PSYCHO</button>
        </div>
        <button class="startbtn" id="startBtn">START</button>
        <div class="controls">
          <b>WASD</b> move / aim &bull; <b>Shift</b> turbo &bull; <b>Enter</b> snap &bull;
          <b>Space</b> pass &bull; <b>E</b> hurdle &bull; <b>Q</b> stiff-arm &bull;
          <b>R</b> special (Mayhem) &bull; <b>T</b> taunt &bull; <b>[ ]</b> or <b>1 / 2</b> cycle plays &bull; <b>P</b> pause
        </div>
      </div>
    `;

    const row = this.root.querySelector<HTMLElement>("#diffRow")!;
    row.querySelectorAll<HTMLButtonElement>(".diffbtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.audio.resume();
        this.audio.ui();
        this.diff = btn.dataset.d as Difficulty;
        row.querySelectorAll(".diffbtn").forEach((b) => b.classList.remove("sel"));
        btn.classList.add("sel");
      });
    });

    this.root.querySelector<HTMLButtonElement>("#startBtn")!.addEventListener("click", () => {
      this.audio.resume();
      this.audio.ui();
      this.destroy();
      this.onStart(this.diff);
    });
  }

  destroy() {
    this.root.innerHTML = "";
  }
}
