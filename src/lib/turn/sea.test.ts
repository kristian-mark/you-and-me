import assert from "node:assert/strict";
import test from "node:test";
import { beginSea, fleetIsValid, placeFleet, presentSea, rebaseSeaSetup, seaRules, type SeaState } from "./sea.ts";
import type { TurnSnapshot } from "./engine.ts";

function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function snap(state: SeaState, turn: "a" | "b" | null = "a"): TurnSnapshot<SeaState> {
  return { state, status: "active", turn, winner: null };
}

test("a random fleet never lets ships touch, even diagonally", () => {
  for (let n = 0; n < 30; n += 1) {
    const ships = placeFleet();
    assert.equal(fleetIsValid(ships), true);
  }
});

test("the view for one seat does not contain the other fleet", () => {
  const started = beginSea(seaRules.empty(), "a");
  const view = { state: started.state, status: started.status, turn: started.turn, winner: started.winner };
  const mine = presentSea(view, 3, "a", null);
  const partner = presentSea(view, 3, "b", null);
  assert.equal(mine.target.some((cell) => cell === "ship"), false);
  assert.equal(partner.target.some((cell) => cell === "ship"), false);
  assert.equal(JSON.stringify(mine).includes(JSON.stringify(started.state.shipsB)), false);
  assert.equal(JSON.stringify(partner).includes(JSON.stringify(started.state.shipsA)), false);
  assert.ok(mine.mine.some((cell) => cell === "ship"));
  assert.ok(partner.mine.some((cell) => cell === "ship"));
});

test("a hit keeps the turn, a miss gives it away, and a sunk ship marks the ring as misses", () => {
  const shipsA = [[0, 1, 2, 3]];
  const shipsB = [[55, 56, 57, 58]];
  const state: SeaState = {
    ...seaRules.empty(),
    shipsA,
    shipsB,
    phase: "fight",
    starter: "a",
    readyA: true,
    readyB: true,
  };
  const hit = seaRules.apply({ state, status: "active", turn: "a", winner: null }, "a", { kind: "shot", index: 55 });
  assert.equal(hit.turn, "a");
  assert.equal(hit.state.shotsB[55], "h");
  const miss = seaRules.apply(hit, "a", { kind: "shot", index: 20 });
  assert.equal(miss.turn, "b");
  assert.equal(miss.state.shotsB[20], "m");
  let step = miss;
  step = seaRules.apply({ ...step, turn: "a" }, "a", { kind: "shot", index: 56 });
  step = seaRules.apply(step, "a", { kind: "shot", index: 57 });
  step = seaRules.apply(step, "a", { kind: "shot", index: 58 });
  assert.equal(step.status, "finished");
  assert.equal(step.winner, "a");
  assert.equal(step.state.wins.a, 1);
  assert.equal(step.state.shotsB[55], "s");
  assert.equal(step.state.shotsB[45], "m");
  assert.equal(step.state.shotsB[65], "m");
  const fighting = presentSea({ state: miss.state, status: "active", turn: "b", winner: null }, 3, "a", null);
  assert.equal(fighting.target.some((cell) => cell === "ship"), false);
  const view = presentSea({ state: step.state, status: step.status, turn: step.turn, winner: step.winner }, 4, "b", null);
  assert.equal(view.winner, "partner");
  assert.equal(view.mine[55], "sunk");
  assert.equal(view.target[0], "ship");
  assert.equal(view.target[3], "ship");
});

test("setup can be reshuffled until ready, then the starter shoots first", () => {
  const first = snap({
    ...seaRules.empty(),
    shipsA: placeFleet(rng(3)),
    shipsB: placeFleet(rng(9)),
    starter: "a",
  });
  const shuffled = seaRules.apply(first, "a", { kind: "reshuffle" });
  assert.notDeepEqual(shuffled.state.shipsA, first.state.shipsA);
  assert.deepEqual(shuffled.state.shipsB, first.state.shipsB);
  const readyA = seaRules.apply(shuffled, "a", { kind: "ready" });
  assert.equal(readyA.state.phase, "setup");
  const readyB = seaRules.apply(readyA, "b", { kind: "ready" });
  assert.equal(readyB.state.phase, "fight");
  assert.equal(readyB.turn, "a");
});

test("a setup action still lands after the partner reshuffles on a newer version", () => {
  const start = snap({
    ...seaRules.empty(),
    shipsA: placeFleet(rng(4)),
    shipsB: placeFleet(rng(11)),
    starter: "a",
  });
  const partner = seaRules.apply(start, "b", { kind: "reshuffle" });
  const latest = snap(partner.state, partner.turn);
  const ready = rebaseSeaSetup(latest, "a", { kind: "ready" });
  assert.ok(ready);
  assert.equal(ready.state.readyA, true);
  assert.equal(ready.state.readyB, false);
  assert.deepEqual(ready.state.shipsA, partner.state.shipsA);
  assert.deepEqual(ready.state.shipsB, partner.state.shipsB);
  const both = rebaseSeaSetup(snap(ready.state, ready.turn), "b", { kind: "ready" });
  assert.equal(both?.state.phase, "fight");
  assert.equal(both?.state.readyA, true);
  assert.equal(rebaseSeaSetup(snap(both!.state, "a"), "a", { kind: "shot", index: 0 }), null);
});
