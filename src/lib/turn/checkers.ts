import {
  assertCanAct,
  otherSeat,
  TurnRuleError,
  type GameStatus,
  type Seat,
  type TurnRules,
  type TurnSnapshot,
  type TurnStep,
} from "./engine.ts";

export const CHECK_SIZE = 8;
export const CHECK_CELLS = CHECK_SIZE * CHECK_SIZE;
const DRAW_AFTER = 40;

const DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Men are lowercase. Kings are uppercase. */
export type CheckCell = "a" | "A" | "b" | "B" | null;

export type CheckLast = { from: number; to: number };

export type CheckersState = {
  board: CheckCell[];
  starter: Seat | null;
  wins: { a: number; b: number };
  draws: number;
  last: CheckLast | null;
  /** The piece that must keep jumping, or null when the turn is open. */
  chain: number | null;
  /** King-only moves in a row, with no capture and no man move. */
  quietKing: number;
};

export type CheckersMove = { from: number; to: number };

export type CheckMark = "me" | "partner" | null;

export type CheckersMatchView = {
  status: GameStatus;
  version: number;
  myTurn: boolean;
  winner: "me" | "partner" | "draw" | null;
  board: CheckMark[];
  kings: boolean[];
  /** Absolute indexes. The viewer at the top of the stored board flips the screen. */
  flip: boolean;
  moves: CheckLast[];
  chain: number | null;
  capturing: boolean;
  last: CheckLast | null;
  score: { me: number; partner: number };
  wins: { me: number; partner: number };
  draws: number;
  updatedAt: string | null;
};

function count(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  return value;
}

export function checkIndex(row: number, column: number) {
  return row * CHECK_SIZE + column;
}

function rowOf(index: number) {
  return Math.floor(index / CHECK_SIZE);
}

function square(index: number, dr: number, dc: number) {
  const row = rowOf(index) + dr;
  const column = (index % CHECK_SIZE) + dc;
  if (row < 0 || column < 0 || row >= CHECK_SIZE || column >= CHECK_SIZE) return null;
  return checkIndex(row, column);
}

export function sideOf(cell: Exclude<CheckCell, null>): Seat {
  return cell === "a" || cell === "A" ? "a" : "b";
}

export function isKing(cell: Exclude<CheckCell, null>) {
  return cell === "A" || cell === "B";
}

function encode(seat: Seat, king: boolean): Exclude<CheckCell, null> {
  if (seat === "a") return king ? "A" : "a";
  return king ? "B" : "b";
}

function forward(seat: Seat) {
  return seat === "a" ? -1 : 1;
}

function farRow(seat: Seat) {
  return seat === "a" ? 0 : CHECK_SIZE - 1;
}

export function emptyCheckersState(): CheckersState {
  return {
    board: Array.from({ length: CHECK_CELLS }, () => null),
    starter: null,
    wins: { a: 0, b: 0 },
    draws: 0,
    last: null,
    chain: null,
    quietKing: 0,
  };
}

type Step = { from: number; to: number; over: number | null };

function jumpsFrom(board: CheckCell[], index: number): Array<{ to: number; over: number }> {
  const cell = board[index];
  if (!cell) return [];
  const seat = sideOf(cell);
  const jumps: Array<{ to: number; over: number }> = [];
  for (const [dr, dc] of DIRS) {
    const over = square(index, dr, dc);
    if (over == null || !board[over] || sideOf(board[over]) === seat) continue;
    const land = square(over, dr, dc);
    if (land == null || board[land]) continue;
    jumps.push({ to: land, over });
  }
  return jumps;
}

function quietsFrom(board: CheckCell[], index: number) {
  const cell = board[index];
  if (!cell) return [];
  const seat = sideOf(cell);
  const king = isKing(cell);
  const dirs = king ? DIRS : DIRS.filter(([dr]) => dr === forward(seat));
  const lands: number[] = [];
  for (const [dr, dc] of dirs) {
    const dest = square(index, dr, dc);
    if (dest == null || board[dest]) continue;
    lands.push(dest);
  }
  return lands;
}

export function legalSteps(board: CheckCell[], seat: Seat, chain: number | null): Step[] {
  if (chain != null) {
    return jumpsFrom(board, chain).map((jump) => ({ from: chain, to: jump.to, over: jump.over }));
  }
  const jumps: Step[] = [];
  for (let index = 0; index < CHECK_CELLS; index += 1) {
    const cell = board[index];
    if (!cell || sideOf(cell) !== seat) continue;
    for (const jump of jumpsFrom(board, index)) jumps.push({ from: index, to: jump.to, over: jump.over });
  }
  if (jumps.length) return jumps;
  const quiet: Step[] = [];
  for (let index = 0; index < CHECK_CELLS; index += 1) {
    const cell = board[index];
    if (!cell || sideOf(cell) !== seat) continue;
    for (const to of quietsFrom(board, index)) quiet.push({ from: index, to, over: null });
  }
  return quiet;
}

function pieceCount(board: CheckCell[], seat: Seat) {
  return board.reduce((sum, cell) => sum + (cell && sideOf(cell) === seat ? 1 : 0), 0);
}

function cellOf(value: unknown): CheckCell {
  if (value === null) return null;
  if (value === "a" || value === "A" || value === "b" || value === "B") return value;
  throw new TurnRuleError("illegal", "Партия повреждена");
}

function readIndex(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= CHECK_CELLS) {
    throw new TurnRuleError("illegal", label);
  }
  return value;
}

export function readCheckersState(raw: unknown): CheckersState {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw new TurnRuleError("illegal", "Партия повреждена");
    }
  }
  if (!value || typeof value !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.board) || rec.board.length !== CHECK_CELLS) throw new TurnRuleError("illegal", "Партия повреждена");
  const board = rec.board.map(cellOf);
  let starter: Seat | null;
  if (rec.starter === null || rec.starter === undefined) starter = null;
  else if (rec.starter === "a" || rec.starter === "b") starter = rec.starter;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  if (board.some((cell) => cell !== null) && !starter) throw new TurnRuleError("illegal", "Партия повреждена");
  let chain: number | null = null;
  if (rec.chain !== null && rec.chain !== undefined) {
    chain = readIndex(rec.chain, "Партия повреждена");
    if (!board[chain]) throw new TurnRuleError("illegal", "Партия повреждена");
  }
  let last: CheckLast | null = null;
  if (rec.last !== null && rec.last !== undefined) {
    if (!rec.last || typeof rec.last !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
    const lastRec = rec.last as Record<string, unknown>;
    last = { from: readIndex(lastRec.from, "Партия повреждена"), to: readIndex(lastRec.to, "Партия повреждена") };
  }
  const winsRaw = rec.wins;
  if (!winsRaw || typeof winsRaw !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRec = winsRaw as Record<string, unknown>;
  return {
    board,
    starter,
    wins: { a: count(winsRec.a), b: count(winsRec.b) },
    draws: count(rec.draws),
    last,
    chain,
    quietKing: count(rec.quietKing ?? 0),
  };
}

/** Seat a always sits on rows 5–7, seat b on rows 0–2. The starter only takes the first move. */
function placeOpening() {
  const board = emptyCheckersState().board;
  for (let row = 0; row < CHECK_SIZE; row += 1) {
    for (let column = 0; column < CHECK_SIZE; column += 1) {
      if ((row + column) % 2 === 0) continue;
      const index = checkIndex(row, column);
      if (row < 3) board[index] = encode("b", false);
      else if (row > 4) board[index] = encode("a", false);
    }
  }
  return board;
}

export const checkersRules: TurnRules<CheckersState, CheckersMove> = {
  type: "checkers",
  empty: emptyCheckersState,
  apply(snapshot, actor, move) {
    assertCanAct(snapshot, actor);
    if (
      typeof move.from !== "number" ||
      typeof move.to !== "number" ||
      !Number.isInteger(move.from) ||
      !Number.isInteger(move.to) ||
      move.from < 0 ||
      move.to < 0 ||
      move.from >= CHECK_CELLS ||
      move.to >= CHECK_CELLS
    ) {
      throw new TurnRuleError("cell", "Нет такой клетки");
    }
    const options = legalSteps(snapshot.state.board, actor, snapshot.state.chain);
    const chosen = options.find((step) => step.from === move.from && step.to === move.to);
    if (!chosen) {
      const piece = snapshot.state.board[move.from];
      if (!piece || sideOf(piece) !== actor) throw new TurnRuleError("cell", "Это не твоя фишка");
      if (snapshot.state.board[move.to]) throw new TurnRuleError("occupied", "Клетка занята");
      throw new TurnRuleError("illegal", snapshot.state.chain || options.some((step) => step.over != null) ? "Нужно бить" : "Сюда нельзя");
    }
    const board = snapshot.state.board.slice();
    const moving = board[chosen.from];
    if (!moving) throw new TurnRuleError("cell", "Это не твоя фишка");
    const wasMan = !isKing(moving);
    board[chosen.from] = null;
    if (chosen.over != null) board[chosen.over] = null;
    board[chosen.to] = moving;
    const more = chosen.over != null && jumpsFrom(board, chosen.to).length > 0;
    if (!more && wasMan && rowOf(chosen.to) === farRow(actor)) board[chosen.to] = encode(actor, true);
    const quietKing = more ? snapshot.state.quietKing : chosen.over != null || wasMan ? 0 : snapshot.state.quietKing + 1;
    const opponent = otherSeat(actor);
    let outcome: Seat | "draw" | null = null;
    if (!more) {
      if (pieceCount(board, opponent) === 0 || legalSteps(board, opponent, null).length === 0) outcome = actor;
      else if (quietKing >= DRAW_AFTER) outcome = "draw";
    }
    const next: CheckersState = {
      board,
      starter: snapshot.state.starter ?? actor,
      wins: {
        a: snapshot.state.wins.a + (outcome === "a" ? 1 : 0),
        b: snapshot.state.wins.b + (outcome === "b" ? 1 : 0),
      },
      draws: snapshot.state.draws + (outcome === "draw" ? 1 : 0),
      last: { from: chosen.from, to: chosen.to },
      chain: more ? chosen.to : null,
      quietKing,
    };
    if (outcome) return { state: next, status: "finished", turn: null, winner: outcome };
    return { state: next, status: "active", turn: more ? actor : opponent, winner: null };
  },
};

/**
 * A rematch started by seat b used to put their men on rows 5–7.
 * They then faced the wrong way and had no move. Put that untouched
 * opening back on the fixed sides and leave the turn with them.
 */
export function repairMisplacedOpening(snapshot: TurnSnapshot<CheckersState>): TurnStep<CheckersState> | null {
  if (snapshot.status !== "active" || snapshot.turn !== "b" || snapshot.state.starter !== "b") return null;
  if (snapshot.state.chain != null || snapshot.state.quietKing !== 0 || snapshot.state.last) return null;
  for (let row = 0; row < CHECK_SIZE; row += 1) {
    for (let column = 0; column < CHECK_SIZE; column += 1) {
      const cell = snapshot.state.board[checkIndex(row, column)];
      const dark = (row + column) % 2 === 1;
      if (!dark) {
        if (cell) return null;
        continue;
      }
      const expected = row < 3 ? "a" : row > 4 ? "b" : null;
      if (cell !== expected) return null;
    }
  }
  return {
    state: { ...snapshot.state, board: placeOpening(), last: null, chain: null },
    status: "active",
    turn: "b",
    winner: null,
  };
}

export function beginCheckers(previous: CheckersState, seat: Seat): TurnStep<CheckersState> {
  if (previous.board.some((cell) => cell !== null)) throw new TurnRuleError("illegal", "Партия уже начата");
  return {
    state: {
      ...emptyCheckersState(),
      board: placeOpening(),
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
      draws: previous.draws,
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function newCheckersMatch(previous: CheckersState): CheckersState {
  return { ...emptyCheckersState(), wins: { a: previous.wins.a, b: previous.wins.b }, draws: previous.draws };
}

function shown(cell: CheckCell, seat: Seat): CheckMark {
  if (!cell) return null;
  return sideOf(cell) === seat ? "me" : "partner";
}

export function presentCheckers(
  snapshot: TurnSnapshot<CheckersState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): CheckersMatchView {
  const winner =
    snapshot.winner === "draw" ? "draw" : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null;
  const myTurn = snapshot.status === "active" && snapshot.turn === seat;
  const moves = myTurn && snapshot.turn ? legalSteps(snapshot.state.board, snapshot.turn, snapshot.state.chain) : [];
  return {
    status: snapshot.status,
    version,
    myTurn,
    winner,
    board: snapshot.state.board.map((cell) => shown(cell, seat)),
    kings: snapshot.state.board.map((cell) => Boolean(cell && isKing(cell))),
    flip: seat === "b",
    moves: moves.map((step) => ({ from: step.from, to: step.to })),
    chain: snapshot.state.chain,
    capturing: moves.some((step) => step.over != null),
    last: snapshot.state.last,
    score: {
      me: pieceCount(snapshot.state.board, seat),
      partner: pieceCount(snapshot.state.board, otherSeat(seat)),
    },
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
    draws: snapshot.state.draws,
    updatedAt,
  };
}

export function idleCheckersView(): CheckersMatchView {
  return presentCheckers({ state: emptyCheckersState(), status: "idle", turn: null, winner: null }, 0, "a", null);
}

export function checkersBanner(view: Pick<CheckersMatchView, "status" | "myTurn" | "winner" | "chain" | "capturing">) {
  if (view.status === "finished") {
    if (view.winner === "me") return "Победа";
    if (view.winner === "partner") return "Поражение";
    return "Ничья";
  }
  if (view.status === "idle") return "Кто нажмёт «Новая игра», тот ходит первым";
  if (view.myTurn && view.chain != null) return "Бей дальше";
  if (view.myTurn && view.capturing) return "Нужно бить";
  if (view.myTurn) return "Твой ход";
  return "Ход партнёра";
}
