/**
 * A poll that started before «Прочитать все», or while that write is still
 * in flight, must not paint the old unread count back onto the bell.
 */
let epoch = 0;
let holds = 0;

export function beginActivityClear() {
  epoch += 1;
  holds += 1;
}

export function finishActivityClear() {
  holds = Math.max(0, holds - 1);
}

export function activityStamp() {
  return { epoch, holds };
}

export function activityResultIsStale(started: { epoch: number; holds: number }) {
  return holds > 0 || started.holds > 0 || epoch !== started.epoch;
}
