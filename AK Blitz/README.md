# Fourth Down Felony

A 3D arcade football combat game — over-the-top hits, on-fire mode, a Mayhem
meter, and special moves. Original IP (no real leagues, teams, players, or
assets). Built with **Vite + TypeScript + Babylon.js**.

This is a **playable 3D vertical slice** that proves the core feel: snap → read
routes → aim-target a receiver → throw → catch/drop/pick → run → get tackled or
score, with an arcade chase cam that shakes on big hits.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Production build / preview:

```bash
npm run build
npm run preview
```

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move controlled player / set aim direction |
| `Shift` | Turbo (drains the turbo meter) |
| `Enter` | Snap the ball |
| `Space` | Pass to the highlighted target (QB) |
| `E` | Hurdle (i-frames to leap a tackle) |
| `Q` | Stiff-arm (knock back a defender) |
| `R` | Special move (when **MAYHEM READY**) |
| `T` | Taunt |
| `[` `]` or `1` `2` | Cycle offensive plays (pre-snap) |
| `P` | Pause |

## How a down plays out

1. **Pre-snap** — cycle plays; route art is drawn on the 3D field, primary route
   highlighted. The receiver you're aiming at shows a **TARGET / OPEN / TIGHT /
   PRIMARY** label.
2. **Enter** snaps it. You control the QB. Receivers run their routes; the CPU
   plays its called coverage (rush / man / zone / spy).
3. **Space** throws to the highlighted receiver. Ball arcs in 3D; accuracy
   depends on the QB, the receiver, distance, and defender proximity.
4. **Catch / drop / interception** resolve. On a catch, control switches to the
   receiver. Run it. Use **Q** / **E** to break tackles.
5. **CPU defenders chase and tackle.** Big hits spray blood, flash the screen,
   and shake the camera.
6. Cross the goal line for a **TOUCHDOWN**. Score to 21 (or clock out) ends it.

## Project structure

```
src/
  main.ts                 entry
  style.css               HUD + menu styling
  game/
    Game.ts               engine + render loop + menu/game switching
    config.ts             field geometry + gameplay tuning
    GameContext.ts        shared state bag passed to systems
    scenes/
      MenuScene.ts        title screen + difficulty select
      GameScene.ts        the 3D field, system wiring, game loop
    systems/
      InputSystem.ts      keyboard -> actions + aim
      CameraSystem.ts     arcade chase cam (follow / shake / punch)
      PlayerSystem.ts     3D player meshes, movement, knockback
      PlaybookSystem.ts   play cycling + CPU play calling
      RouteSystem.ts      pre-snap route art + route following
      TargetingSystem.ts  aim-based receiver targeting
      PassingSystem.ts    3D ball flight + catch/drop/pick
      CpuAiSystem.ts      defensive coverage/pursuit (+ future CPU offense)
      CollisionSystem.ts  body separation + blocking
      TackleSystem.ts     tackles, big hits, stiff-arm, hurdle
      HeatSystem.ts       on-fire state + boosts
      MayhemSystem.ts     mayhem meter + special moves
      WantedSystem.ts     wanted meter (placeholder for this slice)
      EffectsSystem.ts    blood, debris, shockwave, fire (no asset files)
      HudSystem.ts        scoreboard, meters, toasts, target labels
    data/
      teams.ts players.ts plays.ts specials.ts difficulty.ts
    types/
      gameTypes.ts        all shared types
```

## What's implemented (acceptance criteria)

- 3D field with yard lines, hash marks, end zones, sidelines, LOS + first-down markers
- 3D player placeholders (capsule body + helmet + selection ring)
- Angled arcade chase camera that follows the ball/carrier, punches on throws, shakes on hits
- Pre-snap play selection with bright 3D route art + arrowheads, primary highlighted
- Snap, QB movement, receivers running routes
- Aim-based receiver targeting with TARGET / OPEN / TIGHT / PRIMARY label
- Passing: 3D ball arc, catch / drop / interception, control switches to receiver on catch
- Run after catch, turbo, stiff-arm, hurdle
- CPU defense: rush / man / zone / spy per called play, pursuit, tackles, big hits
- Big hits: blood particles, red screen flash, camera shake, debris
- Touchdowns, scoreboard, down & distance, possession indicator
- Turbo / Mayhem / Wanted meters + Heat (On Fire) status
- Specials: **Vibe Check** (shockwave knockback) and **Prophecy Pass** (next-throw accuracy)
- Difficulty tiers (Rookie / Pro / Psycho); synthesized SFX (no audio files)

## Known limitations (next steps)

- **Possession is simplified.** Interceptions / turnover-on-downs show the
  outcome and reset a fresh human offensive series rather than handing the CPU a
  full offensive drive. The data + `CpuAiSystem.updateOffense` hooks for full CPU
  offense exist; wiring a real possession swap is the next milestone.
- This is a feel-focused slice — animations are placeholder (capsules, bob,
  knockback tilt). No real character models yet.
- Tuning (speeds, catch/pick odds, camera) lives in `src/game/config.ts` and is
  meant to be played with.
- Then: gameplay/fun pass, full CPU offense + possession swap, more specials and
  Wanted-level hazards, GitHub + Vercel deploy.
