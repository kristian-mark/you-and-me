import { c4Rules } from "./c4.ts";
import { checkersRules } from "./checkers.ts";
import { dotsRules } from "./dots.ts";
import { reversiRules } from "./reversi.ts";
import { tttRules } from "./ttt.ts";
import { durakRules } from "./durak.ts";
import { seaRules } from "./sea.ts";

// One rules module per game type. Each game is its own app_games row
// (pair_id + game_type) and shares the version check and turn gate.
export const turnGames = {
  ttt: tttRules,
  c4: c4Rules,
  dots: dotsRules,
  reversi: reversiRules,
  checkers: checkersRules,
  sea: seaRules,
  durak: durakRules,
} as const;

export type TurnGameType = keyof typeof turnGames;
