import { parseQuizAnswers, QUIZ_ANSWER_COUNT } from "./quiz-sync.ts";

export type LocalAccount = {
  ownerId: string | null;
  quizDoneAt?: string | null;
  quizAnswers: number[];
  taskIds: string[];
  wishIds: string[];
  anniversaryDate: string;
};

/** Keep local data only when it is already stamped with this signed-in user. */
export function claimDecision(ownerId: string | null | undefined, userId: string): "keep" | "drop" {
  if (ownerId && ownerId === userId) return "keep";
  return "drop";
}

export function shouldUploadLocalQuiz(input: {
  ownerId: string | null | undefined;
  userId: string | null | undefined;
  localDoneAt?: string | null;
  localAnswers: number[];
  serverHasDone: boolean;
}) {
  if (claimDecision(input.ownerId, input.userId ?? "") === "drop") return false;
  if (!input.userId || input.serverHasDone || !input.localDoneAt) return false;
  return parseQuizAnswers(input.localAnswers) !== null;
}

/**
 * What a sign-in would send to the server from this browser.
 * A different account, or an old unscoped store, sends nothing.
 */
export function uploadsAfterSignIn(local: LocalAccount, userId: string): string[] {
  if (claimDecision(local.ownerId, userId) === "drop") return [];
  const uploads: string[] = [];
  if (
    shouldUploadLocalQuiz({
      ownerId: local.ownerId,
      userId,
      localDoneAt: local.quizDoneAt,
      localAnswers: local.quizAnswers,
      serverHasDone: false,
    })
  ) {
    uploads.push("quiz");
  }
  for (const id of local.taskIds) uploads.push(`task:${id}`);
  for (const id of local.wishIds) uploads.push(`wish:${id}`);
  if (local.anniversaryDate) uploads.push("anniversary");
  return uploads;
}

export function sampleAnswers() {
  return Array.from({ length: QUIZ_ANSWER_COUNT }, (_, index) => index % 4);
}
