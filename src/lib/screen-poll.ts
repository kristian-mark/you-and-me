import { useEffect, useRef } from "react";

/** Tasks, wishes, calendar, and any other synced list. */
export const LIST_POLL_MS = 20_000;
/** Tic-tac-toe, only while that screen is mounted. */
export const GAME_POLL_MS = 3_000;
/** Invite screen: partner has not joined yet. */
export const PAIR_WAIT_POLL_MS = 5_000;
/** Paired profile: names, birthdays, together date, join/leave. */
export const PAIR_POLL_MS = 4 * 60 * 60 * 1000;

const BACKOFF_CAP = 4;

/** A background refresh stays quiet until this many misses in a row. */
export const POLL_NOTICE_AFTER_FAILURES = 4;

/** Null while a blip should retry unseen. The message after repeated misses. */
export function pollFailureNotice(failures: number, message: string): string | null {
  if (failures < POLL_NOTICE_AFTER_FAILURES) return null;
  return message;
}

export type PollClock = {
  isOnline: () => boolean;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
};

type Refresh = () => Promise<unknown>;

type Slot = {
  key: string;
  intervalMs: number;
  refreshers: Set<Refresh>;
  timer: number | null;
  inflight: Promise<void> | null;
  failures: number;
  idle: Promise<void>;
};

/**
 * One scheduler for every screen poll.
 * Online means the tab is visible (`document.visibilityState === "visible"`).
 * Hidden, backgrounded, or covered: every timer is cleared. The next
 * visible / focus / pageshow event refreshes the open screens once, then
 * the intervals start again.
 * A future push notification should call `refreshOpenScreens()` — it does
 * not start its own timer.
 */
export function createPollHub(clock: PollClock) {
  const slots = new Map<string, Slot>();

  function delay(slot: Slot) {
    const factor = slot.failures === 0 ? 1 : Math.min(BACKOFF_CAP, 2 ** slot.failures);
    return slot.intervalMs * factor;
  }

  function disarm(slot: Slot) {
    if (slot.timer == null) return;
    clock.clearTimer(slot.timer);
    slot.timer = null;
  }

  function arm(slot: Slot) {
    disarm(slot);
    if (slot.refreshers.size === 0 || !clock.isOnline()) return;
    slot.timer = clock.setTimer(() => {
      slot.timer = null;
      void wake(slot);
    }, delay(slot));
  }

  function execute(slot: Slot): Promise<void> {
    if (slot.inflight) return slot.inflight;
    const job = (async () => {
      const refresh = slot.refreshers.values().next().value;
      if (!refresh) return;
      try {
        await refresh();
        slot.failures = 0;
      } catch {
        slot.failures = Math.min(slot.failures + 1, 2);
      }
    })().finally(() => {
      if (slot.inflight === job) slot.inflight = null;
    });
    slot.inflight = job;
    return job;
  }

  function wake(slot: Slot): Promise<void> {
    if (slot.refreshers.size === 0) return Promise.resolve();
    if (!clock.isOnline()) {
      disarm(slot);
      return Promise.resolve();
    }
    disarm(slot);
    const pending = execute(slot).finally(() => {
      if (slot.refreshers.size > 0 && clock.isOnline() && slots.get(slot.key) === slot) arm(slot);
    });
    slot.idle = pending;
    return pending;
  }

  function acquire(key: string, intervalMs: number, refresh: Refresh) {
    let slot = slots.get(key);
    if (!slot) {
      slot = {
        key,
        intervalMs,
        refreshers: new Set(),
        timer: null,
        inflight: null,
        failures: 0,
        idle: Promise.resolve(),
      };
      slots.set(key, slot);
    }
    slot.refreshers.add(refresh);
    if (clock.isOnline()) void wake(slot);
    return () => {
      const current = slots.get(key);
      if (!current) return;
      current.refreshers.delete(refresh);
      if (current.refreshers.size === 0) {
        disarm(current);
        slots.delete(key);
      }
    };
  }

  function retarget(key: string, intervalMs: number) {
    const slot = slots.get(key);
    if (!slot || slot.intervalMs === intervalMs) return;
    slot.intervalMs = intervalMs;
    if (slot.timer != null) arm(slot);
  }

  function refreshOpenScreens() {
    if (!clock.isOnline()) return Promise.resolve();
    return Promise.all([...slots.values()].map((slot) => wake(slot))).then(() => undefined);
  }

  function refreshScreen(key: string) {
    if (!clock.isOnline()) return Promise.resolve();
    const slot = slots.get(key);
    return slot ? wake(slot) : Promise.resolve();
  }

  /** Visible, focus, or pageshow. Hidden clears timers and does not fetch. */
  function onVisibilityEvent() {
    if (!clock.isOnline()) {
      for (const slot of slots.values()) disarm(slot);
      return;
    }
    for (const slot of slots.values()) void wake(slot);
  }

  function settled() {
    return Promise.all([...slots.values()].map((slot) => slot.idle)).then(() => undefined);
  }

  function timerCount() {
    let count = 0;
    for (const slot of slots.values()) if (slot.timer != null) count += 1;
    return count;
  }

  return { acquire, retarget, refreshOpenScreens, refreshScreen, onVisibilityEvent, settled, timerCount };
}

function browserOnline() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

const browserHub = createPollHub({
  isOnline: browserOnline,
  setTimer: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
  clearTimer: (id) => window.clearTimeout(id),
});

let listening = false;

function ensureBrowserEvents() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", browserHub.onVisibilityEvent);
  window.addEventListener("focus", browserHub.onVisibilityEvent);
  window.addEventListener("pageshow", browserHub.onVisibilityEvent);
}

/**
 * Poll `refresh` while this screen is mounted and the tab is visible.
 * Concurrent calls for the same `key` share one request and one timer.
 * Failures wait 2×, then 4× the interval, then the pace returns after a success.
 */
export function useScreenPoll(key: string, enabled: boolean, intervalMs: number, refresh: Refresh) {
  const refreshRef = useRef(refresh);
  const intervalRef = useRef(intervalMs);
  refreshRef.current = refresh;
  intervalRef.current = intervalMs;

  useEffect(() => {
    ensureBrowserEvents();
    if (!enabled) return;
    return browserHub.acquire(key, intervalRef.current, () => refreshRef.current());
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return;
    browserHub.retarget(key, intervalMs);
  }, [key, enabled, intervalMs]);
}

/** Immediate refresh of every open screen. No-op while the tab is hidden. */
export function refreshOpenScreens() {
  return browserHub.refreshOpenScreens();
}

/** Immediate refresh of one open screen. No-op while the tab is hidden. */
export function refreshScreen(key: string) {
  return browserHub.refreshScreen(key);
}
