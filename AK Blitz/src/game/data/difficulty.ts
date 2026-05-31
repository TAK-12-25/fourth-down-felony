// ============================================================================
// difficulty.ts — CPU difficulty tiers. Prototype defaults to "pro".
// ============================================================================
import type { Difficulty, DifficultyConfig } from "../types/gameTypes";

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  rookie: {
    id: "rookie",
    label: "ROOKIE",
    cpuSpeedMult: 0.88,
    cpuReaction: 0.45,
    cpuBigHitChance: 0.12,
    cpuThrowAccuracy: 0.6,
    cpuInterceptSkill: 0.2,
  },
  pro: {
    id: "pro",
    label: "PRO",
    cpuSpeedMult: 1.0,
    cpuReaction: 0.7,
    cpuBigHitChance: 0.28,
    cpuThrowAccuracy: 0.78,
    cpuInterceptSkill: 0.4,
  },
  psycho: {
    id: "psycho",
    label: "PSYCHO",
    cpuSpeedMult: 1.12,
    cpuReaction: 0.92,
    cpuBigHitChance: 0.5,
    cpuThrowAccuracy: 0.9,
    cpuInterceptSkill: 0.62,
  },
};
