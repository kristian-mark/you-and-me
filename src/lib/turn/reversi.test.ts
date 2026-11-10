import assert from "node:assert/strict";
import test from "node:test";
import { TurnRuleError, type Seat, type TurnSnapshot } from "./engine.ts";
import {
  beginReversi,
  emptyRevState,
  flipsAt,
  legalMoves,
  revIndex,
  reversiResult,
  reversiRules,
  type RevState,
} from "./reversi.ts";

function opened(seat: Seat = "a"): TurnSnapshot<RevState> {
  const step = beginReversi(emptyRevState(), seat);
  return { state: step.state, status: step.status, turn: step.turn, winner: step.winner };
}

function boardOf(cells: Array<[number, Seat]>): Array<Seat | null> {
  const board = emptyRevState().board;
  for (const [index, seat] of cells) board[index] = seat;
  return board;
}

test("the starter moves first from the centre four", () => {
  const match = opened("b");
  assert.equal(match.turn, "b");
  assert.equal(match.state.board[revIndex(3, 3)], "a");
  assert.equal(match.state.board[revIndex(3, 4)], "b");
  assert.equal(match.state.board[revIndex(4, 3)], "b");
  assert.equal(match.state.board[revIndex(4, 4)], "a");
  assert.ok(legalMoves(match.state.board, "b").length >= 4);
  assert.throws(() => reversiRules.apply(match, "a", { index: revIndex(2, 3) }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "turn";
  });
  const next = reversiRules.apply(match, "b", { index: revIndex(2, 3) });
  assert.equal(next.state.board[revIndex(2, 3)], "b");
  assert.equal(next.state.board[revIndex(3, 3)], "b");
  assert.equal(next.turn, "a");
  assert.equal(next.state.last, revIndex(2, 3));
  assert.deepEqual(next.state.flipped, [revIndex(3, 3)]);
});

test("one disc flips every sandwiched line", () => {
  const board = boardOf([
    [revIndex(0, 1), "a"],
    [revIndex(1, 1), "b"],
    [revIndex(3, 1), "a"],
    [revIndex(2, 0), "a"],
    [revIndex(2, 2), "b"],
    [revIndex(2, 3), "a"],
    [revIndex(1, 2), "b"],
    [revIndex(0, 3), "a"],
  ]);
  const at = revIndex(2, 1);
  const flips = flipsAt(board, at, "a").sort((a, b) => a - b);
  assert.deepEqual(flips, [revIndex(1, 1), revIndex(1, 2), revIndex(2, 2)].sort((a, b) => a - b));
  const snapshot: TurnSnapshot<RevState> = {
    state: { ...emptyRevState(), board, starter: "a" },
    status: "active",
    turn: "a",
    winner: null,
  };
  const next = reversiRules.apply(snapshot, "a", { index: at });
  for (const index of flips) assert.equal(next.state.board[index], "a");
  assert.equal(next.state.board[at], "a");
  assert.equal(next.state.flipped.length, 3);
});

test("a cell that flips nothing is rejected", () => {
  const match = opened("a");
  assert.throws(() => reversiRules.apply(match, "a", { index: 0 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "illegal";
  });
  assert.throws(() => reversiRules.apply(match, "a", { index: revIndex(3, 3) }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "occupied";
  });
  assert.throws(() => reversiRules.apply(match, "a", { index: 64 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "cell";
  });
});

test("a player with no move is skipped and the turn comes back", () => {
  const board = boardOf([
    [0, "a"],
    [1, "b"],
    [3, "a"],
    [4, "b"],
  ]);
  const snapshot: TurnSnapshot<RevState> = {
    state: { ...emptyRevState(), board, starter: "a" },
    status: "active",
    turn: "a",
    winner: null,
  };
  const next = reversiRules.apply(snapshot, "a", { index: 2 });
  assert.equal(next.status, "active");
  assert.equal(next.turn, "a");
  assert.equal(next.state.passed, "b");
  assert.equal(legalMoves(next.state.board, "b").length, 0);
  assert.ok(legalMoves(next.state.board, "a").length > 0);
});

test("the game ends when nobody can move, including an even count", () => {
  const board = boardOf([
    [0, "a"],
    [1, "b"],
  ]);
  const snapshot: TurnSnapshot<RevState> = {
    state: { ...emptyRevState(), board, starter: "a" },
    status: "active",
    turn: "a",
    winner: null,
  };
  const next = reversiRules.apply(snapshot, "a", { index: 2 });
  assert.equal(next.status, "finished");
  assert.equal(next.winner, "a");
  assert.equal(next.state.wins.a, 1);
  assert.equal(reversiResult(next.state.board), "a");
  assert.throws(() => reversiRules.apply(next, "b", { index: 3 }));

  const tied = boardOf([
    [0, "a"],
    [1, "a"],
    [7, "b"],
    [15, "b"],
  ]);
  assert.equal(legalMoves(tied, "a").length, 0);
  assert.equal(legalMoves(tied, "b").length, 0);
  assert.equal(reversiResult(tied), "draw");
});
