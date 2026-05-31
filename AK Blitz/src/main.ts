// ============================================================================
// main.ts — entry point. Grabs the canvas + HUD overlay and boots the Game.
// ============================================================================
import "./style.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;

if (!canvas || !hud) {
  throw new Error("Missing #renderCanvas or #hud in index.html");
}

new Game(canvas, hud);
