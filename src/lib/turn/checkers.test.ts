import assert from "node:assert/strict";
import test from "node:test";
import { TurnRuleError, type TurnSnapshot } from "./engine.ts";
import {
  beginCheckers,
  checkersRules,
  checkIndex,
  emptyCheckersState,
  type CheckCell,
  type CheckersState,
} from "./checkers.ts";

function at(cells: Array<[number, CheckCell]>): CheckersState {
  const state = emptyCheckersState();
  state.starter = "a";
  for (const [index, cell] of cells) state.board[index] = cell;
  return state;
}

function snap(state: CheckersState, turn: "a" | "b" = "a"): TurnSnapshot<CheckersState> {
  return { state, status: "active", turn, winner: null };
}

function play(snapshot: TurnSnapshot<CheckersState>, from: number, to: number) {
  const actor = snapshot.turn;
  if (!actor) throw new Error("no turn");
  return checkersRules.apply(snapshot, actor, { from, to });
}

test("the starter moves a man one square forward, and the other seat waits", () => {
  const opened = beginCheckers(emptyCheckersState(), "a");
  assert.equal(opened.turn, "a");
  assert.equal(opened.state.board.filter((cell) => cell === "a").length, 12);
  assert.equal(opened.state.board.filter((cell) => cell === "b").length, 12);
  const match = snap(opened.state, "a");
  assert.throws(() => checkersRules.apply(match, "b", { from: checkIndex(5, 1), to: checkIndex(4, 0) }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "turn";
  });
  const next = play(match, checkIndex(5, 0), checkIndex(4, 1));
  assert.equal(next.state.board[checkIndex(4, 1)], "a");
  assert.equal(next.state.board[checkIndex(5, 0)], null);
  assert.equal(next.turn, "b");
  assert.equal(next.state.chain, null);
  const back = snap(at([
    [checkIndex(4, 1), "a"],
    [checkIndex(0, 1), "b"],
  ]));
  assert.throws(() => play(back, checkIndex(4, 1), checkIndex(5, 2)), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "illegal";
  });
});

test("a capture is forced, including backward, and a quiet step is refused", () => {
  const forward = snap(at([
    [checkIndex(4, 1), "a"],
    [checkIndex(3, 2), "b"],
    [checkIndex(0, 1), "b"],
  ]));
  assert.throws(() => play(forward, checkIndex(4, 1), checkIndex(3, 0)), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "illegal";
  });
  const taken = play(forward, checkIndex(4, 1), checkIndex(2, 3));
  assert.equal(taken.state.board[checkIndex(2, 3)], "a");
  assert.equal(taken.state.board[checkIndex(3, 2)], null);
  assert.equal(taken.turn, "b");

  const backward = snap(at([
    [checkIndex(4, 1), "a"],
    [checkIndex(5, 2), "b"],
    [checkIndex(0, 1), "b"],
  ]));
  const jumped = play(backward, checkIndex(4, 1), checkIndex(6, 3));
  assert.equal(jumped.state.board[checkIndex(6, 3)], "a");
  assert.equal(jumped.state.board[checkIndex(5, 2)], null);
  assert.equal(jumped.state.chain, null);
});

test("a multi-jump stays with the same piece until the chain ends", () => {
  const start = snap(at([
    [checkIndex(5, 1), "a"],
    [checkIndex(4, 2), "b"],
    [checkIndex(2, 4), "b"],
    [checkIndex(0, 7), "b"],
  ]));
  const first = play(start, checkIndex(5, 1), checkIndex(3, 3));
  assert.equal(first.turn, "a");
  assert.equal(first.state.chain, checkIndex(3, 3));
  assert.equal(first.state.board[checkIndex(3, 3)], "a");
  assert.equal(first.state.board[checkIndex(4, 2)], null);
  assert.throws(() => checkersRules.apply(first, "a", { from: checkIndex(5, 1), to: checkIndex(4, 0) }));
  const second = checkersRules.apply(first, "a", { from: checkIndex(3, 3), to: checkIndex(1, 5) });
  assert.equal(second.turn, "b");
  assert.equal(second.state.chain, null);
  assert.equal(second.state.board[checkIndex(1, 5)], "a");
  assert.equal(second.state.board[checkIndex(2, 4)], null);
});

test("a man becomes a king at the end of the move, not in the middle of a capture", () => {
  const quiet = snap(at([
    [checkIndex(1, 2), "a"],
    [checkIndex(0, 5), "b"],
  ]));
  const crowned = play(quiet, checkIndex(1, 2), checkIndex(0, 1));
  assert.equal(crowned.state.board[checkIndex(0, 1)], "A");
  assert.equal(crowned.turn, "b");

  const through = snap(at([
    [checkIndex(2, 1), "a"],
    [checkIndex(1, 2), "b"],
    [checkIndex(1, 4), "b"],
    [checkIndex(6, 1), "b"],
  ]));
  const mid = play(through, checkIndex(2, 1), checkIndex(0, 3));
  assert.equal(mid.state.board[checkIndex(0, 3)], "a");
  assert.equal(mid.state.chain, checkIndex(0, 3));
  assert.equal(mid.turn, "a");
  const done = checkersRules.apply(mid, "a", { from: checkIndex(0, 3), to: checkIndex(2, 5) });
  assert.equal(done.state.board[checkIndex(2, 5)], "a");
  assert.equal(done.state.chain, null);

  const onto = snap(at([
    [checkIndex(2, 1), "a"],
    [checkIndex(1, 2), "b"],
    [checkIndex(6, 1), "b"],
  ]));
  const king = play(onto, checkIndex(2, 1), checkIndex(0, 3));
  assert.equal(king.state.board[checkIndex(0, 3)], "A");
});

test("a king moves and captures one square in any direction, and does not fly", () => {
  const king = snap(at([[checkIndex(4, 3), "A"]]));
  const moved = play(king, checkIndex(4, 3), checkIndex(5, 2));
  assert.equal(moved.state.board[checkIndex(5, 2)], "A");
  assert.throws(() => play(king, checkIndex(4, 3), checkIndex(6, 1)), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "illegal";
  });
  const flying = snap(at([
    [checkIndex(4, 1), "A"],
    [checkIndex(2, 3), "b"],
  ]));
  assert.throws(() => play(flying, checkIndex(4, 1), checkIndex(1, 4)));
  const jump = snap(at([
    [checkIndex(4, 1), "A"],
    [checkIndex(5, 2), "b"],
  ]));
  const taken = play(jump, checkIndex(4, 1), checkIndex(6, 3));
  assert.equal(taken.state.board[checkIndex(6, 3)], "A");
  assert.equal(taken.state.board[checkIndex(5, 2)], null);
});

test("no pieces or no moves wins, and forty quiet king moves draw", () => {
  const lastPiece = snap(at([
    [checkIndex(4, 1), "a"],
    [checkIndex(3, 2), "b"],
  ]));
  const won = play(lastPiece, checkIndex(4, 1), checkIndex(2, 3));
  assert.equal(won.status, "finished");
  assert.equal(won.winner, "a");
  assert.equal(won.state.wins.a, 1);

  const blocked = snap(at([
    [checkIndex(5, 1), "a"],
    [checkIndex(7, 0), "b"],
  ]));
  const noMoves = play(blocked, checkIndex(5, 1), checkIndex(4, 0));
  assert.equal(noMoves.winner, "a");
  assert.equal(noMoves.status, "finished");

  const shuffling = at([
    [checkIndex(4, 1), "A"],
    [checkIndex(0, 1), "B"],
  ]);
  shuffling.quietKing = 39;
  const drawn = play(snap(shuffling), checkIndex(4, 1), checkIndex(3, 2));
  assert.equal(drawn.status, "finished");
  assert.equal(drawn.winner, "draw");
  assert.equal(drawn.state.draws, 1);
  assert.equal(drawn.state.quietKing, 40);

  const reset = at([
    [checkIndex(5, 1), "a"],
    [checkIndex(0, 1), "B"],
  ]);
  reset.quietKing = 10;
  const manMove = play(snap(reset), checkIndex(5, 1), checkIndex(4, 0));
  assert.equal(manMove.state.quietKing, 0);
  assert.equal(manMove.status, "active");
});
