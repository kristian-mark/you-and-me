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

/** 4 × 4 boxes, drawn on a 5 × 5 grid of dots. */
export const DOTS_BOXES = 4;
export const DOTS_SPAN = DOTS_BOXES + 1;
export const DOTS_H = DOTS_SPAN * DOTS_BOXES;
export const DOTS_V = DOTS_BOXES * DOTS_SPAN;
export const DOTS_CELLS = DOTS_BOXES * DOTS_BOXES;

export type DotsLine = "h" | "v";

export type DotsLast = { kind: DotsLine; index: number };

export type DotsState = {
  h: Array<Seat | null>;
  v: Array<Seat | null>;
  boxes: Array<Seat | null>;
  starter: Seat | null;
  wins: { a: number; b: number };
  draws: number;
  last: DotsLast | null;
};

export type DotsMove = { kind: DotsLine; index: number };

export type DotsMark = "me" | "partner" | null;

export type DotsMatchView = {
  status: GameStatus;
  version: number;
  myTurn: boolean;
  again: boolean;
  winner: "me" | "partner" | "draw" | null;
  h: DotsMark[];
  v: DotsMark[];
  boxes: DotsMark[];
  score: { me: number; partner: number };
  last: DotsLast | null;
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

function linesOf(raw: unknown, length: number) {
  if (!Array.isArray(raw) || raw.length !== length) throw new TurnRuleError("illegal", "Партия повреждена");
  return raw.map(seatOf);
}

export function hIndex(row: number, column: number) {
  return row * DOTS_BOXES + column;
}

export function vIndex(row: number, column: number) {
  return row * DOTS_SPAN + column;
}

export function boxIndex(row: number, column: number) {
  return row * DOTS_BOXES + column;
}

export function emptyDotsState(): DotsState {
  return {
    h: Array.from({ length: DOTS_H }, () => null),
    v: Array.from({ length: DOTS_V }, () => null),
    boxes: Array.from({ length: DOTS_CELLS }, () => null),
    starter: null,
    wins: { a: 0, b: 0 },
    draws: 0,
    last: null,
  };
}

function boxLines(row: number, column: number) {
  return {
    top: hIndex(row, column),
    bottom: hIndex(row + 1, column),
    left: vIndex(row, column),
    right: vIndex(row, column + 1),
  };
}

export function boxClosed(h: Array<Seat | null>, v: Array<Seat | null>, row: number, column: number) {
  const lines = boxLines(row, column);
  return Boolean(h[lines.top] && h[lines.bottom] && v[lines.left] && v[lines.right]);
}

/** Boxes that share this line. A line between two boxes can close both. */
export function boxesOnLine(kind: DotsLine, index: number): Array<[number, number]> {
  if (kind === "h") {
    const row = Math.floor(index / DOTS_BOXES);
    const column = index % DOTS_BOXES;
    return [
      [row - 1, column],
      [row, column],
    ];
  }
  const row = Math.floor(index / DOTS_SPAN);
  const column = index % DOTS_SPAN;
  return [
    [row, column - 1],
    [row, column],
  ];
}

function inside(row: number, column: number) {
  return row >= 0 && column >= 0 && row < DOTS_BOXES && column < DOTS_BOXES;
}

export function claimBoxes(h: Array<Seat | null>, v: Array<Seat | null>, boxes: Array<Seat | null>, kind: DotsLine, index: number, seat: Seat) {
  const next = boxes.slice();
  let claimed = 0;
  for (const [row, column] of boxesOnLine(kind, index)) {
    if (!inside(row, column)) continue;
    const at = boxIndex(row, column);
    if (next[at]) continue;
    if (!boxClosed(h, v, row, column)) continue;
    next[at] = seat;
    claimed += 1;
  }
  return { boxes: next, claimed };
}

export function linesFull(h: Array<Seat | null>, v: Array<Seat | null>) {
  return h.every((line) => line !== null) && v.every((line) => line !== null);
}

export function dotsResult(boxes: Array<Seat | null>, done: boolean): Seat | "draw" | null {
  if (!done) return null;
  let a = 0;
  let b = 0;
  for (const box of boxes) {
    if (box === "a") a += 1;
    else if (box === "b") b += 1;
  }
  if (a === b) return "draw";
  return a > b ? "a" : "b";
}

function readLast(raw: unknown, h: Array<Seat | null>, v: Array<Seat | null>): DotsLast | null {
  const filled = h.some((line) => line !== null) || v.some((line) => line !== null);
  if (raw === null || raw === undefined) {
    if (filled) throw new TurnRuleError("illegal", "Партия повреждена");
    return null;
  }
  if (!raw || typeof raw !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const rec = raw as Record<string, unknown>;
  if (rec.kind !== "h" && rec.kind !== "v") throw new TurnRuleError("illegal", "Партия повреждена");
  const line = rec.kind === "h" ? h : v;
  if (typeof rec.index !== "number" || !Number.isInteger(rec.index) || rec.index < 0 || rec.index >= line.length) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  if (!line[rec.index]) throw new TurnRuleError("illegal", "Партия повреждена");
  return { kind: rec.kind, index: rec.index };
}

export function readDotsState(raw: unknown): DotsState {
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
  const h = linesOf(rec.h, DOTS_H);
  const v = linesOf(rec.v, DOTS_V);
  const boxes = linesOf(rec.boxes, DOTS_CELLS);
  for (let row = 0; row < DOTS_BOXES; row += 1) {
    for (let column = 0; column < DOTS_BOXES; column += 1) {
      const owner = boxes[boxIndex(row, column)];
      const closed = boxClosed(h, v, row, column);
      if (!closed && owner) throw new TurnRuleError("illegal", "Партия повреждена");
      if (closed && !owner) throw new TurnRuleError("illegal", "Партия повреждена");
      if (!owner) continue;
      const sides = [h[hIndex(row, column)], h[hIndex(row + 1, column)], v[vIndex(row, column)], v[vIndex(row, column + 1)]];
      if (!sides.includes(owner)) throw new TurnRuleError("illegal", "Партия повреждена");
    }
  }
  let starter: Seat | null;
  if (rec.starter === null || rec.starter === undefined) starter = null;
  else if (rec.starter === "a" || rec.starter === "b") starter = rec.starter;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  const filled = h.some((line) => line !== null) || v.some((line) => line !== null);
  if (filled && !starter) throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRaw = rec.wins;
  if (!winsRaw || typeof winsRaw !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRec = winsRaw as Record<string, unknown>;
  return {
    h,
    v,
    boxes,
    starter,
    wins: { a: count(winsRec.a), b: count(winsRec.b) },
    draws: count(rec.draws),
    last: readLast(rec.last, h, v),
  };
}

function placeLine(state: DotsState, move: DotsMove, seat: Seat) {
  if (move.kind !== "h" && move.kind !== "v") throw new TurnRuleError("cell", "Нет такой линии");
  const source = move.kind === "h" ? state.h : state.v;
  if (!Number.isInteger(move.index) || move.index < 0 || move.index >= source.length) {
    throw new TurnRuleError("cell", "Нет такой линии");
  }
  if (source[move.index]) throw new TurnRuleError("occupied", "Линия уже проведена");
  const h = state.h.slice();
  const v = state.v.slice();
  if (move.kind === "h") h[move.index] = seat;
  else v[move.index] = seat;
  return { h, v };
}

export const dotsRules: TurnRules<DotsState, DotsMove> = {
  type: "dots",
  empty: emptyDotsState,
  apply(snapshot, actor, move) {
    assertCanAct(snapshot, actor);
    const { h, v } = placeLine(snapshot.state, move, actor);
    const { boxes, claimed } = claimBoxes(h, v, snapshot.state.boxes, move.kind, move.index, actor);
    const done = linesFull(h, v);
    const outcome = dotsResult(boxes, done);
    const next: DotsState = {
      h,
      v,
      boxes,
      starter: snapshot.state.starter ?? actor,
      wins: {
        a: snapshot.state.wins.a + (outcome === "a" ? 1 : 0),
        b: snapshot.state.wins.b + (outcome === "b" ? 1 : 0),
      },
      draws: snapshot.state.draws + (outcome === "draw" ? 1 : 0),
      last: { kind: move.kind, index: move.index },
    };
    if (outcome) return { state: next, status: "finished", turn: null, winner: outcome };
    return {
      state: next,
      status: "active",
      turn: claimed > 0 ? actor : otherSeat(actor),
      winner: null,
    };
  },
};

export function beginDots(previous: DotsState, seat: Seat): TurnStep<DotsState> {
  if (previous.h.some((line) => line !== null) || previous.v.some((line) => line !== null)) {
    throw new TurnRuleError("illegal", "Партия уже начата");
  }
  const blank = emptyDotsState();
  return {
    state: {
      ...blank,
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
      draws: previous.draws,
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function newDotsMatch(previous: DotsState): DotsState {
  const blank = emptyDotsState();
  return {
    ...blank,
    wins: { a: previous.wins.a, b: previous.wins.b },
    draws: previous.draws,
  };
}

function mark(cell: Seat | null, seat: Seat): DotsMark {
  if (cell === null) return null;
  return cell === seat ? "me" : "partner";
}

function owned(boxes: Array<Seat | null>, seat: Seat) {
  return boxes.reduce((sum, cell) => sum + (cell === seat ? 1 : 0), 0);
}

export function presentDots(
  snapshot: TurnSnapshot<DotsState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): DotsMatchView {
  const winner =
    snapshot.winner === "draw" ? "draw" : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null;
  const last = snapshot.state.last;
  const lastOwner = last ? (last.kind === "h" ? snapshot.state.h[last.index] : snapshot.state.v[last.index]) : null;
  return {
    status: snapshot.status,
    version,
    myTurn: snapshot.status === "active" && snapshot.turn === seat,
    again: snapshot.status === "active" && snapshot.turn !== null && lastOwner === snapshot.turn,
    winner,
    h: snapshot.state.h.map((cell) => mark(cell, seat)),
    v: snapshot.state.v.map((cell) => mark(cell, seat)),
    boxes: snapshot.state.boxes.map((cell) => mark(cell, seat)),
    score: {
      me: owned(snapshot.state.boxes, seat),
      partner: owned(snapshot.state.boxes, seat === "a" ? "b" : "a"),
    },
    last,
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
    draws: snapshot.state.draws,
    updatedAt,
  };
}

export function idleDotsView(): DotsMatchView {
  return presentDots({ state: emptyDotsState(), status: "idle", turn: null, winner: null }, 0, "a", null);
}

export function dotsBanner(view: Pick<DotsMatchView, "status" | "myTurn" | "again" | "winner">) {
  if (view.status === "finished") {
    if (view.winner === "me") return "Победа";
    if (view.winner === "partner") return "Поражение";
    return "Ничья";
  }
  if (view.status === "idle") return "Кто нажмёт «Новая игра», тот ходит первым";
  if (view.again && view.myTurn) return "Закрыл квадрат — ходи ещё";
  if (view.myTurn) return "Твой ход";
  return "Ход партнёра";
}
