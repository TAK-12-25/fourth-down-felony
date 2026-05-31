// ============================================================================
// teams.ts — fictional teams. The human side is "cannons".
// ============================================================================
import type { TeamData } from "../types/gameTypes";

export const TEAMS: Record<string, TeamData> = {
  cannons: {
    id: "cannons",
    name: "Knowlstradamus Cannons",
    abbr: "CAN",
    primary: "#6fd0ff",
    secondary: "#0a2a3a",
    roster: ["oracle", "crusher", "audible", "bengal", "mainecoon"],
  },
  crushers: {
    id: "crushers",
    name: "Kelsey Crushers",
    abbr: "CRU",
    primary: "#ff3b30",
    secondary: "#2a0808",
    roster: ["cobra", "havoc", "switchblade", "shorthair", "bricks"],
  },
};

export const HUMAN_TEAM = "cannons";
export const CPU_TEAM = "crushers";
