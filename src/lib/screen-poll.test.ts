import assert from "node:assert/strict";
import test from "node:test";
import { createPollHub, pollFailureNotice, type PollClock } from "./screen-poll.ts";

function fakeClock(online = true) {
  let now = 0;
  let onlineFlag = online;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: PollClock = {
    isOnline: () => onlineFlag,
    setTimer(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  };
  return {
    clock,
    setOnline(value: boolean) {
      onlineFlag = value;
    },
    timerCount() {
      return timers.size;
    },
    advance(ms: number) {
      now += ms;
      for (;;) {
        let due: { id: number; at: number; fn: () => void } | null = null;
        for (const [id, timer] of timers) {
          if (timer.at <= now && (!due || timer.at < due.at)) due = { id, at: timer.at, fn: timer.fn };
        }
        if (!due) break;
        timers.delete(due.id);
        due.fn();
      }
    },
  };
}

test("a hidden tab does not poll", async () => {
  const time = fakeClock(false);
  const hub = createPollHub(time.clock);
  let calls = 0;
  const release = hub.acquire("tasks", 1_000, async () => {
    calls += 1;
  });
  await hub.settled();
  time.advance(30_000);
  await hub.settled();
  assert.equal(calls, 0);
  assert.equal(time.timerCount(), 0);
  release();
});

test("a visible screen refreshes once, then on its interval", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  const release = hub.acquire("tasks", 1_000, async () => {
    calls += 1;
  });
  await hub.settled();
  assert.equal(calls, 1);
  assert.equal(time.timerCount(), 1);
  time.advance(999);
  await hub.settled();
  assert.equal(calls, 1);
  time.advance(1);
  await hub.settled();
  assert.equal(calls, 2);
  release();
  assert.equal(time.timerCount(), 0);
});

test("hiding clears timers and showing refreshes once", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  hub.acquire("tasks", 5_000, async () => {
    calls += 1;
  });
  await hub.settled();
  assert.equal(calls, 1);
  time.setOnline(false);
  hub.onVisibilityEvent();
  assert.equal(time.timerCount(), 0);
  time.advance(60_000);
  await hub.settled();
  assert.equal(calls, 1);
  time.setOnline(true);
  hub.onVisibilityEvent();
  await hub.settled();
  assert.equal(calls, 2);
  assert.equal(time.timerCount(), 1);
});

test("focus while already visible refreshes once and rearms", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  hub.acquire("ttt", 3_000, async () => {
    calls += 1;
  });
  await hub.settled();
  hub.onVisibilityEvent();
  await hub.settled();
  assert.equal(calls, 2);
  time.advance(2_999);
  await hub.settled();
  assert.equal(calls, 2);
});

test("overlapping refreshes share one request", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  let releaseGate: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  hub.acquire("tasks", 20_000, () => {
    calls += 1;
    return gate;
  });
  hub.onVisibilityEvent();
  const pending = hub.refreshOpenScreens();
  assert.equal(calls, 1);
  releaseGate();
  await pending;
  await hub.settled();
  assert.equal(time.timerCount(), 1);
});

test("two open screens with one key share a timer", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  const first = hub.acquire("tasks", 1_000, async () => {
    calls += 1;
  });
  const second = hub.acquire("tasks", 1_000, async () => {
    calls += 1;
  });
  await hub.settled();
  assert.equal(calls, 1);
  assert.equal(time.timerCount(), 1);
  first();
  time.advance(1_000);
  await hub.settled();
  assert.equal(calls, 2);
  second();
  assert.equal(time.timerCount(), 0);
  time.advance(5_000);
  await hub.settled();
  assert.equal(calls, 2);
});

test("errors wait longer, then a success restores the interval", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  let fail = true;
  hub.acquire("tasks", 1_000, async () => {
    calls += 1;
    if (fail) throw new Error("offline");
  });
  await hub.settled();
  assert.equal(calls, 1);
  time.advance(1_000);
  await hub.settled();
  assert.equal(calls, 1);
  time.advance(1_000);
  await hub.settled();
  assert.equal(calls, 2);
  fail = false;
  time.advance(3_999);
  await hub.settled();
  assert.equal(calls, 2);
  time.advance(1);
  await hub.settled();
  assert.equal(calls, 3);
  time.advance(1_000);
  await hub.settled();
  assert.equal(calls, 4);
});

test("changing the interval does not fetch by itself", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  hub.acquire("pair", 5_000, async () => {
    calls += 1;
  });
  await hub.settled();
  hub.retarget("pair", 4 * 60 * 60 * 1000);
  await hub.settled();
  assert.equal(calls, 1);
  time.advance(5_000);
  await hub.settled();
  assert.equal(calls, 1);
  time.advance(4 * 60 * 60 * 1000 - 5_000);
  await hub.settled();
  assert.equal(calls, 2);
});

test("a few poll misses stay quiet and a repeated miss is shown", () => {
  assert.equal(pollFailureNotice(1, "Не удалось проверить аккаунт"), null);
  assert.equal(pollFailureNotice(3, "Не удалось проверить аккаунт"), null);
  assert.equal(pollFailureNotice(4, "Не удалось проверить аккаунт"), "Не удалось проверить аккаунт");
});

test("refreshOpenScreens is a no-op while hidden and refreshes when visible", async () => {
  const time = fakeClock(true);
  const hub = createPollHub(time.clock);
  let calls = 0;
  hub.acquire("tasks", 20_000, async () => {
    calls += 1;
  });
  await hub.settled();
  time.setOnline(false);
  await hub.refreshOpenScreens();
  assert.equal(calls, 1);
  time.setOnline(true);
  await hub.refreshScreen("tasks");
  assert.equal(calls, 2);
  await hub.refreshScreen("missing");
  assert.equal(calls, 2);
});
