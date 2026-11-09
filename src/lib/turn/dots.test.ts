import assert from "node:assert/strict";
import test from "node:test";
import { TurnRuleError, type Seat, type TurnSnapshot } from "./engine.ts";
import {
  DOTS_CELLS,
  beginDots,
  boxIndex,
  dotsResult,
  dotsRules,
  emptyDotsState,
  hIndex,
  vIndex,
  type DotsState,
} from "./dots.ts";

function opened(seat: Seat = "a"): TurnSnapshot<DotsState> {
  const step = beginDots(emptyDotsState(), seat);
  return { state: step.state, status: step.status, turn: step.turn, winner: step.winner };
}

function play(snapshot: TurnSnapshot<DotsState>, kind: "h" | "v", index: number) {
  const actor = snapshot.turn;
  if (!actor) throw new Error("no turn");
  return dotsRules.apply(snapshot, actor, { kind, index });
}

test("a line between empty dots passes the turn", () => {
  const next = play(opened(), "h", hIndex(0, 0));
  assert.equal(next.state.h[hIndex(0, 0)], "a");
  assert.equal(next.turn, "b");
  assert.equal(next.status, "active");
  assert.equal(next.state.boxes.every((box) => box === null), true);
  assert.deepEqual(next.state.last, { kind: "h", index: hIndex(0, 0) });
});

test("the fourth side closes the box and the mover goes again", () => {
  let snapshot = opened();
  snapshot = play(snapshot, "h", hIndex(1, 0));
  snapshot = play(snapshot, "v", vIndex(0, 0));
  snapshot = play(snapshot, "v", vIndex(0, 1));
  snapshot = play(snapshot, "h", hIndex(2, 0));
  const before = snapshot.turn;
  assert.equal(before, "a");
  const next = play(snapshot, "h", hIndex(0, 0));
  assert.equal(next.state.boxes[boxIndex(0, 0)], "a");
  assert.equal(next.turn, "a");
  assert.equal(next.status, "active");
  assert.deepEqual(next.state.last, { kind: "h", index: 0 });
});

test("one line can close two boxes", () => {
  const state = emptyDotsState();
  const draw = (kind: "h" | "v", index: number, seat: Seat) => {
    state[kind][index] = seat;
  };
  draw("h", hIndex(0, 0), "a");
  draw("h", hIndex(1, 0), "b");
  draw("v", vIndex(0, 0), "a");
  draw("h", hIndex(0, 1), "b");
  draw("h", hIndex(1, 1), "a");
  draw("v", vIndex(0, 2), "b");
  state.starter = "a";
  const snapshot: TurnSnapshot<DotsState> = { state, status: "active", turn: "a", winner: null };
  const next = dotsRules.apply(snapshot, "a", { kind: "v", index: vIndex(0, 1) });
  assert.equal(next.state.boxes[boxIndex(0, 0)], "a");
  assert.equal(next.state.boxes[boxIndex(0, 1)], "a");
  assert.equal(next.turn, "a");
});

test("a drawn line and a bad index are rejected", () => {
  const first = play(opened(), "v", vIndex(2, 3));
  assert.throws(() => dotsRules.apply(first, "b", { kind: "v", index: vIndex(2, 3) }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "occupied";
  });
  assert.throws(() => dotsRules.apply(first, "b", { kind: "h", index: -1 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "cell";
  });
  assert.throws(() => dotsRules.apply(first, "b", { kind: "h", index: 20 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "cell";
  });
  assert.throws(() => dotsRules.apply(first, "b", { kind: "v", index: 20 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "cell";
  });
});

test("only the starter may draw the first line", () => {
  const match = opened("b");
  assert.equal(match.turn, "b");
  assert.equal(match.state.h.every((line) => line === null), true);
  assert.throws(() => dotsRules.apply(match, "a", { kind: "h", index: 0 }), (error: unknown) => {
    return error instanceof TurnRuleError && error.code === "turn";
  });
});

test("more boxes wins, an even split is a draw, and a finished match rejects another line", () => {
  const almost = emptyDotsState();
  almost.starter = "a";
  for (let index = 0; index < almost.h.length; index += 1) almost.h[index] = index % 2 === 0 ? "a" : "b";
  for (let index = 0; index < almost.v.length; index += 1) almost.v[index] = "a";
  almost.v[vIndex(3, 4)] = null;
  for (let index = 0; index < DOTS_CELLS; index += 1) almost.boxes[index] = index < 9 ? "a" : "b";
  almost.boxes[boxIndex(3, 3)] = null;
  const winning: TurnSnapshot<DotsState> = { state: almost, status: "active", turn: "b", winner: null };
  const won = dotsRules.apply(winning, "b", { kind: "v", index: vIndex(3, 4) });
  assert.equal(won.status, "finished");
  assert.equal(won.winner, "a");
  assert.equal(won.state.wins.a, 1);
  assert.equal(dotsResult(won.state.boxes, true), "a");
  assert.throws(() => dotsRules.apply(won, "a", { kind: "h", index: 0 }));

  const tied = emptyDotsState();
  tied.starter = "a";
  for (let index = 0; index < tied.h.length; index += 1) tied.h[index] = "a";
  for (let index = 0; index < tied.v.length; index += 1) tied.v[index] = "b";
  tied.v[vIndex(0, 0)] = null;
  for (let index = 0; index < DOTS_CELLS; index += 1) {
    if (index === boxIndex(0, 0)) tied.boxes[index] = null;
    else if (index <= 8) tied.boxes[index] = "a";
    else tied.boxes[index] = "b";
  }
  const draw: TurnSnapshot<DotsState> = { state: tied, status: "active", turn: "b", winner: null };
  const even = dotsRules.apply(draw, "b", { kind: "v", index: vIndex(0, 0) });
  assert.equal(even.winner, "draw");
  assert.equal(even.state.draws, 1);
  assert.equal(even.state.boxes[boxIndex(0, 0)], "b");
});
