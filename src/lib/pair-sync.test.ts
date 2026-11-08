import assert from "node:assert/strict";
import test from "node:test";
import { isNewer, mergeSynced, planRemoteSync } from "./pair-sync.ts";

test("isNewer treats a missing local stamp as older", () => {
  assert.equal(isNewer(undefined, "2026-01-01T00:00:00.000Z"), false);
  assert.equal(isNewer("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), true);
  assert.equal(isNewer("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00+00:00"), false);
});

test("merge keeps the newer local edit and uploads it", () => {
  const merged = mergeSynced(
    [{ id: "a", updatedAt: "2026-02-02T00:00:00.000Z", title: "local" }],
    [{ id: "a", updatedAt: "2026-02-01T00:00:00.000Z", title: "remote" }],
    [],
  );
  assert.equal(merged.next[0]?.title, "local");
  assert.equal(merged.upload.length, 1);
  assert.deepEqual(merged.retryDelete, []);
});

test("merge prefers remote when it is newer and does not upload it", () => {
  const merged = mergeSynced(
    [{ id: "a", updatedAt: "2026-02-01T00:00:00.000Z", title: "local" }],
    [{ id: "a", updatedAt: "2026-02-02T00:00:00.000Z", title: "remote" }],
    [],
  );
  assert.equal(merged.next[0]?.title, "remote");
  assert.equal(merged.upload.length, 0);
});

test("merge uploads a local-only row and retries a local delete", () => {
  const merged = mergeSynced(
    [{ id: "new", updatedAt: "2026-03-01T00:00:00.000Z" }],
    [{ id: "gone", updatedAt: "2026-03-01T00:00:00.000Z", deleted: false }],
    ["gone"],
  );
  assert.deepEqual(merged.next.map((row) => row.id), ["new"]);
  assert.deepEqual(merged.upload.map((row) => row.id), ["new"]);
  assert.deepEqual(merged.retryDelete, ["gone"]);
});

test("a poll plan keeps a newer local edit unmarked and does not describe a write", () => {
  const plan = planRemoteSync(
    [{ id: "a", updatedAt: "2026-02-02T00:00:00.000Z", title: "local" }],
    [{ id: "a", updatedAt: "2026-02-01T00:00:00.000Z", title: "remote" }],
    [],
  );
  assert.equal(plan.next[0]?.title, "local");
  assert.equal(plan.mark.length, 0);
  assert.equal("upload" in plan, false);
  assert.equal("retryDelete" in plan, false);
});

test("a poll plan marks the newer remote row and drops a tombstone", () => {
  const newer = planRemoteSync(
    [{ id: "b", updatedAt: "2026-02-01T00:00:00.000Z", title: "local" }],
    [{ id: "b", updatedAt: "2026-02-02T00:00:00.000Z", title: "remote" }],
    [],
  );
  assert.equal(newer.next[0]?.title, "remote");
  assert.equal(newer.mark[0]?.title, "remote");

  const gone = planRemoteSync(
    [{ id: "c", updatedAt: "2026-04-01T00:00:00.000Z" }],
    [{ id: "c", updatedAt: "2026-04-02T00:00:00.000Z", deleted: true }],
    [],
  );
  assert.equal(gone.next.length, 0);
  assert.equal(gone.mark.length, 0);
  assert.deepEqual(gone.forget, ["c"]);
});

test("a local delete stays out of the poll plan", () => {
  const plan = planRemoteSync([], [{ id: "gone", updatedAt: "2026-03-01T00:00:00.000Z" }], ["gone"]);
  assert.deepEqual(plan.next, []);
  assert.deepEqual(plan.mark, []);
});

test("merge drops tombstones and does not upload them again", () => {
  const merged = mergeSynced(
    [{ id: "a", updatedAt: "2026-04-01T00:00:00.000Z" }],
    [{ id: "a", updatedAt: "2026-04-02T00:00:00.000Z", deleted: true }],
    [],
  );
  assert.equal(merged.next.length, 0);
  assert.equal(merged.upload.length, 0);
  assert.deepEqual(merged.forget, ["a"]);
});
