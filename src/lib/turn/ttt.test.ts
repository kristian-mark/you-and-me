import assert from "node:assert/strict";
import test from "node:test";
import { assertCanAct, TurnRuleError, type Seat, type TurnSnapshot, type TurnStep } from "./engine.ts";
import {
  beginTtt,
  emptyTttState,
  newTttMatch,
  presentTtt,
  readTttState,
  tttBanner,
  tttResult,
  tttRules,
  tttWinningLine,
  type TttState,
} from "./ttt.ts";

function snap(patch: Partial<TurnSnapshot<TttState>> = {}): TurnSnapshot<TttState> {
  return {
    state: emptyTttState(),
    status: "idle",
    turn: null,
    winner: null,
    ...patch,
  };
}

function asSnap(step: TurnStep<TttState>): TurnSnapshot<TttState> {
  return { state: step.state, status: step.status, turn: step.turn, winner: step.winner };
}

function play(snapshot: TurnSnapshot<TttState>, actor: Seat, cell: number) {
  const ready = snapshot.status === "idle" ? asSnap(beginTtt(snapshot.state, actor)) : snapshot;
  return tttRules.apply(ready, actor, { cell });
}

function cells(spec: string): Array<Seat | null> {
  return spec.split("").map((mark) => (mark === "a" || mark === "b" ? mark : null));
}

test("starting a match gives that seat the first move on an empty board", () => {
  for (const starter of ["a", "b"] as const) {
    const opened = beginTtt(emptyTttState(), starter);
    assert.equal(opened.status, "active");
    assert.equal(opened.turn, starter);
    assert.equal(opened.state.starter, starter);
    assert.equal(
      opened.state.board.every((cell) => cell === null),
      true,
    );
    const other = starter === "a" ? "b" : "a";
    assert.throws(() => tttRules.apply(asSnap(opened), other, { cell: 0 }), (error: unknown) => {
      assert.ok(error instanceof TurnRuleError);
      assert.equal(error.code, "turn");
      return true;
    });
  }
});

test("either partner can open an idle match and then must wait", () => {
  for (const starter of ["a", "b"] as const) {
    const opened = play(snap(), starter, 4);
    assert.equal(opened.status, "active");
    assert.equal(opened.turn, starter === "a" ? "b" : "a");
    assert.equal(opened.state.starter, starter);
    assert.equal(opened.state.board[4], starter);
    assert.throws(
      () => play(opened, starter, 0),
      (error: unknown) => {
        assert.ok(error instanceof TurnRuleError);
        assert.equal(error.code, "turn");
        return true;
      },
    );
    const reply = play(opened, opened.turn as Seat, 0);
    assert.equal(reply.turn, starter);
    assert.equal(reply.state.board[0], opened.turn);
  }
});

test("a move does not change the snapshot it was given", () => {
  const state = emptyTttState();
  const snapshot = snap({ state });
  play(snapshot, "a", 0);
  assert.equal(snapshot.status, "idle");
  assert.equal(state.board[0], null);
  assert.equal(snapshot.state.wins.a, 0);
});

test("occupied cells, bad indexes, and finished matches are rejected", () => {
  const opened = play(snap(), "a", 0);
  assert.throws(
    () => play(opened, "b", 0),
    (error: unknown) => {
      assert.ok(error instanceof TurnRuleError);
      assert.equal(error.code, "occupied");
      return true;
    },
  );
  assert.equal(opened.state.board[0], "a");
  for (const cell of [-1, 9, 1.5]) {
    assert.throws(
      () => play(opened, "b", cell),
      (error: unknown) => {
        assert.ok(error instanceof TurnRuleError);
        assert.equal(error.code, "cell");
        return true;
      },
    );
  }
  const finished = play(
    snap({
      state: { ...emptyTttState(), board: cells("aa-bb----"), starter: "a" },
      status: "active",
      turn: "a",
    }),
    "a",
    2,
  );
  assert.equal(finished.status, "finished");
  assert.throws(
    () => play(finished, "b", 5),
    (error: unknown) => {
      assert.ok(error instanceof TurnRuleError);
      assert.equal(error.code, "finished");
      return true;
    },
  );
});

test("detects every winning line", () => {
  const winners = [
    "aaa------",
    "---aaa---",
    "------aaa",
    "a--a--a--",
    "-a--a--a-",
    "--a--a--a",
    "a---a---a",
    "--a-a-a--",
  ];
  for (const board of winners) {
    const cellsOn = cells(board);
    assert.equal(tttResult(cellsOn), "a");
    assert.ok(tttWinningLine(cellsOn)?.every((index) => cellsOn[index] === "a"));
  }
  assert.equal(tttResult(cells("bbb------")), "b");
});

test("a full board with a line is a win, and without one is a draw", () => {
  const won = play(
    snap({
      state: {
        ...emptyTttState(),
        board: cells("ababbaba-"),
        starter: "a",
        wins: { a: 1, b: 2 },
        draws: 3,
      },
      status: "active",
      turn: "a",
    }),
    "a",
    8,
  );
  assert.equal(won.winner, "a");
  assert.equal(won.status, "finished");
  assert.equal(won.turn, null);
  assert.deepEqual(won.state.wins, { a: 2, b: 2 });
  assert.equal(won.state.draws, 3);

  const drawn = tttResult(cells("abaabbbaa"));
  assert.equal(drawn, "draw");
  const drawStep = play(
    snap({
      state: { ...emptyTttState(), board: cells("abaabbba-"), starter: "a" },
      status: "active",
      turn: "a",
    }),
    "a",
    8,
  );
  assert.equal(drawStep.winner, "draw");
  assert.equal(drawStep.state.draws, 1);
  assert.deepEqual(drawStep.state.wins, { a: 0, b: 0 });
});

test("a played-out draw and a played-out win follow the turn order", () => {
  let snapshot = snap();
  const drawMoves: Array<[Seat, number]> = [
    ["a", 0],
    ["b", 1],
    ["a", 2],
    ["b", 4],
    ["a", 3],
    ["b", 5],
    ["a", 7],
    ["b", 6],
    ["a", 8],
  ];
  for (const [actor, cell] of drawMoves) {
    assert.equal(snapshot.status === "idle" || snapshot.turn === actor, true);
    snapshot = play(snapshot, actor, cell);
  }
  assert.equal(snapshot.winner, "draw");
  assert.equal(
    snapshot.state.board.every((cell) => cell !== null),
    true,
  );

  snapshot = snap();
  const winMoves: Array<[Seat, number]> = [
    ["a", 0],
    ["b", 3],
    ["a", 1],
    ["b", 4],
    ["a", 2],
  ];
  for (const [actor, cell] of winMoves) snapshot = play(snapshot, actor, cell);
  assert.equal(snapshot.winner, "a");
  assert.deepEqual(tttWinningLine(snapshot.state.board), [0, 1, 2]);
  assert.throws(
    () => play(snapshot, "a", 8),
    (error: unknown) => {
      assert.ok(error instanceof TurnRuleError);
      assert.equal(error.code, "finished");
      return true;
    },
  );
});

test("a new match keeps the score and lets either seat start again", () => {
  const finished = play(
    snap({
      state: { ...emptyTttState(), board: cells("aa-bb----"), starter: "a" },
      status: "active",
      turn: "a",
    }),
    "a",
    2,
  );
  const again = newTttMatch(finished.state);
  assert.deepEqual(again.wins, finished.state.wins);
  assert.equal(again.starter, null);
  assert.equal(
    again.board.every((cell) => cell === null),
    true,
  );
  const reopened = play(snap({ state: again }), "b", 8);
  assert.equal(reopened.state.starter, "b");
  assert.equal(reopened.turn, "a");
  assert.equal(reopened.state.wins.a, 1);
});

test("turn gate blocks idle and the waiting seat", () => {
  assert.throws(() => assertCanAct({ status: "idle", turn: null }, "a"));
  assert.throws(() => assertCanAct({ status: "idle", turn: null }, "b"));
  assert.throws(
    () => assertCanAct({ status: "active", turn: "b" }, "a"),
    (error: unknown) => {
      assert.ok(error instanceof TurnRuleError);
      assert.equal(error.code, "turn");
      return true;
    },
  );
  assert.doesNotThrow(() => assertCanAct({ status: "active", turn: "b" }, "b"));
});

test("stored state must be a real board", () => {
  const saved = play(snap(), "a", 1).state;
  assert.deepEqual(readTttState(JSON.stringify(saved)), saved);
  assert.throws(() => readTttState({ board: ["a"], starter: "a", wins: { a: 0, b: 0 }, draws: 0 }));
  assert.throws(() =>
    readTttState({ board: Array(9).fill("x"), starter: "a", wins: { a: 0, b: 0 }, draws: 0 }),
  );
});

test("the board is shown from the caller's seat", () => {
  const opened = play(snap(), "a", 0);
  const mine = presentTtt(opened, 1, "a", null);
  const theirs = presentTtt(opened, 1, "b", null);
  assert.equal(mine.board[0], "me");
  assert.equal(theirs.board[0], "partner");
  assert.equal(mine.myTurn, false);
  assert.equal(theirs.myTurn, true);
  assert.equal(mine.youAreCrosses, true);
  assert.equal(theirs.youAreCrosses, false);
  assert.equal(tttWinningLine(opened.state.board), null);
});

test("banner uses the couple's turn and result words", () => {
  assert.equal(tttBanner({ status: "idle", myTurn: false, winner: null }).title, "Новая партия");
  const started = readTttState({
    board: Array(9).fill(null),
    starter: "a",
    wins: { a: 0, b: 0 },
    draws: 0,
  });
  assert.equal(started.starter, "a");
  assert.equal(
    started.board.every((cell) => cell === null),
    true,
  );
  assert.equal(tttBanner({ status: "active", myTurn: true, winner: null }).title, "Твой ход");
  assert.equal(tttBanner({ status: "active", myTurn: false, winner: null }).title, "Ход партнёра");
  assert.equal(tttBanner({ status: "finished", myTurn: false, winner: "me" }).title, "Победа");
  assert.equal(
    tttBanner({ status: "finished", myTurn: false, winner: "partner" }).title,
    "Поражение",
  );
  assert.equal(tttBanner({ status: "finished", myTurn: false, winner: "draw" }).title, "Ничья");
});
