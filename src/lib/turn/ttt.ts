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

export type TttState = {
  board: Array<Seat | null>;
  starter: Seat | null;
  wins: { a: number; b: number };
  draws: number;
};

export type TttMove = { cell: number };

export type TttMatchView = {
  status: GameStatus;
  version: number;
  myTurn: boolean;
  winner: "me" | "partner" | "draw" | null;
  board: Array<"me" | "partner" | null>;
  winningLine: number[] | null;
  youAreCrosses: boolean | null;
  wins: { me: number; partner: number };
  draws: number;
  updatedAt: string | null;
};

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function count(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  return value;
}

export function emptyTttState(): TttState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    starter: null,
    wins: { a: 0, b: 0 },
    draws: 0,
  };
}

export function readTttState(raw: unknown): TttState {
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
  if (!Array.isArray(rec.board) || rec.board.length !== 9) {
    throw new TurnRuleError("illegal", "Партия повреждена");
  }
  const board = rec.board.map((cell) => {
    if (cell === null) return null;
    if (cell === "a" || cell === "b") return cell;
    throw new TurnRuleError("illegal", "Партия повреждена");
  });
  let starter: Seat | null;
  if (rec.starter === null) starter = null;
  else if (rec.starter === "a" || rec.starter === "b") starter = rec.starter;
  else throw new TurnRuleError("illegal", "Партия повреждена");
  const filled = board.some((cell) => cell !== null);
  if (filled && !starter) throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRaw = rec.wins;
  if (!winsRaw || typeof winsRaw !== "object")
    throw new TurnRuleError("illegal", "Партия повреждена");
  const winsRec = winsRaw as Record<string, unknown>;
  return {
    board,
    starter,
    wins: { a: count(winsRec.a), b: count(winsRec.b) },
    draws: count(rec.draws),
  };
}

export function tttWinningLine(board: Array<Seat | null>): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [...line];
  }
  return null;
}

export function tttResult(board: Array<Seat | null>): Seat | "draw" | null {
  const line = tttWinningLine(board);
  if (line) return board[line[0]] ?? null;
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export const tttRules: TurnRules<TttState, TttMove> = {
  type: "ttt",
  empty: emptyTttState,
  apply(snapshot, actor, move) {
    assertCanAct(snapshot, actor);
    if (snapshot.status === "idle" && snapshot.state.board.some((cell) => cell !== null)) {
      throw new TurnRuleError("illegal", "Партия повреждена");
    }
    const cell = move.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
      throw new TurnRuleError("cell", "Нет такой клетки");
    }
    if (snapshot.state.board[cell]) {
      throw new TurnRuleError("occupied", "Клетка уже занята");
    }
    const board = snapshot.state.board.slice();
    board[cell] = actor;
    const outcome = tttResult(board);
    const next: TttState = {
      board,
      starter: snapshot.state.starter ?? actor,
      wins: {
        a: snapshot.state.wins.a + (outcome === "a" ? 1 : 0),
        b: snapshot.state.wins.b + (outcome === "b" ? 1 : 0),
      },
      draws: snapshot.state.draws + (outcome === "draw" ? 1 : 0),
    };
    if (outcome) {
      return { state: next, status: "finished", turn: null, winner: outcome };
    }
    return { state: next, status: "active", turn: otherSeat(actor), winner: null };
  },
};

/** Empty board, this seat to move. Scores carry over. */
export function beginTtt(previous: TttState, seat: Seat): TurnStep<TttState> {
  if (previous.board.some((cell) => cell !== null)) {
    throw new TurnRuleError("illegal", "Партия уже начата");
  }
  return {
    state: {
      board: emptyTttState().board,
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
      draws: previous.draws,
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function newTttMatch(previous: TttState): TttState {
  return {
    board: emptyTttState().board,
    starter: null,
    wins: { a: previous.wins.a, b: previous.wins.b },
    draws: previous.draws,
  };
}

export function presentTtt(
  snapshot: TurnSnapshot<TttState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): TttMatchView {
  const line = tttWinningLine(snapshot.state.board);
  const winner =
    snapshot.winner === "draw"
      ? "draw"
      : snapshot.winner
        ? snapshot.winner === seat
          ? "me"
          : "partner"
        : null;
  return {
    status: snapshot.status,
    version,
    myTurn: snapshot.status === "active" && snapshot.turn === seat,
    winner,
    board: snapshot.state.board.map((cell) =>
      cell === null ? null : cell === seat ? "me" : "partner",
    ),
    winningLine: line,
    youAreCrosses: snapshot.state.starter === null ? null : snapshot.state.starter === seat,
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
    draws: snapshot.state.draws,
    updatedAt,
  };
}

export function idleTttView(): TttMatchView {
  return presentTtt(
    { state: emptyTttState(), status: "idle", turn: null, winner: null },
    0,
    "a",
    null,
  );
}

export function tttBanner(view: Pick<TttMatchView, "status" | "myTurn" | "winner">): {
  title: string;
  hint: string;
} {
  if (view.status === "finished") {
    if (view.winner === "me") return { title: "Победа", hint: "Ты собрал линию" };
    if (view.winner === "partner") return { title: "Поражение", hint: "Линию собрал партнёр" };
    return { title: "Ничья", hint: "Свободных клеток не осталось" };
  }
  if (view.status === "idle") {
    return { title: "Новая партия", hint: "Кто нажмёт «Начать», тот ходит первым" };
  }
  if (view.myTurn) {
    return { title: "Твой ход", hint: "Выбери свободную клетку" };
  }
  return { title: "Ход партнёра", hint: "Можно закрыть экран и вернуться позже" };
}
