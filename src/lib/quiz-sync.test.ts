import assert from "node:assert/strict";
import test from "node:test";
import {
  canReplaceAnswers,
  canResetOwn,
  parseQuizAnswers,
  quizNudge,
  remindAllowed,
  snapshotQuiz,
  type StoredQuiz,
} from "./quiz-sync.ts";

function answers(seed: number) {
  return Array.from({ length: 32 }, (_, i) => (i + seed) % 4);
}

function row(userId: string, seed: number, doneAt: string | null, remindedAt: string | null = null): StoredQuiz {
  return { userId, answers: answers(seed), doneAt, remindedAt };
}

test("partner answers stay hidden until both are done", () => {
  const secret = answers(1);
  const hidden = snapshotQuiz("me", [
    row("me", 0, "2026-11-01T00:00:00.000Z"),
    { userId: "them", answers: secret, doneAt: null, remindedAt: "2026-11-02T00:00:00.000Z" },
  ]);
  assert.equal(hidden.partnerDone, false);
  assert.equal(hidden.partnerAnswers, null);
  assert.equal(JSON.stringify(hidden).includes(JSON.stringify(secret)), false);
  assert.equal(hidden.partnerRemindedAt, "2026-11-02T00:00:00.000Z");

  const waitingOnMe = snapshotQuiz("me", [
    row("me", 0, null),
    { userId: "them", answers: secret, doneAt: "2026-11-02T00:00:00.000Z", remindedAt: null },
  ]);
  assert.equal(waitingOnMe.partnerDone, true);
  assert.equal(waitingOnMe.partnerAnswers, null);
  assert.equal(JSON.stringify(waitingOnMe).includes(JSON.stringify(secret)), false);

  const open = snapshotQuiz("me", [
    row("me", 0, "2026-11-01T00:00:00.000Z"),
    { userId: "them", answers: secret, doneAt: "2026-11-02T00:00:00.000Z", remindedAt: null },
  ]);
  assert.deepEqual(open.partnerAnswers, secret);
});

test("finished answers cannot be replaced, and a reset cannot wipe a finished partner", () => {
  assert.equal(canReplaceAnswers(null), true);
  assert.equal(canReplaceAnswers("2026-11-01T00:00:00.000Z"), false);
  assert.equal(canResetOwn(false), true);
  assert.equal(canResetOwn(true), false);
});

test("a reminder is at most once a day and only nudges someone who has not finished", () => {
  const at = Date.parse("2026-11-08T12:00:00.000Z");
  assert.equal(remindAllowed(null, at), true);
  assert.equal(remindAllowed("2026-11-08T11:00:00.000Z", at), false);
  assert.equal(remindAllowed("2026-11-07T12:00:00.000Z", at), true);
  assert.equal(parseQuizAnswers(answers(2))?.length, 32);
  assert.equal(parseQuizAnswers(answers(2).slice(0, 31)), null);
  assert.equal(
    quizNudge({ myDoneAt: null, partnerRemindedAt: "2026-11-08T00:00:00.000Z", partnerName: "Алина" }),
    "Алина ждёт тебя в тесте на совместимость",
  );
  assert.equal(
    quizNudge({ myDoneAt: "2026-11-08T00:00:00.000Z", partnerRemindedAt: "2026-11-08T00:00:00.000Z", partnerName: "Алина" }),
    null,
  );
});
