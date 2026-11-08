export type TttSeat = "a" | "b";

export type TttState = {
  board: Array<TttSeat | null>;
  turn: TttSeat;
  starter: TttSeat;
  phase: "play" | "done";
  winner: TttSeat | "draw" | null;
  games: number;
  wins: { a: number; b: number };
  points: { a: number; b: number };
  lastCell: number | null;
  partnerOnline: boolean;
  revision: number;
  local?: boolean;
};

export type TttInput = {
  code: string;
  seat: TttSeat;
  action: "sync" | "move" | "rematch" | "resign";
  index?: number;
};

type Row = {
  code: string;
  board: string;
  turn: TttSeat;
  starter: TttSeat;
  phase: "play" | "done";
  winner: string | null;
  games: number;
  wins_a: number;
  wins_b: number;
  points_a: number;
  points_b: number;
  last_cell: number | null;
  seen_a: number;
  seen_b: number;
  revision: number;
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

function other(seat: TttSeat): TttSeat {
  return seat === "a" ? "b" : "a";
}

function outcome(board: string): TttSeat | "draw" | null {
  const cells = board.split("");
  for (const [a, b, c] of LINES) {
    if (cells[a] !== "-" && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a] as TttSeat;
  }
  if (!cells.includes("-")) return "draw";
  return null;
}

export function viewTtt(row: Row, seat: TttSeat, local = false): TttState {
  const now = Date.now();
  const partnerSeen = seat === "a" ? Number(row.seen_b) : Number(row.seen_a);
  return {
    board: row.board.split("").map((cell) => (cell === "-" ? null : (cell as TttSeat))),
    turn: row.turn,
    starter: row.starter,
    phase: row.phase,
    winner: row.winner === "a" || row.winner === "b" || row.winner === "draw" ? row.winner : null,
    games: Number(row.games),
    wins: { a: Number(row.wins_a), b: Number(row.wins_b) },
    points: { a: Number(row.points_a), b: Number(row.points_b) },
    lastCell: row.last_cell === null || row.last_cell === undefined ? null : Number(row.last_cell),
    partnerOnline: local ? true : now - partnerSeen < 20000,
    revision: Number(row.revision),
    local,
  };
}

export function emptyTttRow(code: string, seat: TttSeat, now: number): Row {
  return {
    code,
    board: "---------",
    turn: seat,
    starter: seat,
    phase: "play",
    winner: null,
    games: 0,
    wins_a: 0,
    wins_b: 0,
    points_a: 0,
    points_b: 0,
    last_cell: null,
    seen_a: seat === "a" ? now : 0,
    seen_b: seat === "b" ? now : 0,
    revision: 1,
  };
}

export function applyTtt(row: Row, data: TttInput, now: number): Row {
  const next = { ...row };
  if (data.seat === "a") next.seen_a = now;
  else next.seen_b = now;
  if (data.action === "sync") return next;

  if (data.action === "rematch") {
    if (row.phase !== "done") return next;
    return {
      ...next,
      board: "---------",
      turn: data.seat,
      starter: data.seat,
      phase: "play",
      winner: null,
      last_cell: null,
      revision: row.revision + 1,
    };
  }

  if (data.action === "resign") {
    if (row.phase !== "play") return next;
    const winner = other(data.seat);
    return {
      ...next,
      phase: "done",
      winner,
      games: Number(row.games) + 1,
      wins_a: Number(row.wins_a) + (winner === "a" ? 1 : 0),
      wins_b: Number(row.wins_b) + (winner === "b" ? 1 : 0),
      points_a: Number(row.points_a) + (winner === "a" ? 2 : 0),
      points_b: Number(row.points_b) + (winner === "b" ? 2 : 0),
      turn: winner,
      revision: row.revision + 1,
    };
  }

  const index = data.index;
  if (row.phase !== "play" || row.turn !== data.seat || index === undefined || index < 0 || index > 8) {
    return next;
  }
  const cells = row.board.split("");
  if (cells[index] !== "-") return next;
  cells[index] = data.seat;
  const board = cells.join("");
  const result = outcome(board);
  return {
    ...next,
    board,
    last_cell: index,
    turn: result ? row.turn : other(data.seat),
    phase: result ? "done" : "play",
    winner: result,
    games: Number(row.games) + (result ? 1 : 0),
    wins_a: Number(row.wins_a) + (result === "a" ? 1 : 0),
    wins_b: Number(row.wins_b) + (result === "b" ? 1 : 0),
    points_a: Number(row.points_a) + (result === "a" ? 2 : 0),
    points_b: Number(row.points_b) + (result === "b" ? 2 : 0),
    revision: row.revision + 1,
  };
}

const storageKey = (code: string) => `couple-ttt:${code}`;

function readLocal(code: string, seat: TttSeat): Row {
  if (typeof window === "undefined") return emptyTttRow(code, seat, Date.now());
  try {
    const raw = window.localStorage.getItem(storageKey(code));
    if (raw) return JSON.parse(raw) as Row;
  } catch {
    /* ignore */
  }
  const row = emptyTttRow(code, seat, Date.now());
  writeLocal(row);
  return row;
}

function writeLocal(row: Row) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(row.code), JSON.stringify(row));
}

export function actTttLocal(data: TttInput): TttState {
  const now = Date.now();
  const row = applyTtt(readLocal(data.code, data.seat), data, now);
  writeLocal(row);
  return viewTtt(row, data.seat, true);
}

export async function actTtt({ data }: { data: TttInput }): Promise<TttState> {
  return actTttLocal(data);
}
