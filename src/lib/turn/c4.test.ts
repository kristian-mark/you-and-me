import assert from "node:assert/strict";
import test from "node:test";
import { TurnRuleError, type Seat, type TurnSnapshot } from "./engine.ts";
import {
  C4_COLS,
  beginC4,
  c4Index,
  c4Result,
  c4Rules,
  c4WinningLine,
  dropC4,
  emptyC4State,
  type C4State,
} from "./c4.ts";

function snap(board: Array<Seat | null>, patch: Partial<TurnSnapshot<C4State>> = {}): TurnSnapshot<C4State> {
  return {
    state: { ...emptyC4State(), board, starter: "a" },
    status: "active",
    turn: "a",
    winner: null,
    ...patch,
  };
}

function fill(marks: string) {
  const board = emptyC4State().board;
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    board[i] = mark === "a" || mark === "b" ? mark : null;
  }
  return board;
}

test("a disc falls to the lowest free cell", () => {
  const first = dropC4(emptyC4State().board, 3, "a");
  assert.equal(first[c4Index(5, 3)], "a");
  const second = dropC4(first, 3, "b");
  assert.equal(second[c4Index(4, 3)], "b");
  assert.equal(second[c4Index(5, 3)], "a");
});

test("a full column is rejected", () => {
  let board = emptyC4State().board;
  for (let n = 0; n < 6; n += 1) board = dropC4(board, 0, n % 2 === 0 ? "a" : "b");
  assert.throws(() => dropC4(board, 0, "a"), (error: unknown) => {
    assert.ok(error instanceof TurnRuleError);
    assert.equal(error.code, "occupied");
    return true;
  });
  assert.throws(() => c4Rules.apply(snap(board, { turn: "a" }), "a", { column: 0 }));
  assert.throws(() => dropC4(board, -1, "a"));
  assert.throws(() => dropC4(board, C4_COLS, "a"));
});

test("only the seated turn may drop a disc", () => {
  const opened = beginC4(emptyC4State(), "b");
  assert.equal(opened.turn, "b");
  assert.equal(opened.state.board.every((cell) => cell === null), true);
  assert.throws(() => c4Rules.apply(opened, "a", { column: 0 }), (error: unknown) => {
    assert.ok(error instanceof TurnRuleError);
    assert.equal(error.code, "turn");
    return true;
  });
});

test("four in a row wins horizontally, vertically, and diagonally", () => {
  const horizontal = fill("aaaab" + ".".repeat(42));
  assert.deepEqual(c4WinningLine(horizontal)?.sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.equal(c4Result(horizontal), "a");

  const vertical = emptyC4State().board;
  for (let row = 2; row <= 5; row += 1) vertical[c4Index(row, 6)] = "b";
  const verticalLine = c4WinningLine(vertical);
  assert.equal(verticalLine?.length, 4);
  assert.equal(c4Result(vertical), "b");
  assert.ok(verticalLine?.every((index) => index % 7 === 6));

  const diagonal = emptyC4State().board;
  diagonal[c4Index(5, 0)] = "a";
  diagonal[c4Index(4, 1)] = "a";
  diagonal[c4Index(3, 2)] = "a";
  diagonal[c4Index(2, 3)] = "a";
  assert.equal(c4Result(diagonal), "a");
  assert.equal(c4WinningLine(diagonal)?.length, 4);

  const other = emptyC4State().board;
  other[c4Index(5, 3)] = "b";
  other[c4Index(4, 2)] = "b";
  other[c4Index(3, 1)] = "b";
  other[c4Index(2, 0)] = "b";
  assert.equal(c4Result(other), "b");
});

test("a finished column sequence records the win and passes no further move", () => {
  let snapshot: TurnSnapshot<C4State> = beginC4(emptyC4State(), "a");
  const moves = [0, 1, 0, 1, 0, 1, 0];
  for (const column of moves) {
    const actor = snapshot.turn;
    assert.ok(actor);
    snapshot = c4Rules.apply(snapshot, actor, { column });
  }
  assert.equal(snapshot.status, "finished");
  assert.equal(snapshot.winner, "a");
  assert.equal(snapshot.state.wins.a, 1);
  assert.equal(c4WinningLine(snapshot.state.board)?.length, 4);
  assert.throws(() => c4Rules.apply(snapshot, "b", { column: 2 }));
});

test("a full board without four is a draw", () => {
  const rows = ["abababa", "bababab", "bababab", "abababa", "abababa", "bababab"];
  const board = emptyC4State().board;
  rows.forEach((line, row) => {
    for (let column = 0; column < 7; column += 1) {
      board[c4Index(row, column)] = line[column] === "a" ? "a" : "b";
    }
  });
  assert.equal(c4WinningLine(board), null);
  assert.equal(c4Result(board), "draw");
});
