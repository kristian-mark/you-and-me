import { parseQuizAnswers, QUIZ_ANSWER_COUNT } from "./quiz-sync.ts";

export type LocalAccount = {
  ownerId: string | null;
  quizDoneAt?: string | null;
  quizAnswers: number[];
  taskIds: string[];
  wishIds: string[];
  anniversaryDate: string;
};

/**
 * Missing owner is a legacy phone: adopt it for whoever is signed in.
 * A different owner is someone else's data and must be dropped.
 */
export function claimDecision(ownerId: string | null | undefined, userId: string): "keep" | "adopt" | "drop" {
  if (!ownerId) return "adopt";
  if (ownerId === userId) return "keep";
  return "drop";
}

export function shouldUploadLocalQuiz(input: {
  ownerId: string | null | undefined;
  userId: string | null | undefined;
  localDoneAt?: string | null;
  localAnswers: number[];
  serverHasDone: boolean;
}) {
  if (!input.ownerId || !input.userId || input.ownerId !== input.userId) return false;
  if (input.serverHasDone || !input.localDoneAt) return false;
  return parseQuizAnswers(input.localAnswers) !== null;
}

/**
 * What a sign-in would send to the server from this browser.
 * Another account sends nothing. A legacy store keeps its rows, but not a finished quiz.
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
