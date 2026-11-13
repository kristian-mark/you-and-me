import assert from "node:assert/strict";
import test from "node:test";
import { formatPairCode } from "./pair-code.ts";

test("a short invite code is shown in one case", () => {
  assert.equal(formatPairCode("ab12cd"), "AB12CD");
  assert.equal(formatPairCode("  k7m 2qp "), "K7M2QP");
});

test("a pair uuid is not a code", () => {
  assert.equal(formatPairCode("34fbd65a-2434-4bdb-a824-3baadc663af6"), "");
  assert.equal(formatPairCode(""), "");
  assert.equal(formatPairCode("AB"), "");
});
