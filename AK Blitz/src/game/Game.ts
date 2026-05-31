// ============================================================================
// Game.ts — owns the Babylon engine + render loop, and switches between the
// menu and the game scene.
// ============================================================================
import { Engine } from "@babylonjs/core/Engines/engine";
import type { Difficulty } from "./types/gameTypes";
import { AudioSystem } from "./systems/AudioSystem";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

export class Game {
  private engine: Engine;
  private hudRoot: HTMLElement;
  private audio = new AudioSystem();
  private current: GameScene | null = null;
  private menu: MenuScene | null = null;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.hudRoot = hudRoot;

    window.addEventListener("resize", () => this.engine.resize());

    this.engine.runRenderLoop(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      if (this.current) {
        this.current.update(dt);
        this.current.scene.render();
      }
    });

    this.showMenu();
  }

  private showMenu() {
    if (this.current) {
      this.current.dispose();
      this.current = null;
    }
    this.menu = new MenuScene(this.hudRoot, this.audio, (d) => this.startGame(d));
  }

  private startGame(diff: Difficulty) {
    this.menu = null;
    const scene = new GameScene(this.engine, this.audio, this.hudRoot, diff);
    scene.onGameOver = () => this.showMenu();
    this.current = scene;
  }
}
