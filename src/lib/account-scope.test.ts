import assert from "node:assert/strict";
import test from "node:test";
import { sampleAnswers, shouldUploadLocalQuiz, uploadsAfterSignIn, type LocalAccount } from "./account-scope.ts";

function previousUser(): LocalAccount {
  return {
    ownerId: "user-a",
    quizDoneAt: "2026-11-08T12:00:00.000Z",
    quizAnswers: sampleAnswers(),
    taskIds: ["task-a"],
    wishIds: ["wish-a"],
    anniversaryDate: "2020-03-01",
  };
}

test("switching accounts on one device never uploads the previous user's data", () => {
  const local = previousUser();
  assert.deepEqual(uploadsAfterSignIn(local, "user-b"), []);
  assert.deepEqual(uploadsAfterSignIn({ ...local, ownerId: null }, "user-b"), []);
  assert.equal(
    shouldUploadLocalQuiz({
      ownerId: null,
      userId: "user-b",
      localDoneAt: local.quizDoneAt,
      localAnswers: local.quizAnswers,
      serverHasDone: false,
    }),
    false,
  );
  assert.equal(
    shouldUploadLocalQuiz({
      ownerId: "user-a",
      userId: "user-b",
      localDoneAt: local.quizDoneAt,
      localAnswers: local.quizAnswers,
      serverHasDone: false,
    }),
    false,
  );
});

test("the same account can still upload its own finished quiz and local rows", () => {
  const uploads = uploadsAfterSignIn(previousUser(), "user-a");
  assert.deepEqual(uploads, ["quiz", "task:task-a", "wish:wish-a", "anniversary"]);
});
