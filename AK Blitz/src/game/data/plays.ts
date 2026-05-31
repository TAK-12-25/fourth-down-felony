// ============================================================================
// plays.ts — data-driven playbook.
// Route points are in LOS-local space: x = lateral (- left / + right),
// z = yards downfield from the line of scrimmage (offense drives toward +z).
// Slots: 0=QB, 1=RB, 2=WR-left, 3=WR-right, 4=TE/slot.
// To add a play: append an object with assignments + routes. That's it.
// ============================================================================
import type { OffensivePlay, DefensivePlay } from "../types/gameTypes";

export const OFFENSIVE_PLAYS: OffensivePlay[] = [
  {
    id: "crossfire",
    name: "Crossfire",
    type: "pass",
    description: "Two receivers criss-cross over the middle. High-traffic, high-reward.",
    formation: "Gun Trips",
    primarySlot: 2,
    risk: 3,
    reward: 4,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: -3, z: 2 }, { x: -9, z: 6 }] },
      { slot: 2, role: "WR", route: [{ x: -9, z: 4 }, { x: 6, z: 16 }] },
      { slot: 3, role: "WR", route: [{ x: 9, z: 4 }, { x: -6, z: 16 }] },
      { slot: 4, role: "TE", route: [{ x: 3, z: 3 }, { x: 3, z: 11 }] },
    ],
  },
  {
    id: "streetRocket",
    name: "Street Rocket",
    type: "pass",
    description: "Deep sideline shot. Take the top off the defense.",
    formation: "Gun Spread",
    primarySlot: 3,
    risk: 4,
    reward: 5,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: -4, z: 1 }, { x: -10, z: 3 }] },
      { slot: 2, role: "WR", route: [{ x: -10, z: 8 }, { x: -7, z: 22 }] },
      { slot: 3, role: "WR", route: [{ x: 10, z: 6 }, { x: 12, z: 34 }] },
      { slot: 4, role: "TE", route: [{ x: 4, z: 4 }, { x: 4, z: 12 }] },
    ],
  },
  {
    id: "alleySlant",
    name: "Alley Slant",
    type: "pass",
    description: "Quick slant to beat pressure. Get it out fast.",
    formation: "Gun Tight",
    primarySlot: 2,
    risk: 2,
    reward: 3,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: 3, z: 1 }, { x: 8, z: 4 }] },
      { slot: 2, role: "WR", route: [{ x: -8, z: 2 }, { x: -1, z: 9 }] },
      { slot: 3, role: "WR", route: [{ x: 8, z: 2 }, { x: 1, z: 9 }] },
      { slot: 4, role: "TE", route: [{ x: 4, z: 2 }, { x: 4, z: 7 }] },
    ],
  },
  {
    id: "brokenBottle",
    name: "Broken Bottle Screen",
    type: "pass",
    description: "Short screen to the back behind a wall of blockers.",
    formation: "Gun Bunch",
    primarySlot: 1,
    risk: 2,
    reward: 4,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: -6, z: -1 }, { x: -10, z: 1 }] },
      { slot: 2, role: "BLOCK", route: [{ x: -9, z: 1 }] },
      { slot: 3, role: "WR", route: [{ x: 9, z: 6 }, { x: 12, z: 14 }] },
      { slot: 4, role: "BLOCK", route: [{ x: -6, z: 2 }] },
    ],
  },
  {
    id: "riotWheel",
    name: "Riot Wheel",
    type: "pass",
    description: "Back leaks out on a wheel up the sideline. Wreck the linebacker.",
    formation: "Gun Pro",
    primarySlot: 1,
    risk: 3,
    reward: 5,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: 7, z: 1 }, { x: 11, z: 6 }, { x: 11, z: 24 }] },
      { slot: 2, role: "WR", route: [{ x: -9, z: 5 }, { x: -9, z: 14 }] },
      { slot: 3, role: "WR", route: [{ x: 9, z: 4 }, { x: 2, z: 11 }] },
      { slot: 4, role: "TE", route: [{ x: 3, z: 3 }, { x: 3, z: 9 }] },
    ],
  },
  {
    id: "felonyFlea",
    name: "Felony Flea Flicker",
    type: "trick",
    description: "Fake the pitch, then air it out deep. Pure felony.",
    formation: "Pistol Trick",
    primarySlot: 3,
    risk: 5,
    reward: 5,
    assignments: [
      { slot: 0, role: "QB", route: [] },
      { slot: 1, role: "RB", route: [{ x: 0, z: -2 }, { x: 6, z: 2 }] },
      { slot: 2, role: "WR", route: [{ x: -9, z: 8 }, { x: -11, z: 30 }] },
      { slot: 3, role: "WR", route: [{ x: 9, z: 10 }, { x: 5, z: 36 }] },
      { slot: 4, role: "TE", route: [{ x: 4, z: 5 }, { x: 9, z: 13 }] },
    ],
  },
];

export const DEFENSIVE_PLAYS: DefensivePlay[] = [
  {
    id: "jailbreak",
    name: "Jailbreak Blitz",
    type: "blitz",
    description: "Send the house. Get to the QB before he gets comfortable.",
    risk: 4,
    reward: 4,
    intents: ["rush", "rush", "man", "rush", "man"],
  },
  {
    id: "bloodZone",
    name: "Blood Zone",
    type: "zone",
    description: "Drop into zones and punish anything over the middle.",
    risk: 2,
    reward: 3,
    intents: ["rush", "zone", "zone", "zone", "zone"],
  },
  {
    id: "mugshot",
    name: "Mug Shot Man",
    type: "man",
    description: "Lock man coverage across the board with one spy.",
    risk: 3,
    reward: 3,
    intents: ["rush", "man", "man", "man", "spy"],
  },
  {
    id: "riotContain",
    name: "Riot Contain",
    type: "contain",
    description: "Keep the QB in the pocket and rally to the ball.",
    risk: 2,
    reward: 2,
    intents: ["rush", "spy", "man", "zone", "zone"],
  },
];

export function getOffensivePlay(id: string): OffensivePlay {
  return OFFENSIVE_PLAYS.find((p) => p.id === id) ?? OFFENSIVE_PLAYS[0];
}
export function getDefensivePlay(id: string): DefensivePlay {
  return DEFENSIVE_PLAYS.find((p) => p.id === id) ?? DEFENSIVE_PLAYS[0];
}
