import { createServerFn } from "@tanstack/react-start";

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

export type TttInput = {
  code: string;
  seat: TttSeat;
  action: "sync" | "move" | "rematch" | "resign";
  index?: number;
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

function view(row: Row, seat: TttSeat, local = false): TttState {
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

function parse(input: unknown): TttInput {
  if (!input || typeof input !== "object") throw new Error("Некорректный запрос");
  const raw = input as { code?: unknown; seat?: unknown; action?: unknown; index?: unknown };
  const code = String(raw.code ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4 || code.length > 12) throw new Error("Нет кода пары");
  if (raw.seat !== "a" && raw.seat !== "b") throw new Error("Нет места за столом");
  const action = raw.action === "move" || raw.action === "rematch" || raw.action === "resign" ? raw.action : "sync";
  const index = typeof raw.index === "number" ? raw.index : undefined;
  return { code, seat: raw.seat, action, index };
}

function emptyRow(code: string, seat: TttSeat, now: number): Row {
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

function apply(row: Row, data: TttInput, now: number): Row {
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
    points_a: Number(row.points_a) + (result && result !== "draw" && result === "a" ? 2 : 0),
    points_b: Number(row.points_b) + (result && result !== "draw" && result === "b" ? 2 : 0),
    revision: row.revision + 1,
  };
}

const storageKey = (code: string) => `couple-ttt:${code}`;

function readLocal(code: string, seat: TttSeat): Row {
  if (typeof window === "undefined") return emptyRow(code, seat, Date.now());
  try {
    const raw = window.localStorage.getItem(storageKey(code));
    if (raw) return JSON.parse(raw) as Row;
  } catch {
    /* ignore */
  }
  const row = emptyRow(code, seat, Date.now());
  writeLocal(row);
  return row;
}

function writeLocal(row: Row) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(row.code), JSON.stringify(row));
}

export function actTttLocal(data: TttInput): TttState {
  const now = Date.now();
  const row = apply(readLocal(data.code, data.seat), data, now);
  writeLocal(row);
  return view(row, data.seat, true);
}

async function load(code: string, seat: TttSeat): Promise<Row> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const now = Date.now();
  const found = await sql<Row>`select * from ttt_games where code = ${code}`;
  if (found[0]) {
    if (seat === "a") await sql`update ttt_games set seen_a = ${now} where code = ${code}`;
    else await sql`update ttt_games set seen_b = ${now} where code = ${code}`;
    const again = await sql<Row>`select * from ttt_games where code = ${code}`;
    return again[0];
  }
  const row = emptyRow(code, seat, now);
  await sql`
    insert into ttt_games (code, turn, starter, seen_a, seen_b)
    values (${row.code}, ${row.turn}, ${row.starter}, ${row.seen_a}, ${row.seen_b})
    on conflict (code) do nothing
  `;
  const next = await sql<Row>`select * from ttt_games where code = ${code}`;
  return next[0];
}

async function save(next: Row, expectedRevision: number): Promise<Row | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<Row>`
    update ttt_games set
      board = ${next.board},
      turn = ${next.turn},
      starter = ${next.starter},
      phase = ${next.phase},
      winner = ${next.winner},
      games = ${next.games},
      wins_a = ${next.wins_a},
      wins_b = ${next.wins_b},
      points_a = ${next.points_a},
      points_b = ${next.points_b},
      last_cell = ${next.last_cell},
      seen_a = ${next.seen_a},
      seen_b = ${next.seen_b},
      revision = ${expectedRevision + 1}
    where code = ${next.code} and revision = ${expectedRevision}
    returning *
  `;
  return rows[0] ?? null;
}

const actTttRemote = createServerFn({ method: "POST" })
  .validator(parse)
  .handler(async ({ data }): Promise<TttState> => {
    const row = apply(await load(data.code, data.seat), data, Date.now());
    if (data.action === "sync") return view(row, data.seat);
    return view((await save(row, row.revision - 1)) ?? (await load(data.code, data.seat)), data.seat);
  });

export async function actTtt({ data }: { data: TttInput }): Promise<TttState> {
  try {
    return await actTttRemote({ data });
  } catch {
    return actTttLocal(data);
  }
}
