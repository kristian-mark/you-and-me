import assert from "node:assert/strict";
import test from "node:test";
import { activityResultIsStale, activityStamp, beginActivityClear, finishActivityClear } from "./activity-gate.ts";

test("a poll that started before mark-all cannot restore the badge", () => {
  const started = activityStamp();
  beginActivityClear();
  assert.equal(activityResultIsStale(started), true);
  finishActivityClear();
  assert.equal(activityResultIsStale(started), true);
  assert.equal(activityResultIsStale(activityStamp()), false);
});

test("a poll that starts while mark-all is still saving stays stale", () => {
  beginActivityClear();
  const started = activityStamp();
  finishActivityClear();
  assert.equal(activityResultIsStale(started), true);
  assert.equal(activityResultIsStale(activityStamp()), false);
});
