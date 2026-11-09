import { c4Rules } from "./c4.ts";
import { tttRules } from "./ttt.ts";

// One rules module per game type. Each game is its own app_games row
// (pair_id + game_type) and shares the version check and turn gate.
export const turnGames = {
  ttt: tttRules,
  c4: c4Rules,
} as const;

export type TurnGameType = keyof typeof turnGames;
