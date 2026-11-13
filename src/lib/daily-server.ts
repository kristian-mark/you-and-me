import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { membershipOf } from "@/lib/pair-access";
import { assertSafeId, eqFilter, sbInsert, sbPatch, sbSelect } from "@/lib/supabase-app";
import {
  advanceDaily,
  canSkipDaily,
  isPlaceholderPartnerAnswer,
  pairDayKey,
  placeDailyAnswer,
  snapshotDaily,
  skippedQuestion,
  type DailyAnswerRow,
  type DailyOpen,
  type DailySnapshot,
} from "@/lib/daily-sync";

type OpenRow = {
  pair_id: string;
  day_key: string;
  question_id: string;
  skipped_ids: unknown;
  updated_at?: string;
};

type AnswerRow = {
  pair_id: string;
  day_key: string;
  user_id: string;
  question_id: string;
  body: string;
  answered_at: string;
};

function parseSkipped(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 16);
}

function toOpen(row: OpenRow): DailyOpen {
  return {
    dayKey: String(row.day_key).slice(0, 10),
    questionId: row.question_id,
    skippedIds: parseSkipped(row.skipped_ids),
  };
}

function toAnswer(row: AnswerRow): DailyAnswerRow {
  return {
    userId: row.user_id,
    dayKey: String(row.day_key).slice(0, 10),
    questionId: row.question_id,
    body: row.body,
    answeredAt: row.answered_at,
  };
}

function memberIds(pair: { a_user_id: string; b_user_id: string | null } | null) {
  if (!pair) return [];
  return [pair.a_user_id, pair.b_user_id].filter((id): id is string => Boolean(id));
}

async function loadRows(pairId: string) {
  const openRows = await sbSelect<OpenRow>(
    "app_daily_open",
    `${eqFilter("pair_id", pairId)}&select=pair_id,day_key,question_id,skipped_ids,updated_at`,
  );
  const answerRows = await sbSelect<AnswerRow>(
    "app_daily_answers",
    `${eqFilter("pair_id", pairId)}&select=pair_id,day_key,user_id,question_id,body,answered_at&order=day_key.desc`,
  );
  return { open: openRows[0] ? toOpen(openRows[0]) : null, answers: answerRows.map(toAnswer) };
}

async function resolveOpen(
  pairId: string,
  members: string[],
  now: Date,
): Promise<{ open: DailyOpen; answers: DailyAnswerRow[] }> {
  const safePair = assertSafeId(pairId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadRows(safePair);
    const plan = advanceDaily({
      now,
      open: loaded.open,
      answers: loaded.answers,
      memberIds: members,
    });
    if (!plan.changed) return { open: plan.open, answers: loaded.answers };
    if (!loaded.open) {
      try {
        await sbInsert("app_daily_open", {
          pair_id: safePair,
          day_key: plan.open.dayKey,
          question_id: plan.open.questionId,
          skipped_ids: plan.open.skippedIds,
        });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
      }
      continue;
    }
    const patched = await sbPatch(
      "app_daily_open",
      `${eqFilter("pair_id", safePair)}&${eqFilter("day_key", loaded.open.dayKey)}`,
      {
        day_key: plan.open.dayKey,
        question_id: plan.open.questionId,
        skipped_ids: plan.open.skippedIds,
        updated_at: new Date().toISOString(),
      },
    );
    if (patched.length) return { open: plan.open, answers: loaded.answers };
  }
  const loaded = await loadRows(safePair);
  if (!loaded.open) throw new Error("Вопрос дня не открылся");
  return { open: loaded.open, answers: loaded.answers };
}

function viewOf(userId: string, partnerId: string | null, open: DailyOpen, answers: DailyAnswerRow[]) {
  return snapshotDaily({ viewerId: userId, partnerId, open, answers });
}

async function readDaily(userId: string): Promise<DailySnapshot> {
  const me = await membershipOf(userId);
  const pair = me?.pair ?? null;
  const pairId = me?.pairId ?? null;
  if (!pair || !pairId) {
    const open = advanceDaily({
      now: new Date(),
      open: null,
      answers: [],
      memberIds: [userId],
    }).open;
    return viewOf(userId, null, open, []);
  }
  const members = memberIds(pair);
  const partnerId = members.find((id) => id !== userId) ?? null;
  const resolved = await resolveOpen(pairId, members, new Date());
  return viewOf(userId, partnerId, resolved.open, resolved.answers);
}

function parseSubmit(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Пустой ответ");
  const raw = input as { body?: unknown; answeredAt?: unknown; dayKey?: unknown; questionId?: unknown };
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!body || body.length > 4000) throw new Error("Нужен ответ, короче 4000 знаков");
  if (isPlaceholderPartnerAnswer(body)) throw new Error("Это не ответ");
  const dayKey = raw.dayKey == null || raw.dayKey === "" ? null : raw.dayKey;
  const questionId = raw.questionId == null || raw.questionId === "" ? null : raw.questionId;
  if (typeof dayKey === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error("Некорректная дата");
  if (dayKey != null && typeof dayKey !== "string") throw new Error("Некорректная дата");
  if (typeof questionId === "string" && (questionId.length < 1 || questionId.length > 16)) {
    throw new Error("Не тот вопрос");
  }
  if (questionId != null && typeof questionId !== "string") throw new Error("Не тот вопрос");
  if (Boolean(dayKey) !== Boolean(questionId)) throw new Error("Не тот вопрос");
  let answeredAt: string | null = null;
  if (typeof raw.answeredAt === "string" && raw.answeredAt) {
    const at = Date.parse(raw.answeredAt);
    const now = Date.now();
    if (!Number.isNaN(at) && at <= now + 120_000 && at >= now - 400 * 86_400_000) {
      answeredAt = new Date(at).toISOString();
    }
  }
  return {
    body,
    answeredAt,
    dayKey: typeof dayKey === "string" ? dayKey : null,
    questionId: typeof questionId === "string" ? questionId : null,
  };
}

export const loadCoupleDaily = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DailySnapshot> => readDaily(context.userId));

export const submitCoupleDaily = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseSubmit)
  .handler(async ({ context, data }): Promise<DailySnapshot> => {
    const me = await membershipOf(context.userId);
    if (!me?.pair || !me.pairId) throw new Error("Сначала соединитесь парой");
    const members = memberIds(me.pair);
    const now = new Date();
    const resolved = await resolveOpen(me.pairId, members, now);
    const placed =
      data.dayKey && data.questionId
        ? placeDailyAnswer({
            open: resolved.open,
            answers: resolved.answers,
            dayKey: data.dayKey,
            questionId: data.questionId,
            today: pairDayKey(now),
          })
        : { dayKey: resolved.open.dayKey, questionId: resolved.open.questionId, retarget: false };
    if (!placed) throw new Error("Не тот вопрос");
    const pairKey = assertSafeId(me.pairId);
    if (placed.retarget) {
      await sbPatch(
        "app_daily_open",
        `${eqFilter("pair_id", pairKey)}&${eqFilter("day_key", resolved.open.dayKey)}&${eqFilter("question_id", resolved.open.questionId)}`,
        {
          day_key: placed.dayKey,
          question_id: placed.questionId,
          skipped_ids: [],
          updated_at: now.toISOString(),
        },
      );
    }
    const mine = resolved.answers.find(
      (row) =>
        row.userId === context.userId &&
        row.dayKey === placed.dayKey &&
        row.body.trim() &&
        !isPlaceholderPartnerAnswer(row.body),
    );
    if (!mine) {
      try {
        await sbInsert("app_daily_answers", {
          pair_id: pairKey,
          day_key: placed.dayKey,
          user_id: context.userId,
          question_id: placed.questionId,
          body: data.body,
          answered_at: data.answeredAt ?? now.toISOString(),
        });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
      }
    }
    return readDaily(context.userId);
  });

export const skipCoupleDaily = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DailySnapshot> => {
    const me = await membershipOf(context.userId);
    if (!me?.pair || !me.pairId) throw new Error("Сначала соединитесь парой");
    const members = memberIds(me.pair);
    const partnerId = members.find((id) => id !== context.userId) ?? null;
    const resolved = await resolveOpen(me.pairId, members, new Date());
    if (!canSkipDaily(resolved.open, resolved.answers)) {
      throw new Error("Уже есть ответ — вопрос не пропускается");
    }
    const next = skippedQuestion(resolved.open);
    if (next.questionId === resolved.open.questionId) throw new Error("Дальше вопросов нет");
    await sbPatch(
      "app_daily_open",
      `${eqFilter("pair_id", assertSafeId(me.pairId))}&${eqFilter("day_key", resolved.open.dayKey)}&${eqFilter("question_id", resolved.open.questionId)}`,
      {
        question_id: next.questionId,
        skipped_ids: next.skippedIds,
        updated_at: new Date().toISOString(),
      },
    );
    const fresh = await loadRows(assertSafeId(me.pairId));
    return viewOf(context.userId, partnerId, fresh.open ?? next, fresh.answers);
  });
