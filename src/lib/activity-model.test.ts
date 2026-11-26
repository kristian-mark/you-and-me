import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  activityPreview,
  activityText,
  albumRecordDraft,
  bellTotal,
  chatDraft,
  emptyActivityCounts,
  feminineName,
  moreActivityCount,
  SECTION_MARK,
  selectActivity,
  taskActivityAction,
  taskDraft,
  visibleSection,
  wishActivityAction,
  wishDraft,
  withoutItem,
  withoutSection,
  type ActivityDraft,
} from "./activity-model.ts";

const ME = "user-me";
const PARTNER = "user-partner";

function draft(partial: Partial<ActivityDraft> & Pick<ActivityDraft, "section" | "targetId" | "at">): ActivityDraft {
  return {
    actorId: PARTNER,
    action: "created",
    title: "Куртка",
    ...partial,
  };
}

test("a viewer's own rows are never unread", () => {
  const snap = selectActivity(
    ME,
    [
      draft({ section: "wishes", targetId: "w1", at: "2026-11-26T10:00:00.000Z", actorId: ME }),
      draft({ section: "wishes", targetId: "w2", at: "2026-11-26T11:00:00.000Z" }),
    ],
    [],
  );
  assert.deepEqual(snap.items.map((item) => item.targetId), ["w2"]);
  assert.equal(snap.counts.wishes, 1);
  assert.equal(snap.counts.tasks, 0);
});

test("a section cursor hides what was already seen and keeps a later edit", () => {
  const older = draft({ section: "tasks", targetId: "t1", at: "2026-11-26T10:00:00.000Z", action: "created" });
  const newer = draft({ section: "tasks", targetId: "t1", at: "2026-11-26T12:00:00.000Z", action: "updated" });
  const hidden = selectActivity(ME, [older], [{ section: "tasks", targetId: SECTION_MARK, readAt: older.at }]);
  assert.equal(hidden.counts.tasks, 0);
  const again = selectActivity(ME, [newer], [{ section: "tasks", targetId: SECTION_MARK, readAt: older.at }]);
  assert.equal(again.counts.tasks, 1);
  assert.equal(again.items[0]?.action, "updated");
});

test("marking one item leaves the rest of the section unread", () => {
  const snap = selectActivity(
    ME,
    [
      draft({ section: "wishes", targetId: "a", at: "2026-11-26T10:00:00.000Z" }),
      draft({ section: "wishes", targetId: "b", at: "2026-11-26T11:00:00.000Z" }),
    ],
    [{ section: "wishes", targetId: "a", readAt: "2026-11-26T10:00:00.000Z" }],
  );
  assert.deepEqual(snap.items.map((item) => item.targetId), ["b"]);
  const dropped = withoutItem(snap, snap.items[0]!.id);
  assert.equal(dropped.counts.wishes, 0);
  assert.equal(withoutSection(snap, "wishes").items.length, 0);
});

test("a dated task is calendar activity and an open task stays on the task list", () => {
  const calendar = taskDraft({
    id: "t-cal",
    title: "Ужин",
    updated_at: "2026-11-26T10:00:00.000Z",
    payload: { updatedBy: PARTNER, activityAction: "created", showInCalendar: true, dueDate: "2026-12-01" },
  });
  const task = taskDraft({
    id: "t-open",
    title: "Купить",
    updated_at: "2026-11-26T10:00:00.000Z",
    payload: { updatedBy: PARTNER, activityAction: "created", showInCalendar: false },
  });
  assert.equal(calendar?.section, "calendar");
  assert.equal(calendar?.date, "2026-12-01");
  assert.equal(task?.section, "tasks");
  const snap = selectActivity(ME, [calendar!, task!], []);
  assert.equal(snap.counts.calendar, 1);
  assert.equal(snap.counts.tasks, 1);
});

test("rows without an editor stay quiet", () => {
  assert.equal(wishDraft({ id: "w", title: "Старая", updated_at: "2026-11-01T00:00:00.000Z", payload: {} }), null);
  assert.equal(taskDraft({ id: "t", title: "Старая", updated_at: "2026-11-01T00:00:00.000Z", payload: { createdBy: PARTNER } }), null);
});

test("russian lines follow the partner name and never describe my own verb choice", () => {
  assert.equal(feminineName("Алина"), true);
  assert.equal(feminineName("Алиночка"), true);
  assert.equal(feminineName("Партнёр"), false);
  assert.equal(feminineName("Никита"), false);
  assert.equal(
    activityText("Алина", { section: "wishes", action: "created", title: "Куртка" }),
    "Алина добавила хотелку «Куртка»",
  );
  assert.equal(
    activityText("Партнёр", { section: "question", action: "answered", title: "" }),
    "Партнёр ответил на вопрос дня",
  );
  assert.equal(activityText("Алина", { section: "chat", action: "message", title: "привет" }), "Алина написала в чат");
  assert.equal(activityPreview({ action: "message", title: "привет" }), "привет");
  assert.equal(activityPreview({ action: "created", title: "Куртка" }), "");
  assert.equal(activityText("Алина", { section: "test", action: "quiz", title: "" }), "Алина прошла тест совместимости");
  assert.equal(activityText("Партнёр", { section: "test", action: "remind", title: "" }), "Партнёр зовёт пройти тест");
});

test("chat messages do not add to the task badge, and the bell adds them once", () => {
  const message = chatDraft({
    id: "m1",
    author_user_id: PARTNER,
    kind: "text",
    body: "я тут",
    created_at: "2026-11-26T09:00:00.000Z",
  });
  assert.equal(message?.action, "message");
  const snap = selectActivity(ME, [message!], []);
  assert.equal(snap.counts.chat, 1);
  assert.equal(snap.counts.tasks, 0);
  const counts = { ...emptyActivityCounts(), album: 2, question: 1 };
  assert.equal(bellTotal(4, counts), 7);
  assert.equal(moreActivityCount(counts), 3);
});

test("an album rename is an update and the original create is not", () => {
  const created = albumRecordDraft({
    id: "a1",
    title: "Море",
    created_by: PARTNER,
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-20T10:00:00.000Z",
  });
  const renamed = albumRecordDraft({
    id: "a1",
    title: "Море 2",
    created_by: ME,
    created_at: "2026-11-20T10:00:00.000Z",
    updated_by: PARTNER,
    updated_at: "2026-11-26T10:00:00.000Z",
  });
  assert.equal(created?.action, "album");
  assert.equal(renamed?.action, "updated");
  assert.equal(renamed?.actorId, PARTNER);
});

test("task and wish verbs follow the change, not the viewer", () => {
  assert.equal(taskActivityAction(null, { done: false, deleted: false }), "created");
  assert.equal(taskActivityAction({ done: false, deleted: false }, { done: true, deleted: false }), "done");
  assert.equal(taskActivityAction({ done: true, deleted: false }, { done: true, deleted: true }), "deleted");
  assert.equal(wishActivityAction({ fulfilled: false, deleted: false }, { fulfilled: true, deleted: false }), "fulfilled");
  assert.equal(wishActivityAction({ fulfilled: false, deleted: false }, { fulfilled: false, deleted: false }), "updated");
});

test("activity migration locks the cursor table and can run twice", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const file of ["migrations/0010_activity.sql", "supabase/migrations/20261126120000_activity.sql"]) {
    const sql = readFileSync(join(root, file), "utf8");
    const code = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(sql, /create table if not exists public.app_activity_reads/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /revoke all privileges/);
    assert.match(sql, /add column if not exists updated_by/);
    assert.doesNotMatch(code, /create policy/i);
    assert.doesNotMatch(code, /drop table/i);
    assert.doesNotMatch(sql, /'chat'/);
  }
});

test("the open screen is the one whose badge should clear", () => {
  assert.equal(visibleSection("tasks", null), "tasks");
  assert.equal(visibleSection("calendar", null), "calendar");
  assert.equal(visibleSection("wishes", null), "wishes");
  assert.equal(visibleSection("lists", null), null);
  assert.equal(visibleSection("more", null), null);
  assert.equal(visibleSection("more", "chat"), "chat");
  assert.equal(visibleSection("more", "album"), "album");
  assert.equal(visibleSection("more", "question"), "question");
  assert.equal(visibleSection("more", "test"), "test");
  assert.equal(visibleSection("more", "notes"), null);
});
