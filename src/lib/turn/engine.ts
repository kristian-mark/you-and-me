// Shared turn contract for couple games. A rules module validates one move.
// The server stores the snapshot and refuses a write unless the version
// (and, while a match is active, the actor) still matches.

export type Seat = "a" | "b";

export type GameStatus = "idle" | "active" | "finished";

export type GameWinner = Seat | "draw" | null;

export type TurnSnapshot<TState> = {
  state: TState;
  status: GameStatus;
  turn: Seat | null;
  winner: GameWinner;
};

export type TurnStep<TState> = {
  state: TState;
  status: GameStatus;
  turn: Seat | null;
  winner: GameWinner;
};

export type TurnRules<TState, TMove> = {
  type: string;
  empty: () => TState;
  apply: (snapshot: TurnSnapshot<TState>, actor: Seat, move: TMove) => TurnStep<TState>;
};

export type TurnRuleCode = "turn" | "occupied" | "finished" | "cell" | "illegal";

export class TurnRuleError extends Error {
  readonly code: TurnRuleCode;

  constructor(code: TurnRuleCode, message: string) {
    super(message);
    this.name = "TurnRuleError";
    this.code = code;
  }
}

export class TurnConflictError extends Error {
  constructor() {
    super("Ход уже сделан — открой партию ещё раз");
    this.name = "TurnConflictError";
  }
}

export function otherSeat(seat: Seat): Seat {
  return seat === "a" ? "b" : "a";
}

/**
 * Idle: nobody moves until the match is started and a turn is stored.
 * Active: only the seat stored as `turn` may move.
 * Finished: nobody moves until the match is reset.
 */
export function assertCanAct(snapshot: { status: GameStatus; turn: Seat | null }, actor: Seat) {
  if (snapshot.status === "finished") {
    throw new TurnRuleError("finished", "Партия уже закончена");
  }
  if (snapshot.status !== "active" || snapshot.turn !== actor) {
    throw new TurnRuleError("turn", "Сейчас ход партнёра");
  }
}
