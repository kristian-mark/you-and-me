import assert from "node:assert/strict";
import test from "node:test";
import {
  DURAK_CARD_MIN_STEP,
  DURAK_CARD_W,
  beats,
  beginDurak,
  dealDurak,
  durakRules,
  freshDeck,
  handFanStep,
  presentDurak,
  reopenDurak,
  type Card,
  type DurakState,
} from "./durak.ts";
import { TurnRuleError, type TurnSnapshot } from "./engine.ts";

const six: Card = { suit: "h", rank: 6 };
const seven: Card = { suit: "h", rank: 7 };
const ace: Card = { suit: "h", rank: 14 };
const trump6: Card = { suit: "s", rank: 6 };
const trump7: Card = { suit: "s", rank: 7 };
const other: Card = { suit: "d", rank: 10 };

function snap(state: DurakState, turn: "a" | "b"): TurnSnapshot<DurakState> {
  return { state, status: "active", turn, winner: null };
}

function play(state: DurakState, turn: "a" | "b", move: { kind: "play"; index: number } | { kind: "bito" } | { kind: "take" } | { kind: "finish" }) {
  return durakRules.apply(snap(state, turn), turn, move);
}

test("a deal is 36 cards, six each, and the last card is trump", () => {
  const dealt = dealDurak("a", () => 0.3);
  assert.equal(dealt.handA.length, 6);
  assert.equal(dealt.handB.length, 6);
  assert.equal(dealt.deck.length, 24);
  assert.equal(dealt.trump, dealt.deck[dealt.deck.length - 1].suit);
  assert.equal(freshDeck(() => 0.2).length, 36);
  const lowA = dealt.handA.filter((card) => card.suit === dealt.trump).sort((a, b) => a.rank - b.rank)[0];
  const lowB = dealt.handB.filter((card) => card.suit === dealt.trump).sort((a, b) => a.rank - b.rank)[0];
  if (lowA && lowB) assert.equal(dealt.attacker, lowA.rank <= lowB.rank ? "a" : "b");
});

test("beating is higher suit or a trump, and a higher trump wins", () => {
  assert.equal(beats(seven, six, "s"), true);
  assert.equal(beats(six, seven, "s"), false);
  assert.equal(beats(trump6, ace, "s"), true);
  assert.equal(beats(other, six, "s"), false);
  assert.equal(beats(trump7, trump6, "s"), true);
  assert.equal(beats(trump6, trump7, "s"), false);
});

test("adding stops at six and at the defender's hand size", () => {
  const state: DurakState = {
    ...durakRules.empty(),
    trump: "s",
    attacker: "a",
    defender: "b",
    handA: [
      { suit: "c", rank: 6 },
      { suit: "d", rank: 6 },
      { suit: "h", rank: 6 },
      { suit: "s", rank: 6 },
    ],
    handB: [other, { suit: "c", rank: 7 }, { suit: "d", rank: 9 }],
    phase: "attack",
  };
  const first = play(state, "a", { kind: "play", index: state.handA.findIndex((card) => card.rank === 6) });
  assert.equal(first.state.limit, 3);
  assert.equal(first.turn, "b");
  const taking = play(first.state, "b", { kind: "take" });
  let step = taking;
  for (let n = 0; n < 2; n += 1) {
    const index = step.state.handA.findIndex((card) => card.rank === 6);
    step = play(step.state, "a", { kind: "play", index });
  }
  assert.equal(step.state.table.length, 3);
  const extra = step.state.handA.findIndex((card) => card.rank === 6);
  assert.throws(() => play(step.state, "a", { kind: "play", index: extra }), /нельзя/);
});

test("a take lets the attacker throw, then the defender keeps the cards and the attacker draws first", () => {
  const fillers = (suit: Card["suit"], start: number) =>
    Array.from({ length: 4 }, (_, index) => ({ suit, rank: start + index }));
  const state: DurakState = {
    ...durakRules.empty(),
    trump: "s",
    attacker: "a",
    defender: "b",
    handA: [{ suit: "h", rank: 8 }, ...fillers("c", 7)],
    handB: [other, ...fillers("d", 6)],
    deck: [{ suit: "c", rank: 11 }, { suit: "d", rank: 12 }, trump6],
    table: [{ attack: { suit: "d", rank: 8 } }],
    limit: 4,
    phase: "defend",
  };
  const taken = play(state, "b", { kind: "take" });
  const extra = play(taken.state, "a", { kind: "play", index: taken.state.handA.findIndex((card) => card.rank === 8) });
  assert.equal(extra.state.table.length, 2);
  const done = play(extra.state, "a", { kind: "finish" });
  assert.equal(done.state.handB.length, 7);
  assert.ok(done.state.handA.some((card) => card.rank === 11));
  assert.ok(done.state.handB.every((card) => card.rank !== 12));
  assert.equal(done.state.deck.at(-1)?.rank, 6);
  assert.equal(done.state.attacker, "a");
});

test("a successful defense discards, refills the attacker first, and the defender leads next", () => {
  const pad = (suit: Card["suit"]) => Array.from({ length: 4 }, (_, index) => ({ suit, rank: 8 + index }));
  const state: DurakState = {
    ...durakRules.empty(),
    trump: "s",
    attacker: "a",
    defender: "b",
    handA: pad("c"),
    handB: pad("d"),
    deck: [{ suit: "c", rank: 8 }, { suit: "d", rank: 9 }],
    table: [{ attack: six, defend: seven }],
    limit: 1,
    phase: "attack",
  };
  const step = play(state, "a", { kind: "bito" });
  assert.equal(step.state.discard, 2);
  assert.equal(step.state.attacker, "b");
  assert.ok(step.state.handA.some((card) => card.suit === "c" && card.rank === 8));
  assert.ok(step.state.handB.some((card) => card.suit === "d" && card.rank === 9));
  assert.equal(step.turn, "b");
});

test("an empty deck makes the player who runs out first the winner, and both empty a draw", () => {
  const holding: DurakState = {
    ...durakRules.empty(),
    trump: "s",
    attacker: "a",
    defender: "b",
    handA: [],
    handB: [other],
    deck: [],
    table: [{ attack: six, defend: seven }],
    phase: "attack",
  };
  const won = play(holding, "a", { kind: "bito" });
  assert.equal(won.status, "finished");
  assert.equal(won.winner, "a");
  const both: DurakState = { ...holding, handB: [] };
  const drawn = play(both, "a", { kind: "bito" });
  assert.equal(drawn.winner, "draw");
  assert.equal(drawn.state.draws, 1);
});

test("the other hand and the deck order never leave the server", () => {
  const started = beginDurak(durakRules.empty(), "a");
  const view = presentDurak(
    { state: started.state, status: started.status, turn: started.turn, winner: null },
    1,
    "a",
    null,
  );
  const secret = started.state.handB[0];
  assert.equal(view.hand.some((card) => card.suit === secret.suit && card.rank === secret.rank), false);
  assert.equal(view.partnerCards, 6);
  assert.equal(JSON.stringify(view).includes(JSON.stringify(started.state.deck)), false);
  assert.equal(JSON.stringify(view).includes(JSON.stringify(started.state.handB)), false);
});

test("a second new game joins the deal the partner just opened", () => {
  const started = beginDurak(durakRules.empty(), "a");
  const finished: TurnSnapshot<DurakState> = {
    state: { ...started.state, wins: { a: 1, b: 0 } },
    status: "finished",
    turn: null,
    winner: "a",
  };
  assert.equal(reopenDurak(finished), "begin");
  const fresh: TurnSnapshot<DurakState> = {
    state: started.state,
    status: "active",
    turn: started.turn,
    winner: null,
  };
  assert.equal(reopenDurak(fresh), "join");
  assert.equal(fresh.state.handA, started.state.handA);
  assert.equal(fresh.state.handB, started.state.handB);
});

test("бито on the defender's turn names the rule", () => {
  const state: DurakState = {
    ...durakRules.empty(),
    handA: [six],
    handB: [seven],
    table: [{ attack: other }],
    attacker: "a",
    defender: "b",
    phase: "defend",
  };
  assert.throws(() => play(state, "b", { kind: "bito" }), (error: unknown) => {
    assert.ok(error instanceof TurnRuleError);
    assert.equal(error.code, "illegal");
    assert.match(error.message, /Бито/);
    assert.equal(error.message.includes("ход партнёра"), false);
    return true;
  });
});

test("six and eight cards fit a 240px tray, and a very large hand scrolls", () => {
  const tray = 240;
  for (const count of [6, 8]) {
    const step = handFanStep(tray, count);
    const width = DURAK_CARD_W + (count - 1) * step;
    assert.ok(width <= tray + 0.01, `${count} cards span ${width}`);
    assert.ok(step >= DURAK_CARD_MIN_STEP);
  }
  const crowded = handFanStep(tray, 20);
  assert.equal(crowded, DURAK_CARD_MIN_STEP);
  assert.ok(DURAK_CARD_W + 19 * crowded > tray);
});
