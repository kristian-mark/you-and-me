import assert from "node:assert/strict";
import test from "node:test";
import { pairColors } from "./pair-color.ts";

test("unset colors follow the seat: first blue, second pink, on both phones", () => {
  const first = pairColors({ mySeat: "a", myChoice: null, partnerChoice: null });
  const second = pairColors({ mySeat: "b", myChoice: null, partnerChoice: null });
  assert.deepEqual(first, { me: "blue", partner: "pink" });
  assert.deepEqual(second, { me: "pink", partner: "blue" });
});

test("a saved choice stays with that person on both phones", () => {
  const his = pairColors({ mySeat: "a", myChoice: "blue", partnerChoice: "pink" });
  const hers = pairColors({ mySeat: "b", myChoice: "pink", partnerChoice: "blue" });
  assert.equal(his.me, "blue");
  assert.equal(hers.partner, "blue");
  assert.equal(his.partner, "pink");
  assert.equal(hers.me, "pink");
});

test("the same explicit color keeps the first member's pick and flips the second", () => {
  const first = pairColors({ mySeat: "a", myChoice: "pink", partnerChoice: "pink" });
  const second = pairColors({ mySeat: "b", myChoice: "pink", partnerChoice: "pink" });
  assert.deepEqual(first, { me: "pink", partner: "blue" });
  assert.deepEqual(second, { me: "blue", partner: "pink" });
});

test("an explicit choice beats the other person's empty default", () => {
  const first = pairColors({ mySeat: "a", myChoice: null, partnerChoice: "blue" });
  const second = pairColors({ mySeat: "b", myChoice: "blue", partnerChoice: null });
  assert.deepEqual(first, { me: "pink", partner: "blue" });
  assert.deepEqual(second, { me: "blue", partner: "pink" });
});
