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

export const C4_ROWS = 6;
export const C4_COLS = 7;
const CELLS = C4_ROWS * C4_COLS;

export type C4State = {
  board: Array<Seat | null>;
  starter: Seat | null;
  wins: { a: number; b: number };
  draws: number;
};

export type C4Move = { column: number };

export type C4MatchView = {
  status: GameStatus;
  version: number;
  myTurn: boolean;
  winner: "me" | "partner" | "draw" | null;
  board: Array<"me" | "partner" | null>;
  winningLine: number[] | null;
  wins: { me: number; partner: number };
  draws: number;
  updatedAt: string | null;
};

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function count(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  return value;
}

export function emptyC4State(): C4State {
  return {
    board: Array.from({ length: CELLS }, () => null),
    starter: null,
    wins: { a: 0, b: 0 },
    draws: 0,
  };
}

export function readC4State(raw: unknown): C4State {
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
  if (!Array.isArray(rec.board) || rec.board.length !== CELLS) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  const board = rec.board.map((cell) => {
    if (cell === null) return null;
    if (cell === "a" || cell === "b") return cell;
    throw new TurnRuleError("illegal", "Партия повреждена");
  });
  let starter: Seat | null;
  if (rec.starter === null || rec.starter === undefined) starter = null;
  else if (rec.starter === "a" || rec.starter === "b") starter = rec.starter;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  const filled = board.some((cell) => cell !== null);
  if (filled && !starter) throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRaw = rec.wins;
  if (!winsRaw || typeof winsRaw !== "object") throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRec = winsRaw as Record<string, unknown>;
  return {
    board,
    starter,
    wins: { a: count(winsRec.a), b: count(winsRec.b) },
    draws: count(rec.draws),
  };
}

export function c4Index(row: number, column: number) {
  return row * C4_COLS + column;
}

export function c4WinningLine(board: Array<Seat | null>): number[] | null {
  for (let row = 0; row < C4_ROWS; row += 1) {
    for (let column = 0; column < C4_COLS; column += 1) {
      const side = board[c4Index(row, column)];
      if (!side) continue;
      for (const [dr, dc] of DIRS) {
        const line = [c4Index(row, column)];
        let ok = true;
        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dr * step;
          const nextColumn = column + dc * step;
          if (
            nextRow < 0 ||
            nextColumn < 0 ||
            nextRow >= C4_ROWS ||
            nextColumn >= C4_COLS ||
            board[c4Index(nextRow, nextColumn)] !== side
          ) {
            ok = false;
            break;
          }
          line.push(c4Index(nextRow, nextColumn));
        }
        if (ok) return line;
      }
    }
  }
  return null;
}

export function c4Result(board: Array<Seat | null>): Seat | "draw" | null {
  const line = c4WinningLine(board);
  if (line) return board[line[0]] ?? null;
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export function dropC4(board: Array<Seat | null>, column: number, seat: Seat) {
  if (!Number.isInteger(column) || column < 0 || column >= C4_COLS) {
    throw new TurnRuleError("cell", "Нет такого столбца");
  }
  if (board[column]) throw new TurnRuleError("occupied", "Столбец уже полный");
  const next = board.slice();
  for (let row = C4_ROWS - 1; row >= 0; row -= 1) {
    const index = c4Index(row, column);
    if (!next[index]) {
      next[index] = seat;
      return next;
    }
  }
  throw new TurnRuleError("occupied", "Столбец уже полный");
}

export const c4Rules: TurnRules<C4State, C4Move> = {
  type: "c4",
  empty: emptyC4State,
  apply(snapshot, actor, move) {
    assertCanAct(snapshot, actor);
    const board = dropC4(snapshot.state.board, move.column, actor);
    const outcome = c4Result(board);
    const next: C4State = {
      board,
      starter: snapshot.state.starter ?? actor,
      wins: {
        a: snapshot.state.wins.a + (outcome === "a" ? 1 : 0),
        b: snapshot.state.wins.b + (outcome === "b" ? 1 : 0),
      },
      draws: snapshot.state.draws + (outcome === "draw" ? 1 : 0),
    };
    if (outcome) return { state: next, status: "finished", turn: null, winner: outcome };
    return { state: next, status: "active", turn: otherSeat(actor), winner: null };
  },
};

export function beginC4(previous: C4State, seat: Seat): TurnStep<C4State> {
  if (previous.board.some((cell) => cell !== null)) {
    throw new TurnRuleError("illegal", "Партия уже начата");
  }
  return {
    state: {
      board: emptyC4State().board,
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
      draws: previous.draws,
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function newC4Match(previous: C4State): C4State {
  return {
    board: emptyC4State().board,
    starter: null,
    wins: { a: previous.wins.a, b: previous.wins.b },
    draws: previous.draws,
  };
}

export function presentC4(
  snapshot: TurnSnapshot<C4State>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): C4MatchView {
  const winner =
    snapshot.winner === "draw" ? "draw" : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null;
  return {
    status: snapshot.status,
    version,
    myTurn: snapshot.status === "active" && snapshot.turn === seat,
    winner,
    board: snapshot.state.board.map((cell) => (cell === null ? null : cell === seat ? "me" : "partner")),
    winningLine: c4WinningLine(snapshot.state.board),
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
    draws: snapshot.state.draws,
    updatedAt,
  };
}

export function idleC4View(): C4MatchView {
  return presentC4({ state: emptyC4State(), status: "idle", turn: null, winner: null }, 0, "a", null);
}

export function c4Banner(view: Pick<C4MatchView, "status" | "myTurn" | "winner">, partnerName: string) {
  if (view.status === "finished") {
    if (view.winner === "me") return { title: "Победа", hint: "Четыре в ряд — твои" };
    if (view.winner === "partner") return { title: "Поражение", hint: `Четыре в ряд собрал ${partnerName}` };
    return { title: "Ничья", hint: "Свободных клеток не осталось" };
  }
  if (view.status === "idle") {
    return { title: "Новая партия", hint: "Кто нажмёт «Новая игра», тот ходит первым" };
  }
  if (view.myTurn) return { title: "Твой ход", hint: "Нажми столбец — фишка упадёт вниз" };
  return { title: "Ход партнёра", hint: "Можно закрыть экран и вернуться позже" };
}
