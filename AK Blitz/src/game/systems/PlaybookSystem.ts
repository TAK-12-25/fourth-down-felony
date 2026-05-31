// ============================================================================
// PlaybookSystem.ts — pre-snap play cycling + CPU play selection (situational
// and difficulty-weighted). Human is offense in this slice; CPU calls defense.
// ============================================================================
import { OFFENSIVE_PLAYS, DEFENSIVE_PLAYS } from "../data/plays";
import type { GameContext } from "../GameContext";

export class PlaybookSystem {
  cycleOffense(ctx: GameContext, dir: number) {
    const n = OFFENSIVE_PLAYS.length;
    ctx.playIndex = (ctx.playIndex + dir + n) % n;
    ctx.offensePlayId = OFFENSIVE_PLAYS[ctx.playIndex].id;
  }

  setOffenseByIndex(ctx: GameContext, idx: number) {
    const n = OFFENSIVE_PLAYS.length;
    ctx.playIndex = ((idx % n) + n) % n;
    ctx.offensePlayId = OFFENSIVE_PLAYS[ctx.playIndex].id;
  }

  /** CPU defense: blitz more on long downs, zone on short, mix by difficulty. */
  pickCpuDefense(ctx: GameContext): string {
    const longYardage = ctx.toGo >= 8;
    const r = ctx.rng();
    const aggressive = ctx.diff.cpuReaction; // proxy for aggression
    if (ctx.down >= 3 && longYardage) {
      return r < 0.5 + aggressive * 0.3 ? "jailbreak" : "bloodZone";
    }
    if (ctx.toGo <= 4) {
      return r < 0.6 ? "mugshot" : "riotContain";
    }
    // standard down
    const roll = r * (1 + aggressive);
    if (roll < 0.35) return "bloodZone";
    if (roll < 0.65) return "mugshot";
    if (roll < 0.85) return "jailbreak";
    return "riotContain";
  }

  /** CPU offense (future use): situational run/pass-ish selection. */
  pickCpuOffense(ctx: GameContext): string {
    const r = ctx.rng();
    if (ctx.down >= 3 && ctx.toGo >= 8) {
      return r < 0.5 ? "streetRocket" : "felonyFlea";
    }
    if (ctx.toGo <= 3) return r < 0.5 ? "brokenBottle" : "alleySlant";
    const pool = OFFENSIVE_PLAYS.map((p) => p.id);
    return pool[Math.floor(r * pool.length)];
  }

  defensePlayName(id: string): string {
    return DEFENSIVE_PLAYS.find((p) => p.id === id)?.name ?? id;
  }
}
