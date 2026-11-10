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

export const REV = 8;
export const REV_CELLS = REV * REV;

const DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export type RevState = {
  board: Array<Seat | null>;
  starter: Seat | null;
  wins: { a: number; b: number };
  draws: number;
  last: number | null;
  flipped: number[];
  passed: Seat | null;
};

export type RevMove = { index: number };

export type RevMark = "me" | "partner" | null;

export type RevMatchView = {
  status: GameStatus;
  version: number;
  myTurn: boolean;
  winner: "me" | "partner" | "draw" | null;
  board: RevMark[];
  legal: number[];
  score: { me: number; partner: number };
  last: number | null;
  flipped: number[];
  passed: "me" | "partner" | null;
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

function seatOf(cell: unknown): Seat | null {
  if (cell === null) return null;
  if (cell === "a" || cell === "b") return cell;
  throw new TurnRuleError("illegal", "Партия повреждена");
}

export function revIndex(row: number, column: number) {
  return row * REV + column;
}

export function emptyRevState(): RevState {
  return {
    board: Array.from({ length: REV_CELLS }, () => null),
    starter: null,
    wins: { a: 0, b: 0 },
    draws: 0,
    last: null,
    flipped: [],
    passed: null,
  };
}

export function flipsAt(board: Array<Seat | null>, index: number, seat: Seat): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= REV_CELLS || board[index]) return [];
  const row = Math.floor(index / REV);
  const column = index % REV;
  const flips: number[] = [];
  const other = otherSeat(seat);
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = row + dr;
    let c = column + dc;
    while (r >= 0 && c >= 0 && r < REV && c < REV && board[revIndex(r, c)] === other) {
      line.push(revIndex(r, c));
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && c >= 0 && r < REV && c < REV && board[revIndex(r, c)] === seat) {
      flips.push(...line);
    }
  }
  return flips;
}

export function legalMoves(board: Array<Seat | null>, seat: Seat) {
  const moves: number[] = [];
  for (let index = 0; index < REV_CELLS; index += 1) {
    if (flipsAt(board, index, seat).length) moves.push(index);
  }
  return moves;
}

function discCount(board: Array<Seat | null>, seat: Seat) {
  return board.reduce((sum, cell) => sum + (cell === seat ? 1 : 0), 0);
}

export function reversiResult(board: Array<Seat | null>): Seat | "draw" | null {
  const full = board.every((cell) => cell !== null);
  if (!full && (legalMoves(board, "a").length || legalMoves(board, "b").length)) return null;
  const a = discCount(board, "a");
  const b = discCount(board, "b");
  if (a === b) return "draw";
  return a > b ? "a" : "b";
}

function readLast(raw: unknown, board: Array<Seat | null>) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw >= REV_CELLS || !board[raw]) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  return raw;
}

function readFlipped(raw: unknown, board: Array<Seat | null>) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > REV_CELLS) throw new TurnRuleError("illegal", "Партия повреждена");
  return raw.map((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= REV_CELLS || !board[index]) {
      throw new TurnRuleError("illegal", "Партия повреждена");
    }
    return index;
  });
}

export function readRevState(raw: unknown): RevState {
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
  if (!Array.isArray(rec.board) || rec.board.length !== REV_CELLS) throw new TurnRuleError("illegal", "Партия повреждена");
  const board = rec.board.map(seatOf);
  let starter: Seat | null;
  if (rec.starter === null || rec.starter === undefined) starter = null;
  else if (rec.starter === "a" || rec.starter === "b") starter = rec.starter;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  if (board.some((cell) => cell !== null) && !starter) throw new TurnRuleError("illegal", "Партия повреждена");
  let passed: Seat | null;
  if (rec.passed === null || rec.passed === undefined) passed = null;
  else if (rec.passed === "a" || rec.passed === "b") passed = rec.passed;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRaw = rec.wins;
  if (!winsRaw || typeof winsRaw !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRec = winsRaw as Record<string, unknown>;
  return {
    board,
    starter,
    wins: { a: count(winsRec.a), b: count(winsRec.b) },
    draws: count(rec.draws),
    last: readLast(rec.last, board),
    flipped: readFlipped(rec.flipped, board),
    passed,
  };
}

export const reversiRules: TurnRules<RevState, RevMove> = {
  type: "reversi",
  empty: emptyRevState,
  apply(snapshot, actor, move) {
    assertCanAct(snapshot, actor);
    if (typeof move.index !== "number" || !Number.isInteger(move.index) || move.index < 0 || move.index >= REV_CELLS) {
      throw new TurnRuleError("cell", "Нет такой клетки");
    }
    if (snapshot.state.board[move.index]) throw new TurnRuleError("occupied", "Клетка занята");
    const captured = flipsAt(snapshot.state.board, move.index, actor);
    if (!captured.length) throw new TurnRuleError("illegal", "Сюда нельзя");
    const board = snapshot.state.board.slice();
    board[move.index] = actor;
    for (const index of captured) board[index] = actor;
    const outcome = reversiResult(board);
    const nextSeat = otherSeat(actor);
    const opponentCan = legalMoves(board, nextSeat).length > 0;
    const actorCan = legalMoves(board, actor).length > 0;
    const passed = !outcome && !opponentCan && actorCan ? nextSeat : null;
    const next: RevState = {
      board,
      starter: snapshot.state.starter ?? actor,
      wins: {
        a: snapshot.state.wins.a + (outcome === "a" ? 1 : 0),
        b: snapshot.state.wins.b + (outcome === "b" ? 1 : 0),
      },
      draws: snapshot.state.draws + (outcome === "draw" ? 1 : 0),
      last: move.index,
      flipped: captured,
      passed,
    };
    if (outcome) return { state: next, status: "finished", turn: null, winner: outcome };
    return { state: next, status: "active", turn: passed ? actor : nextSeat, winner: null };
  },
};

export function beginReversi(previous: RevState, seat: Seat): TurnStep<RevState> {
  if (previous.board.some((cell) => cell !== null)) throw new TurnRuleError("illegal", "Партия уже начата");
  const board = emptyRevState().board;
  const other = otherSeat(seat);
  board[revIndex(3, 3)] = other;
  board[revIndex(3, 4)] = seat;
  board[revIndex(4, 3)] = seat;
  board[revIndex(4, 4)] = other;
  return {
    state: {
      board,
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
      draws: previous.draws,
      last: null,
      flipped: [],
      passed: null,
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function newReversiMatch(previous: RevState): RevState {
  const blank = emptyRevState();
  return { ...blank, wins: { a: previous.wins.a, b: previous.wins.b }, draws: previous.draws };
}

function mark(cell: Seat | null, seat: Seat): RevMark {
  if (cell === null) return null;
  return cell === seat ? "me" : "partner";
}

export function presentReversi(
  snapshot: TurnSnapshot<RevState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): RevMatchView {
  const winner =
    snapshot.winner === "draw" ? "draw" : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null;
  const myTurn = snapshot.status === "active" && snapshot.turn === seat;
  return {
    status: snapshot.status,
    version,
    myTurn,
    winner,
    board: snapshot.state.board.map((cell) => mark(cell, seat)),
    legal: myTurn ? legalMoves(snapshot.state.board, seat) : [],
    score: {
      me: discCount(snapshot.state.board, seat),
      partner: discCount(snapshot.state.board, otherSeat(seat)),
    },
    last: snapshot.state.last,
    flipped: snapshot.state.flipped,
    passed: snapshot.state.passed ? (snapshot.state.passed === seat ? "me" : "partner") : null,
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
    draws: snapshot.state.draws,
    updatedAt,
  };
}

export function idleRevView(): RevMatchView {
  return presentReversi({ state: emptyRevState(), status: "idle", turn: null, winner: null }, 0, "a", null);
}

export function reversiBanner(
  view: Pick<RevMatchView, "status" | "myTurn" | "winner" | "passed">,
  partnerName: string,
) {
  if (view.status === "finished") {
    if (view.winner === "me") return "Победа";
    if (view.winner === "partner") return "Поражение";
    return "Ничья";
  }
  if (view.passed === "me") return `У тебя нет хода — ход переходит к ${partnerName}`;
  if (view.passed === "partner") return `У ${partnerName} нет хода — твой ход`;
  if (view.status === "idle") return "Кто нажмёт «Новая игра», тот ходит первым";
  if (view.myTurn) return "Твой ход";
  return "Ход партнёра";
}
