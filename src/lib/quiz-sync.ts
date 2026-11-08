export const QUIZ_ANSWER_COUNT = 32;
export const REMIND_GAP_MS = 86_400_000;

export type StoredQuiz = {
  userId: string;
  answers: number[];
  doneAt: string | null;
  remindedAt: string | null;
};

export type QuizSnapshot = {
  myAnswers: number[];
  myDoneAt: string | null;
  myRemindedAt: string | null;
  partnerDone: boolean;
  partnerDoneAt: string | null;
  partnerRemindedAt: string | null;
  /** Null until both people have finished. Never a partial leak. */
  partnerAnswers: number[] | null;
};

export function parseQuizAnswers(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== QUIZ_ANSWER_COUNT) return null;
  const answers: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 3) return null;
    answers.push(item);
  }
  return answers;
}

/**
 * What one phone is allowed to see. Partner answers are omitted unless both
 * doneAt values are set, even if those answers are already stored.
 */
export function snapshotQuiz(viewerId: string, rows: StoredQuiz[]): QuizSnapshot {
  const mine = rows.find((row) => row.userId === viewerId) ?? null;
  const partner = rows.find((row) => row.userId !== viewerId) ?? null;
  const myDone = Boolean(mine?.doneAt);
  const partnerDone = Boolean(partner?.doneAt);
  return {
    myAnswers: mine?.answers ?? [],
    myDoneAt: mine?.doneAt ?? null,
    myRemindedAt: mine?.remindedAt ?? null,
    partnerDone,
    partnerDoneAt: partnerDone ? (partner?.doneAt ?? null) : null,
    partnerRemindedAt: partner?.remindedAt ?? null,
    partnerAnswers: myDone && partnerDone ? (partner?.answers ?? []) : null,
  };
}

export function canReplaceAnswers(doneAt: string | null) {
  return !doneAt;
}

export function canResetOwn(partnerDone: boolean) {
  return !partnerDone;
}

export function remindAllowed(remindedAt: string | null, now: number) {
  if (!remindedAt) return true;
  const at = Date.parse(remindedAt);
  if (Number.isNaN(at)) return true;
  return now - at >= REMIND_GAP_MS;
}

export function quizNudge(input: {
  myDoneAt?: string | null;
  partnerRemindedAt?: string | null;
  partnerName: string;
}) {
  if (input.myDoneAt || !input.partnerRemindedAt) return null;
  const name = input.partnerName.trim() || "Партнёр";
  return `${name} ждёт тебя в тесте на совместимость`;
}
