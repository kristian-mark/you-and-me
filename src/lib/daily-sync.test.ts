import assert from "node:assert/strict";
import test from "node:test";
import { pickQuestion, questionById } from "./daily-questions.ts";
import {
  advanceDaily,
  bothAnswered,
  canSkipDaily,
  isPlaceholderPartnerAnswer,
  pairDayKey,
  PLACEHOLDER_PARTNER_ANSWER,
  placeDailyAnswer,
  presentDaily,
  shouldUploadLocalDaily,
  skippedQuestion,
  snapshotDaily,
  type DailyAnswerRow,
  type LocalDailyView,
} from "./daily-sync.ts";

const KRISTIANS = "kristians";
const ALINA = "alina";
const MEMBERS = [KRISTIANS, ALINA];

function answer(
  userId: string,
  dayKey: string,
  questionId: string,
  body: string,
  answeredAt: string,
): DailyAnswerRow {
  return { userId, dayKey, questionId, body, answeredAt };
}

test("chicago and a zone nine hours ahead share one question", () => {
  // 03:30 UTC on 14 Nov: 21:30 the previous evening in Chicago (UTC-6),
  // 06:30 the same morning in Moscow (UTC+3). Nine hours, two local dates.
  const now = new Date("2026-11-14T03:30:00.000Z");
  const chicago = pairDayKey(now, "America/Chicago");
  const ahead = pairDayKey(now, "Europe/Moscow");
  assert.equal(chicago, "2026-11-13");
  assert.equal(ahead, "2026-11-14");
  assert.notEqual(chicago, ahead);

  const shared = pairDayKey(now);
  assert.equal(shared, "2026-11-14");
  const owner = advanceDaily({ now, open: null, answers: [], memberIds: MEMBERS });
  const hers = advanceDaily({ now, open: null, answers: [], memberIds: [...MEMBERS].reverse() });
  assert.equal(owner.open.dayKey, shared);
  assert.equal(hers.open.dayKey, owner.open.dayKey);
  assert.equal(hers.open.questionId, owner.open.questionId);
  assert.equal(owner.open.questionId, questionById(owner.open.questionId).id);
});

test("an unanswered question waits across the date line, then both answers open for both", () => {
  const openedAt = new Date("2026-11-13T16:00:00.000Z");
  const opened = advanceDaily({ now: openedAt, open: null, answers: [], memberIds: MEMBERS });
  const questionId = opened.open.questionId;
  assert.equal(opened.open.dayKey, "2026-11-13");

  const his = answer(KRISTIANS, "2026-11-13", questionId, "Твоя", "2026-11-13T10:46:00.000Z");
  const later = new Date("2026-11-14T03:30:00.000Z");
  const waiting = advanceDaily({ now: later, open: opened.open, answers: [his], memberIds: MEMBERS });
  assert.equal(waiting.changed, false);
  assert.equal(waiting.open.questionId, questionId);
  assert.equal(bothAnswered(waiting.open, [his], MEMBERS), false);

  const ownerView = snapshotDaily({
    viewerId: KRISTIANS,
    partnerId: ALINA,
    open: waiting.open,
    answers: [his],
  });
  const herView = snapshotDaily({
    viewerId: ALINA,
    partnerId: KRISTIANS,
    open: waiting.open,
    answers: [his],
  });
  assert.equal(ownerView.questionId, herView.questionId);
  assert.equal(ownerView.text, herView.text);
  assert.equal(ownerView.myAnswer, "Твоя");
  assert.equal(ownerView.partnerAnswer, null);
  assert.equal(ownerView.partnerAnswered, false);
  assert.equal(herView.myAnswer, null);
  assert.equal(herView.partnerAnswer, null);
  assert.equal(herView.partnerAnswered, true);
  assert.equal(JSON.stringify(herView).includes("Твоя"), false);

  const hers = answer(ALINA, "2026-11-13", questionId, "Твоя правда", "2026-11-13T10:17:00.000Z");
  const both = [his, hers];
  const stillToday = advanceDaily({
    now: new Date("2026-11-13T18:00:00.000Z"),
    open: opened.open,
    answers: both,
    memberIds: MEMBERS,
  });
  assert.equal(stillToday.changed, false);
  const ownerOpen = snapshotDaily({
    viewerId: KRISTIANS,
    partnerId: ALINA,
    open: stillToday.open,
    answers: both,
  });
  const herOpen = snapshotDaily({
    viewerId: ALINA,
    partnerId: KRISTIANS,
    open: stillToday.open,
    answers: both,
  });
  assert.equal(ownerOpen.myAnswer, "Твоя");
  assert.equal(ownerOpen.partnerAnswer, "Твоя правда");
  assert.equal(ownerOpen.myAt, "2026-11-13T10:46:00.000Z");
  assert.equal(herOpen.myAnswer, "Твоя правда");
  assert.equal(herOpen.partnerAnswer, "Твоя");
  assert.equal(herOpen.partnerAnswered, true);

  const next = advanceDaily({ now: later, open: opened.open, answers: both, memberIds: MEMBERS });
  assert.equal(next.changed, true);
  assert.equal(next.open.dayKey, "2026-11-14");
  assert.notEqual(next.open.questionId, questionId);
  const ownerPast = snapshotDaily({
    viewerId: KRISTIANS,
    partnerId: ALINA,
    open: next.open,
    answers: both,
  });
  const herPast = snapshotDaily({
    viewerId: ALINA,
    partnerId: KRISTIANS,
    open: next.open,
    answers: both,
  });
  assert.equal(ownerPast.myAnswer, null);
  assert.equal(ownerPast.history[0]?.myAnswer, "Твоя");
  assert.equal(ownerPast.history[0]?.partnerAnswer, "Твоя правда");
  assert.equal(herPast.history[0]?.myAnswer, "Твоя правда");
  assert.equal(herPast.history[0]?.partnerAnswer, "Твоя");
  assert.equal(herPast.questionId, ownerPast.questionId);
});

test("the canned partner line is not an answer and is dropped on the phone", () => {
  const opened = advanceDaily({
    now: new Date("2026-11-13T16:00:00.000Z"),
    open: null,
    answers: [],
    memberIds: MEMBERS,
  });
  const fake = answer(
    KRISTIANS,
    opened.open.dayKey,
    opened.open.questionId,
    PLACEHOLDER_PARTNER_ANSWER,
    "2026-11-13T10:42:00.000Z",
  );
  assert.equal(isPlaceholderPartnerAnswer(PLACEHOLDER_PARTNER_ANSWER), true);
  assert.equal(bothAnswered(opened.open, [fake], MEMBERS), false);
  const view = snapshotDaily({
    viewerId: ALINA,
    partnerId: KRISTIANS,
    open: opened.open,
    answers: [fake],
  });
  assert.equal(view.partnerAnswered, false);
  assert.equal(JSON.stringify(view).includes(PLACEHOLDER_PARTNER_ANSWER), false);

  const local: LocalDailyView = {
    date: opened.open.dayKey,
    questionId: opened.open.questionId,
    myAnswer: "свой текст",
    myAt: "2026-11-13T10:17:00.000Z",
    partnerAnswer: PLACEHOLDER_PARTNER_ANSWER,
    partnerAt: "2026-11-13T10:42:00.000Z",
    skippedIds: [],
    history: [
      {
        date: "2026-11-12",
        questionId: "d001",
        topic: "год",
        text: "старый",
        myAnswer: "моё",
        partnerAnswer: PLACEHOLDER_PARTNER_ANSWER,
      },
    ],
  };
  const shown = presentDaily(view, local);
  assert.equal(shown.myAnswer, "свой текст");
  assert.equal(shown.partnerAnswer, undefined);
  assert.equal(JSON.stringify(shown).includes(PLACEHOLDER_PARTNER_ANSWER), false);
  assert.equal(shown.history[0]?.myAnswer, "моё");
  assert.equal(shown.history[0]?.partnerAnswer, undefined);
});

test("a skip is shared and cannot throw away an answer", () => {
  const opened = advanceDaily({
    now: new Date("2026-11-13T12:00:00.000Z"),
    open: null,
    answers: [],
    memberIds: MEMBERS,
  });
  assert.equal(canSkipDaily(opened.open, []), true);
  const next = skippedQuestion(opened.open);
  assert.notEqual(next.questionId, opened.open.questionId);
  assert.equal(next.dayKey, opened.open.dayKey);
  const row = answer(ALINA, next.dayKey, next.questionId, "уже", "2026-11-13T12:05:00.000Z");
  assert.equal(canSkipDaily(next, [row]), false);
});

test("another account cannot upload this phone's answer", () => {
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: KRISTIANS,
      userId: ALINA,
      questionId: "d317",
      myAnswer: "Твоя",
      openQuestionId: "d317",
      serverHasMine: false,
    }),
    false,
  );
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: null,
      userId: KRISTIANS,
      questionId: "d317",
      myAnswer: "Твоя",
      openQuestionId: "d317",
      serverHasMine: false,
    }),
    false,
  );
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: KRISTIANS,
      userId: KRISTIANS,
      questionId: "d317",
      myAnswer: "Твоя",
      openQuestionId: "d317",
      serverHasMine: false,
    }),
    true,
  );
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: KRISTIANS,
      userId: KRISTIANS,
      questionId: "d317",
      myAnswer: "Твоя",
      openQuestionId: "d317",
      serverHasMine: true,
    }),
    false,
  );
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: KRISTIANS,
      userId: KRISTIANS,
      questionId: "d100",
      myAnswer: "Твоя",
      openQuestionId: "d317",
      serverHasMine: false,
    }),
    false,
  );
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: ALINA,
      userId: ALINA,
      questionId: "d317",
      myAnswer: PLACEHOLDER_PARTNER_ANSWER,
      openQuestionId: "d317",
      serverHasMine: false,
    }),
    false,
  );
});

test("an answer written before midnight still joins the shared question after the day rolls", () => {
  const later = new Date("2026-11-14T03:30:00.000Z");
  const open = advanceDaily({ now: later, open: null, answers: [], memberIds: MEMBERS }).open;
  const yesterday = "2026-11-13";
  const questionId = pickQuestion(yesterday, []).id;
  assert.notEqual(open.questionId, questionId);
  assert.equal(
    shouldUploadLocalDaily({
      ownerId: KRISTIANS,
      userId: KRISTIANS,
      dayKey: yesterday,
      questionId,
      myAnswer: "Твоя",
      openQuestionId: open.questionId,
      openDayKey: open.dayKey,
      serverHasMine: false,
    }),
    true,
  );
  const placed = placeDailyAnswer({
    open,
    answers: [],
    dayKey: yesterday,
    questionId,
    today: open.dayKey,
  });
  assert.deepEqual(placed, { dayKey: yesterday, questionId, retarget: true });
  const hers = placeDailyAnswer({
    open: { dayKey: yesterday, questionId, skippedIds: [] },
    answers: [answer(KRISTIANS, yesterday, questionId, "Твоя", "2026-11-13T10:46:00.000Z")],
    dayKey: yesterday,
    questionId,
    today: open.dayKey,
  });
  assert.deepEqual(hers, { dayKey: yesterday, questionId, retarget: false });
  assert.equal(
    placeDailyAnswer({
      open,
      answers: [],
      dayKey: "2025-01-01",
      questionId: pickQuestion("2025-01-01", []).id,
      today: open.dayKey,
    }),
    null,
  );
});
