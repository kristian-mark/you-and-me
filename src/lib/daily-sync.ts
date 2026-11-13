import { pickQuestion, questionById } from "./daily-questions.ts";

/**
 * One calendar for the pair. Each phone's local date is not the key:
 * America/Chicago and a zone nine hours ahead (UTC+3) disagree for about
 * nine hours around midnight, and that would open two questions.
 * UTC matches the old `toISOString().slice(0, 10)` key, so a question
 * already on screen stays the same question.
 */
export const PAIR_QUESTION_ZONE = "UTC";

/** How far back a phone may still file an answer onto the shared question. */
export const DAILY_REPAIR_DAYS = 120;

function daysBefore(earlier: string, later: string) {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.POSITIVE_INFINITY;
  return Math.round((end - start) / 86_400_000);
}

/**
 * Written by the old "Партнёр уже ответил — открыть" control.
 * It is not an answer from the partner and must not be stored or revealed.
 */
export const PLACEHOLDER_PARTNER_ANSWER =
  "Я тоже это помню. Напишу нормально со своего телефона.";

export function isPlaceholderPartnerAnswer(text: string | null | undefined) {
  return text?.trim() === PLACEHOLDER_PARTNER_ANSWER;
}

export function pairDayKey(now: Date, timeZone = PAIR_QUESTION_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Некорректная дата");
  return `${year}-${month}-${day}`;
}

export type DailyAnswerRow = {
  userId: string;
  dayKey: string;
  questionId: string;
  body: string;
  answeredAt: string;
};

export type DailyOpen = {
  dayKey: string;
  questionId: string;
  skippedIds: string[];
};

export type DailyHistoryItem = {
  date: string;
  questionId: string;
  topic: string;
  text: string;
  myAnswer?: string;
  myAt?: string;
  partnerAnswer?: string;
  partnerAt?: string;
};

export type DailySnapshot = {
  dayKey: string;
  questionId: string;
  topic: string;
  text: string;
  myAnswer: string | null;
  myAt: string | null;
  /** Null until both people have answered this question. */
  partnerAnswer: string | null;
  partnerAt: string | null;
  partnerAnswered: boolean;
  skippedIds: string[];
  history: DailyHistoryItem[];
};

export type LocalDailyView = {
  date: string;
  questionId: string;
  myAnswer?: string;
  myAt?: string;
  partnerAnswer?: string;
  partnerAt?: string;
  skippedIds: string[];
  history: DailyHistoryItem[];
};

function keptAnswers(answers: DailyAnswerRow[]) {
  return answers.filter((row) => row.body.trim() && !isPlaceholderPartnerAnswer(row.body));
}

function answersFor(open: DailyOpen, answers: DailyAnswerRow[]) {
  return keptAnswers(answers).filter(
    (row) => row.dayKey === open.dayKey && row.questionId === open.questionId,
  );
}

export function bothAnswered(open: DailyOpen, answers: DailyAnswerRow[], memberIds: string[]) {
  if (memberIds.length < 2) return false;
  const users = new Set(answersFor(open, answers).map((row) => row.userId));
  return memberIds.every((id) => users.has(id));
}

/**
 * The open question stays until both members have answered it, even when the
 * shared day has already moved on. A new day then opens the next question.
 */
export function advanceDaily(input: {
  now: Date;
  timeZone?: string;
  open: DailyOpen | null;
  answers: DailyAnswerRow[];
  memberIds: string[];
}): { open: DailyOpen; changed: boolean } {
  const today = pairDayKey(input.now, input.timeZone ?? PAIR_QUESTION_ZONE);
  if (!input.open) {
    return {
      open: { dayKey: today, questionId: pickQuestion(today, []).id, skippedIds: [] },
      changed: true,
    };
  }
  if (bothAnswered(input.open, input.answers, input.memberIds) && input.open.dayKey < today) {
    return {
      open: {
        dayKey: today,
        questionId: pickQuestion(today, input.open.skippedIds).id,
        skippedIds: input.open.skippedIds,
      },
      changed: true,
    };
  }
  return { open: input.open, changed: false };
}

export function canSkipDaily(open: DailyOpen, answers: DailyAnswerRow[]) {
  return answersFor(open, answers).length === 0;
}

/**
 * Where one person's answer is stored.
 * The open question wins when it is the question they answered.
 * A canonical answer for an earlier day can pull an empty open question
 * back, so two phones that crossed midnight still meet on the question
 * they already wrote.
 */
export function placeDailyAnswer(input: {
  open: DailyOpen;
  answers: DailyAnswerRow[];
  dayKey: string;
  questionId: string;
  today: string;
}): { dayKey: string; questionId: string; retarget: boolean } | null {
  if (input.questionId === input.open.questionId) {
    return { dayKey: input.open.dayKey, questionId: input.open.questionId, retarget: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey) || input.dayKey > input.today) return null;
  if (daysBefore(input.dayKey, input.today) > DAILY_REPAIR_DAYS) return null;
  if (input.questionId !== pickQuestion(input.dayKey, []).id) return null;
  const openBusy = answersFor(input.open, input.answers).length > 0;
  if (!openBusy && input.dayKey <= input.open.dayKey) {
    return {
      dayKey: input.dayKey,
      questionId: input.questionId,
      retarget: true,
    };
  }
  return { dayKey: input.dayKey, questionId: input.questionId, retarget: false };
}

export function skippedQuestion(open: DailyOpen): DailyOpen {
  const skippedIds = [...new Set([...open.skippedIds, open.questionId])];
  return { ...open, questionId: pickQuestion(open.dayKey, skippedIds).id, skippedIds };
}

function historyItem(
  date: string,
  questionId: string,
  mine: DailyAnswerRow | undefined,
  theirs: DailyAnswerRow | undefined,
): DailyHistoryItem {
  const question = questionById(questionId);
  const revealed = Boolean(mine && theirs);
  return {
    date,
    questionId,
    topic: question.topic,
    text: question.text,
    myAnswer: mine?.body,
    myAt: mine?.answeredAt,
    partnerAnswer: revealed ? theirs?.body : undefined,
    partnerAt: revealed ? theirs?.answeredAt : undefined,
  };
}

/**
 * What one phone may see. The partner's words are omitted unless both
 * answers for that question are stored.
 */
export function snapshotDaily(input: {
  viewerId: string;
  partnerId: string | null;
  open: DailyOpen;
  answers: DailyAnswerRow[];
}): DailySnapshot {
  const rows = keptAnswers(input.answers);
  const openRows = rows.filter(
    (row) => row.dayKey === input.open.dayKey && row.questionId === input.open.questionId,
  );
  const mine = openRows.find((row) => row.userId === input.viewerId) ?? null;
  const partner = input.partnerId
    ? (openRows.find((row) => row.userId === input.partnerId) ?? null)
    : null;
  const revealed = Boolean(mine && partner);
  const question = questionById(input.open.questionId);

  const groups = new Map<string, DailyAnswerRow[]>();
  for (const row of rows) {
    if (row.dayKey === input.open.dayKey && row.questionId === input.open.questionId) continue;
    const key = `${row.dayKey}\u0000${row.questionId}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const history = [...groups.entries()]
    .map(([key, list]) => {
      const [date, questionId] = key.split("\u0000");
      const my = list.find((row) => row.userId === input.viewerId);
      const their = input.partnerId ? list.find((row) => row.userId === input.partnerId) : undefined;
      return historyItem(date, questionId, my, their);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.questionId.localeCompare(a.questionId));

  return {
    dayKey: input.open.dayKey,
    questionId: input.open.questionId,
    topic: question.topic,
    text: question.text,
    myAnswer: mine?.body ?? null,
    myAt: mine?.answeredAt ?? null,
    partnerAnswer: revealed ? (partner?.body ?? null) : null,
    partnerAt: revealed ? (partner?.answeredAt ?? null) : null,
    partnerAnswered: Boolean(partner),
    skippedIds: input.open.skippedIds,
    history,
  };
}

export function presentDaily(snapshot: DailySnapshot, local: LocalDailyView): LocalDailyView & {
  partnerAnswered: boolean;
} {
  const seen = new Set(snapshot.history.map((item) => `${item.date}\u0000${item.questionId}`));
  const extra: DailyHistoryItem[] = [];
  for (const item of local.history ?? []) {
    const key = `${item.date}\u0000${item.questionId}`;
    if (!item.date || !item.myAnswer?.trim() || seen.has(key)) continue;
    if (isPlaceholderPartnerAnswer(item.myAnswer)) continue;
    extra.push({
      date: item.date,
      questionId: item.questionId,
      topic: item.topic,
      text: item.text,
      myAnswer: item.myAnswer,
      myAt: item.myAt,
    });
  }
  const localMine = local.myAnswer?.trim() ?? "";
  const sameQuestion = local.questionId === snapshot.questionId && Boolean(localMine);
  if (
    localMine &&
    !isPlaceholderPartnerAnswer(localMine) &&
    local.questionId !== snapshot.questionId &&
    local.date &&
    !seen.has(`${local.date}\u0000${local.questionId}`)
  ) {
    const question = questionById(local.questionId);
    extra.push({
      date: local.date,
      questionId: local.questionId,
      topic: question.topic,
      text: question.text,
      myAnswer: localMine,
      myAt: local.myAt,
    });
  }
  const myAnswer = snapshot.myAnswer ?? (sameQuestion ? localMine : null);
  const myAt = snapshot.myAt ?? (myAnswer && myAnswer === localMine ? (local.myAt ?? null) : null);
  return {
    date: snapshot.dayKey,
    questionId: snapshot.questionId,
    myAnswer: myAnswer ?? undefined,
    myAt: myAt ?? undefined,
    partnerAnswer: snapshot.partnerAnswer ?? undefined,
    partnerAt: snapshot.partnerAt ?? undefined,
    partnerAnswered: snapshot.partnerAnswered,
    skippedIds: snapshot.skippedIds,
    history: [...snapshot.history, ...extra].sort(
      (a, b) => b.date.localeCompare(a.date) || b.questionId.localeCompare(a.questionId),
    ),
  };
}

/** Upload only this phone's own answer, and only onto the shared open question. */
export function shouldUploadLocalDaily(input: {
  ownerId: string | null | undefined;
  userId: string | null | undefined;
  questionId: string;
  dayKey?: string;
  myAnswer?: string | null;
  openQuestionId: string;
  openDayKey?: string;
  serverHasMine: boolean;
}) {
  if (!input.ownerId || !input.userId || input.ownerId !== input.userId) return false;
  if (input.serverHasMine) return false;
  const body = input.myAnswer?.trim() ?? "";
  if (!body || body.length > 4000) return false;
  // The old control stored this sentence as the partner's answer. Never sync it.
  if (isPlaceholderPartnerAnswer(body)) return false;
  if (input.questionId === input.openQuestionId) return true;
  if (
    input.dayKey &&
    input.openDayKey &&
    input.dayKey <= input.openDayKey &&
    daysBefore(input.dayKey, input.openDayKey) <= DAILY_REPAIR_DAYS &&
    input.questionId === pickQuestion(input.dayKey, []).id
  ) {
    return true;
  }
  return false;
}
