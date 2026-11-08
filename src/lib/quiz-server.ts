import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { myPairId } from "@/lib/pair-access";
import { eqFilter, sbDelete, sbInsert, sbPatch, sbSelect } from "@/lib/supabase-app";
import {
  canReplaceAnswers,
  canResetOwn,
  parseQuizAnswers,
  remindAllowed,
  snapshotQuiz,
  type QuizSnapshot,
  type StoredQuiz,
} from "@/lib/quiz-sync";

type Row = {
  pair_id: string;
  user_id: string;
  answers: unknown;
  done_at: string | null;
  reminded_at: string | null;
};

function stored(row: Row): StoredQuiz {
  return {
    userId: row.user_id,
    answers: parseQuizAnswers(row.answers) ?? [],
    doneAt: row.done_at,
    remindedAt: row.reminded_at,
  };
}

async function rowsOf(pairId: string) {
  return sbSelect<Row>("app_quiz", `${eqFilter("pair_id", pairId)}&select=*`);
}

async function readQuiz(userId: string): Promise<QuizSnapshot> {
  const pairId = await myPairId(userId);
  if (!pairId) return snapshotQuiz(userId, []);
  const rows = await rowsOf(pairId);
  return snapshotQuiz(userId, rows.map(stored));
}

export const loadCoupleQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<QuizSnapshot> => readQuiz(context.userId));

export const submitCoupleQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const answers = parseQuizAnswers(input);
    if (!answers) throw new Error("Нужны все 32 ответа");
    return answers;
  })
  .handler(async ({ context, data }): Promise<QuizSnapshot> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) throw new Error("Сначала соединитесь парой");
    const mine = (await rowsOf(pairId)).map(stored).find((row) => row.userId === context.userId) ?? null;
    if (!canReplaceAnswers(mine?.doneAt ?? null)) throw new Error("Ответы уже отправлены");
    const now = new Date().toISOString();
    const body = { answers: data, done_at: now };
    if (mine) {
      await sbPatch("app_quiz", `${eqFilter("pair_id", pairId)}&${eqFilter("user_id", context.userId)}`, body);
    } else {
      await sbInsert("app_quiz", { pair_id: pairId, user_id: context.userId, ...body });
    }
    return readQuiz(context.userId);
  });

export const remindCoupleQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<QuizSnapshot> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) throw new Error("Сначала соединитесь парой");
    const mine = (await rowsOf(pairId)).map(stored).find((row) => row.userId === context.userId) ?? null;
    if (!mine?.doneAt) throw new Error("Сначала отправь ответы");
    if (!remindAllowed(mine.remindedAt, Date.now())) return readQuiz(context.userId);
    await sbPatch(
      "app_quiz",
      `${eqFilter("pair_id", pairId)}&${eqFilter("user_id", context.userId)}`,
      { reminded_at: new Date().toISOString() },
    );
    return readQuiz(context.userId);
  });

export const resetCoupleQuiz = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<QuizSnapshot> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return snapshotQuiz(context.userId, []);
    const current = await readQuiz(context.userId);
    if (!canResetOwn(current.partnerDone)) {
      throw new Error("Общий результат не сбрасывается в одиночку");
    }
    await sbDelete("app_quiz", `${eqFilter("pair_id", pairId)}&${eqFilter("user_id", context.userId)}`);
    return readQuiz(context.userId);
  });
