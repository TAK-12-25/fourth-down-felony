// ============================================================================
// specials.ts — special move definitions (data-driven; add more freely).
// ============================================================================
import type { SpecialMove } from "../types/gameTypes";

export const SPECIALS: Record<string, SpecialMove> = {
  vibeCheck: {
    id: "vibeCheck",
    name: "Vibe Check",
    desc: "Shockwave blast that launches nearby defenders and stuns them.",
    kind: "shockwave",
  },
  prophecyPass: {
    id: "prophecyPass",
    name: "Prophecy Pass",
    desc: "Next pass is laser-accurate with a glowing trail.",
    kind: "passBoost",
  },
  sleepRegression: {
    id: "sleepRegression",
    name: "Sleep Regression",
    desc: "Chaotic burst of speed that leaves defenders flat-footed.",
    kind: "speedBurst",
  },
  wallClimb: { id: "wallClimb", name: "Wall Climb", desc: "Hyper speed burst.", kind: "speedBurst" },
  fluffyPancake: {
    id: "fluffyPancake",
    name: "Fluffy Pancake",
    desc: "Flatten everyone nearby.",
    kind: "shockwave",
  },
  judgmentStare: {
    id: "judgmentStare",
    name: "Judgment Stare",
    desc: "Shockwave of pure disdain.",
    kind: "shockwave",
  },
};

export function getSpecial(id: string | null): SpecialMove | null {
  if (!id) return null;
  return SPECIALS[id] ?? null;
}
