import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { membershipOf, type PairRow } from "@/lib/pair-access";
import { assertSafeId, eqFilter, sbDelete, sbInsert, sbPatch, sbSelect } from "@/lib/supabase-app";
import {
  TurnConflictError,
  TurnRuleError,
  type GameWinner,
  type Seat,
  type TurnSnapshot,
  type TurnStep,
} from "./engine.ts";
import { turnGames } from "./registry.ts";
import {
  beginC4,
  idleC4View,
  newC4Match,
  presentC4,
  readC4State,
  type C4MatchView,
  type C4Move,
  type C4State,
} from "./c4.ts";
import {
  beginDots,
  idleDotsView,
  newDotsMatch,
  presentDots,
  readDotsState,
  type DotsMatchView,
  type DotsMove,
  type DotsState,
} from "./dots.ts";
import {
  beginCheckers,
  idleCheckersView,
  newCheckersMatch,
  presentCheckers,
  readCheckersState,
  repairMisplacedOpening,
  type CheckersMatchView,
  type CheckersMove,
  type CheckersState,
} from "./checkers.ts";
import {
  beginReversi,
  idleRevView,
  newReversiMatch,
  presentReversi,
  readRevState,
  type RevMatchView,
  type RevMove,
  type RevState,
} from "./reversi.ts";
import {
  beginTtt,
  idleTttView,
  newTttMatch,
  presentTtt,
  readTttState,
  type TttMatchView,
  type TttMove,
  type TttState,
} from "./ttt.ts";

type GameRow = {
  pair_id: string;
  game_type: string;
  state: unknown;
  turn_user_id: string | null;
  status: string;
  winner: string | null;
  version: number | string;
  updated_at?: string | null;
};

function textOf(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === "supabase 404" || error.message.includes("PGRST205"))
  ) {
    throw new Error("Игра ещё не включена. Нужно применить миграцию app_games.");
  }
  throw error;
}

function versionOf(value: number | string) {
  const version = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(version) || version < 0) throw new Error("Партия повреждена");
  return version;
}

function seatOf(pair: PairRow, userId: string): Seat | null {
  if (pair.a_user_id === userId) return "a";
  if (pair.b_user_id === userId) return "b";
  return null;
}

function userOf(pair: PairRow, seat: Seat) {
  const id = seat === "a" ? pair.a_user_id : pair.b_user_id;
  if (!id) throw new Error("Сначала соединитесь парой");
  return id;
}

async function requirePair(userId: string) {
  const member = await membershipOf(userId);
  if (!member?.pair?.b_user_id || !member.pairId) throw new Error("Сначала соединитесь парой");
  const seat = seatOf(member.pair, userId);
  if (!seat) throw new Error("Сначала соединитесь парой");
  return { pair: member.pair, pairId: assertSafeId(member.pairId), seat };
}

async function loadRow(pairId: string, game: string) {
  const rows = await sbSelect<GameRow>(
    "app_games",
    `${eqFilter("pair_id", pairId)}&${eqFilter("game_type", game)}&select=*`,
  );
  return rows[0] ?? null;
}

function toSnapshot<TState>(
  row: GameRow,
  pair: PairRow,
  read: (raw: unknown) => TState,
): { snapshot: TurnSnapshot<TState>; version: number } {
  if (row.status !== "idle" && row.status !== "active" && row.status !== "finished") {
    throw new Error("Партия повреждена");
  }
  const state = read(row.state);
  const turn = row.turn_user_id ? seatOf(pair, row.turn_user_id) : null;
  if (row.turn_user_id && !turn) throw new Error("Партия повреждена");
  let winner: GameWinner = null;
  if (row.winner === "draw") winner = "draw";
  else if (row.winner) {
    winner = seatOf(pair, row.winner);
    if (!winner) throw new Error("Партия повреждена");
  }
  if (row.status === "active" && !turn) throw new Error("Партия повреждена");
  if (row.status !== "active" && turn) throw new Error("Партия повреждена");
  if (row.status === "finished" && !winner) throw new Error("Партия повреждена");
  if (row.status !== "finished" && winner) throw new Error("Партия повреждена");
  return { snapshot: { state, status: row.status, turn, winner }, version: versionOf(row.version) };
}

function fields<TState>(pair: PairRow, step: TurnStep<TState>, version: number, now: string) {
  return {
    state: step.state,
    status: step.status,
    turn_user_id: step.turn ? userOf(pair, step.turn) : null,
    winner: step.winner === "draw" ? "draw" : step.winner ? userOf(pair, step.winner) : null,
    version,
    updated_at: now,
  };
}

async function compareAndSwap(
  pairId: string,
  game: string,
  version: number,
  guard: string,
  body: Record<string, unknown>,
) {
  const rows = await sbPatch<GameRow>(
    "app_games",
    `${eqFilter("pair_id", pairId)}&${eqFilter("game_type", game)}&version=eq.${version}&${guard}`,
    body,
  );
  return rows[0] ?? null;
}

type MatchKit<TState, TView> = {
  game: string;
  empty: () => TState;
  read: (raw: unknown) => TState;
  begin: (state: TState, seat: Seat) => TurnStep<TState>;
  reset: (state: TState) => TState;
  present: (snapshot: TurnSnapshot<TState>, version: number, seat: Seat, updatedAt: string | null) => TView;
  idle: () => TView;
  apply: (snapshot: TurnSnapshot<TState>, seat: Seat, move: unknown) => TurnStep<TState>;
  repair?: (snapshot: TurnSnapshot<TState>) => TurnStep<TState> | null;
};

function createMatch<TState, TView>(kit: MatchKit<TState, TView>) {
  const show = (step: TurnStep<TState>, version: number, seat: Seat, updatedAt: string | null) =>
    kit.present({ state: step.state, status: step.status, turn: step.turn, winner: step.winner }, version, seat, updatedAt);

  async function load(userId: string): Promise<TView> {
    const { pair, pairId, seat } = await requirePair(userId);
    const row = await loadRow(pairId, kit.game);
    if (!row) return kit.idle();
    const { snapshot, version } = toSnapshot(row, pair, kit.read);
    if (kit.repair && snapshot.turn) {
      const step = kit.repair(snapshot);
      if (step) {
        const now = new Date().toISOString();
        const saved = await compareAndSwap(
          pairId,
          kit.game,
          version,
          `status=eq.active&${eqFilter("turn_user_id", userOf(pair, snapshot.turn))}`,
          fields(pair, step, version + 1, now),
        );
        if (saved) return show(step, version + 1, seat, saved.updated_at ?? now);
        const fresh = await loadRow(pairId, kit.game);
        if (!fresh) return kit.idle();
        const again = toSnapshot(fresh, pair, kit.read);
        return kit.present(again.snapshot, again.version, seat, fresh.updated_at ?? null);
      }
    }
    return kit.present(snapshot, version, seat, row.updated_at ?? null);
  }

  async function play(userId: string, move: unknown, version: number): Promise<TView> {
    const { pair, pairId, seat } = await requirePair(userId);
    const row = await loadRow(pairId, kit.game);
    if (!row?.turn_user_id) throw new TurnRuleError("turn", "Сначала начни игру");
    if (row.turn_user_id !== userId) throw new TurnRuleError("turn", "Сейчас ход партнёра");
    const current = toSnapshot(row, pair, kit.read);
    if (current.version !== version) throw new TurnConflictError();
    const step = kit.apply(current.snapshot, seat, move);
    const now = new Date().toISOString();
    const saved = await compareAndSwap(
      pairId,
      kit.game,
      current.version,
      `status=eq.active&${eqFilter("turn_user_id", userId)}`,
      fields(pair, step, current.version + 1, now),
    );
    if (!saved) throw new TurnConflictError();
    return show(step, current.version + 1, seat, saved.updated_at ?? now);
  }

  async function open(userId: string, version: number): Promise<TView> {
    const { pair, pairId, seat } = await requirePair(userId);
    const row = await loadRow(pairId, kit.game);
    const now = new Date().toISOString();
    if (!row) {
      if (version !== 0) throw new TurnConflictError();
      const step = kit.begin(kit.empty(), seat);
      try {
        await sbInsert("app_games", {
          pair_id: pairId,
          game_type: kit.game,
          created_at: now,
          ...fields(pair, step, 1, now),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "ConflictError") throw new TurnConflictError();
        throw error;
      }
      return show(step, 1, seat, now);
    }
    const current = toSnapshot(row, pair, kit.read);
    if (current.version !== version) throw new TurnConflictError();
    if (current.snapshot.status === "active") {
      return kit.present(current.snapshot, current.version, seat, row.updated_at ?? null);
    }
    const previous = current.snapshot.status === "finished" ? kit.reset(current.snapshot.state) : current.snapshot.state;
    const step = kit.begin(previous, seat);
    const guard = current.snapshot.status === "finished" ? "status=eq.finished" : "status=eq.idle&turn_user_id=is.null";
    const saved = await compareAndSwap(pairId, kit.game, current.version, guard, fields(pair, step, current.version + 1, now));
    if (!saved) throw new TurnConflictError();
    return show(step, current.version + 1, seat, saved.updated_at ?? now);
  }

  return { load, play, open };
}

const tttMatch = createMatch<TttState, TttMatchView>({
  game: turnGames.ttt.type,
  empty: () => turnGames.ttt.empty(),
  read: readTttState,
  begin: beginTtt,
  reset: newTttMatch,
  present: presentTtt,
  idle: idleTttView,
  apply: (snapshot, seat, move) => turnGames.ttt.apply(snapshot, seat, move as TttMove),
});

const c4Match = createMatch<C4State, C4MatchView>({
  game: turnGames.c4.type,
  empty: () => turnGames.c4.empty(),
  read: readC4State,
  begin: beginC4,
  reset: newC4Match,
  present: presentC4,
  idle: idleC4View,
  apply: (snapshot, seat, move) => turnGames.c4.apply(snapshot, seat, move as C4Move),
});

const checkersMatch = createMatch<CheckersState, CheckersMatchView>({
  game: turnGames.checkers.type,
  empty: () => turnGames.checkers.empty(),
  read: readCheckersState,
  begin: beginCheckers,
  reset: newCheckersMatch,
  present: presentCheckers,
  idle: idleCheckersView,
  apply: (snapshot, seat, move) => turnGames.checkers.apply(snapshot, seat, move as CheckersMove),
  repair: repairMisplacedOpening,
});

const reversiMatch = createMatch<RevState, RevMatchView>({
  game: turnGames.reversi.type,
  empty: () => turnGames.reversi.empty(),
  read: readRevState,
  begin: beginReversi,
  reset: newReversiMatch,
  present: presentReversi,
  idle: idleRevView,
  apply: (snapshot, seat, move) => turnGames.reversi.apply(snapshot, seat, move as RevMove),
});

const dotsMatch = createMatch<DotsState, DotsMatchView>({
  game: turnGames.dots.type,
  empty: () => turnGames.dots.empty(),
  read: readDotsState,
  begin: beginDots,
  reset: newDotsMatch,
  present: presentDots,
  idle: idleDotsView,
  apply: (snapshot, seat, move) => turnGames.dots.apply(snapshot, seat, move as DotsMove),
});

function parseVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) {
    throw new Error("Некорректная партия");
  }
  return value;
}

export const loadTttMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TttMatchView> => {
    try {
      return await tttMatch.load(context.userId);
    } catch (error) {
      textOf(error);
    }
  });

export const playTttMove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректный ход");
    const raw = input as { cell?: unknown; version?: unknown };
    if (typeof raw.cell !== "number" || !Number.isInteger(raw.cell))
      throw new Error("Некорректная клетка");
    return { cell: raw.cell, version: parseVersion(raw.version) };
  })
  .handler(async ({ context, data }): Promise<TttMatchView> => {
    try {
      return await tttMatch.play(context.userId, { cell: data.cell }, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const openNewTttMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректная партия");
    return { version: parseVersion((input as { version?: unknown }).version) };
  })
  .handler(async ({ context, data }): Promise<TttMatchView> => {
    try {
      return await tttMatch.open(context.userId, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const loadC4Match = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<C4MatchView> => {
    try {
      return await c4Match.load(context.userId);
    } catch (error) {
      textOf(error);
    }
  });

export const playC4Move = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректный ход");
    const raw = input as { column?: unknown; version?: unknown };
    if (typeof raw.column !== "number" || !Number.isInteger(raw.column) || raw.column < 0 || raw.column > 6) {
      throw new Error("Нет такого столбца");
    }
    return { column: raw.column, version: parseVersion(raw.version) };
  })
  .handler(async ({ context, data }): Promise<C4MatchView> => {
    try {
      return await c4Match.play(context.userId, { column: data.column }, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const openNewC4Match = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректная партия");
    return { version: parseVersion((input as { version?: unknown }).version) };
  })
  .handler(async ({ context, data }): Promise<C4MatchView> => {
    try {
      return await c4Match.open(context.userId, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const loadDotsMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DotsMatchView> => {
    try {
      return await dotsMatch.load(context.userId);
    } catch (error) {
      textOf(error);
    }
  });

export const playDotsMove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректный ход");
    const raw = input as { kind?: unknown; index?: unknown; version?: unknown };
    if (raw.kind !== "h" && raw.kind !== "v") throw new Error("Нет такой линии");
    if (typeof raw.index !== "number" || !Number.isInteger(raw.index) || raw.index < 0 || raw.index > 19) {
      throw new Error("Нет такой линии");
    }
    return { kind: raw.kind, index: raw.index, version: parseVersion(raw.version) };
  })
  .handler(async ({ context, data }): Promise<DotsMatchView> => {
    try {
      return await dotsMatch.play(context.userId, { kind: data.kind, index: data.index }, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const openNewDotsMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректная партия");
    return { version: parseVersion((input as { version?: unknown }).version) };
  })
  .handler(async ({ context, data }): Promise<DotsMatchView> => {
    try {
      return await dotsMatch.open(context.userId, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const loadReversiMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<RevMatchView> => {
    try {
      return await reversiMatch.load(context.userId);
    } catch (error) {
      textOf(error);
    }
  });

export const playReversiMove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректный ход");
    const raw = input as { index?: unknown; version?: unknown };
    if (typeof raw.index !== "number" || !Number.isInteger(raw.index) || raw.index < 0 || raw.index > 63) {
      throw new Error("Нет такой клетки");
    }
    return { index: raw.index, version: parseVersion(raw.version) };
  })
  .handler(async ({ context, data }): Promise<RevMatchView> => {
    try {
      return await reversiMatch.play(context.userId, { index: data.index }, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const openNewReversiMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректная партия");
    return { version: parseVersion((input as { version?: unknown }).version) };
  })
  .handler(async ({ context, data }): Promise<RevMatchView> => {
    try {
      return await reversiMatch.open(context.userId, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const loadCheckersMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CheckersMatchView> => {
    try {
      return await checkersMatch.load(context.userId);
    } catch (error) {
      textOf(error);
    }
  });

export const playCheckersMove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректный ход");
    const raw = input as { from?: unknown; to?: unknown; version?: unknown };
    const square = (value: unknown) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 63;
    if (!square(raw.from) || !square(raw.to) || raw.from === raw.to) throw new Error("Нет такой клетки");
    return { from: raw.from as number, to: raw.to as number, version: parseVersion(raw.version) };
  })
  .handler(async ({ context, data }): Promise<CheckersMatchView> => {
    try {
      return await checkersMatch.play(context.userId, { from: data.from, to: data.to }, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export const openNewCheckersMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректная партия");
    return { version: parseVersion((input as { version?: unknown }).version) };
  })
  .handler(async ({ context, data }): Promise<CheckersMatchView> => {
    try {
      return await checkersMatch.open(context.userId, data.version);
    } catch (error) {
      textOf(error);
    }
  });

export async function deleteCoupleGames(pairId: string) {
  try {
    await sbDelete("app_games", eqFilter("pair_id", assertSafeId(pairId)));
  } catch (error) {
    if (error instanceof Error && error.message === "supabase 404") return;
    throw error;
  }
}
