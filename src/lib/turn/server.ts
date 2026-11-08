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
  beginTtt,
  emptyTttState,
  idleTttView,
  newTttMatch,
  presentTtt,
  readTttState,
  type TttMatchView,
  type TttState,
} from "./ttt.ts";

const GAME = turnGames.ttt.type;

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

async function loadRow(pairId: string) {
  const rows = await sbSelect<GameRow>(
    "app_games",
    `${eqFilter("pair_id", pairId)}&${eqFilter("game_type", GAME)}&select=*`,
  );
  return rows[0] ?? null;
}

function toSnapshot(
  row: GameRow,
  pair: PairRow,
): { snapshot: TurnSnapshot<TttState>; version: number } {
  if (row.status !== "idle" && row.status !== "active" && row.status !== "finished") {
    throw new Error("Партия повреждена");
  }
  const state = readTttState(row.state);
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

function fields(pair: PairRow, step: TurnStep<TttState>, version: number, now: string) {
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
  version: number,
  guard: string,
  body: Record<string, unknown>,
) {
  const rows = await sbPatch<GameRow>(
    "app_games",
    `${eqFilter("pair_id", pairId)}&${eqFilter("game_type", GAME)}&version=eq.${version}&${guard}`,
    body,
  );
  return rows[0] ?? null;
}

function viewOf(
  step: TurnStep<TttState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): TttMatchView {
  return presentTtt(
    { state: step.state, status: step.status, turn: step.turn, winner: step.winner },
    version,
    seat,
    updatedAt,
  );
}

async function loadMatch(userId: string): Promise<TttMatchView> {
  const { pair, pairId, seat } = await requirePair(userId);
  const row = await loadRow(pairId);
  if (!row) return idleTttView();
  const { snapshot, version } = toSnapshot(row, pair);
  return presentTtt(snapshot, version, seat, row.updated_at ?? null);
}

async function playMove(userId: string, cell: number, version: number): Promise<TttMatchView> {
  const { pair, pairId, seat } = await requirePair(userId);
  const row = await loadRow(pairId);
  if (!row?.turn_user_id) throw new TurnRuleError("turn", "Сначала начни игру");
  if (row.turn_user_id !== userId) throw new TurnRuleError("turn", "Сейчас ход партнёра");
  const current = toSnapshot(row, pair);
  if (current.version !== version) throw new TurnConflictError();
  const step = turnGames.ttt.apply(current.snapshot, seat, { cell });
  const now = new Date().toISOString();
  const saved = await compareAndSwap(
    pairId,
    current.version,
    `status=eq.active&${eqFilter("turn_user_id", userId)}`,
    fields(pair, step, current.version + 1, now),
  );
  if (!saved) throw new TurnConflictError();
  return viewOf(step, current.version + 1, seat, saved.updated_at ?? now);
}

async function openMatch(userId: string, version: number): Promise<TttMatchView> {
  const { pair, pairId, seat } = await requirePair(userId);
  const row = await loadRow(pairId);
  const now = new Date().toISOString();
  if (!row) {
    if (version !== 0) throw new TurnConflictError();
    const step = beginTtt(emptyTttState(), seat);
    try {
      await sbInsert("app_games", {
        pair_id: pairId,
        game_type: GAME,
        created_at: now,
        ...fields(pair, step, 1, now),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ConflictError") throw new TurnConflictError();
      throw error;
    }
    return viewOf(step, 1, seat, now);
  }
  const current = toSnapshot(row, pair);
  if (current.version !== version) throw new TurnConflictError();
  if (current.snapshot.status === "active") {
    return presentTtt(current.snapshot, current.version, seat, row.updated_at ?? null);
  }
  const previous =
    current.snapshot.status === "finished" ? newTttMatch(current.snapshot.state) : current.snapshot.state;
  const step = beginTtt(previous, seat);
  const guard = current.snapshot.status === "finished" ? "status=eq.finished" : "status=eq.idle&turn_user_id=is.null";
  const saved = await compareAndSwap(
    pairId,
    current.version,
    guard,
    fields(pair, step, current.version + 1, now),
  );
  if (!saved) throw new TurnConflictError();
  return viewOf(step, current.version + 1, seat, saved.updated_at ?? now);
}

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
      return await loadMatch(context.userId);
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
      return await playMove(context.userId, data.cell, data.version);
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
      return await openMatch(context.userId, data.version);
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
