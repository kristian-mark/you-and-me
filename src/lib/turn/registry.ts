import { tttRules } from "./ttt.ts";

// One rules module per game type. Future games register here and reuse the
// same app_games row, version check, and turn gate.
export const turnGames = {
  ttt: tttRules,
} as const;

export type TurnGameType = keyof typeof turnGames;
