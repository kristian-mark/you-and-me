/** Pure rules for partner activity: who is unread, which section, and the Russian line. */

import { rowStillUnread } from "./chat-model.ts";

export const ACTIVITY_POLL_MS = 20_000;
export const ACTIVITY_FEED_CAP = 30;
/** Section cursor. A real target id is one item. */
export const SECTION_MARK = "_";

export const ACTIVITY_SECTIONS = ["tasks", "calendar", "wishes", "chat", "album", "question", "test"] as const;
export type ActivitySection = (typeof ACTIVITY_SECTIONS)[number];

/** Sections whose history already exists. The first look seeds a cursor so old rows stay quiet. */
export const SEEDED_SECTIONS = ["album", "question", "test"] as const;

/** Stored in app_activity_reads. Chat stays on app_chat_reads. */
export const STORED_SECTIONS = ["tasks", "calendar", "wishes", "album", "question", "test"] as const;
export type StoredSection = (typeof STORED_SECTIONS)[number];

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "done",
  "deleted",
  "fulfilled",
  "answered",
  "message",
  "image",
  "voice",
  "card",
  "photo",
  "like",
  "album",
  "quiz",
  "remind",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityDraft = {
  section: ActivitySection;
  targetId: string;
  actorId: string;
  at: string;
  action: ActivityAction;
  title: string;
  date?: string;
};

export type ActivityItem = ActivityDraft & { id: string };

export type ActivityCounts = Record<ActivitySection, number>;

export type ActivitySnapshot = {
  items: ActivityItem[];
  counts: ActivityCounts;
};

export type ReadMark = {
  section: ActivitySection;
  targetId: string;
  readAt: string;
};

const MALE_ENDING_A = new Set(["никита", "илья", "кузьма", "фома", "лука", "савва", "данила", "муса"]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function emptyActivityCounts(): ActivityCounts {
  return { tasks: 0, calendar: 0, wishes: 0, chat: 0, album: 0, question: 0, test: 0 };
}

export function emptyActivity(): ActivitySnapshot {
  return { items: [], counts: emptyActivityCounts() };
}

export function isActivitySection(value: string): value is ActivitySection {
  return (ACTIVITY_SECTIONS as readonly string[]).includes(value);
}

export function isStoredSection(value: string): value is StoredSection {
  return (STORED_SECTIONS as readonly string[]).includes(value);
}

export function assertActivityId(value: string) {
  const id = value.trim();
  if (!SAFE_ID.test(id)) throw new Error("Некорректный идентификатор");
  return id;
}

export function activityItemId(section: ActivitySection, targetId: string) {
  return `${section}:${targetId}`;
}

/** Names ending in а/я take the feminine verb. A short list of masculine exceptions stays masculine. */
export function feminineName(name: string) {
  const first = name.trim().split(/\s+/)[0]?.toLocaleLowerCase("ru") ?? "";
  if (!first || MALE_ENDING_A.has(first)) return false;
  return first.endsWith("а") || first.endsWith("я");
}

export function partnerVerb(name: string, male: string, female: string) {
  return feminineName(name) ? female : male;
}

export function clipActivityText(value: string, max = 60) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function quoted(title: string) {
  const text = clipActivityText(title);
  return text ? ` «${text}»` : "";
}

/** One Russian line. The partner's name is supplied by the viewer, never a hardcoded person. */
export function activityText(name: string, item: Pick<ActivityItem, "section" | "action" | "title">) {
  const who = name.trim() || "Партнёр";
  const verb = (male: string, female: string) => partnerVerb(who, male, female);
  const of = quoted(item.title);
  if (item.action === "answered" || item.section === "question") {
    return `${who} ${verb("ответил", "ответила")} на вопрос дня`;
  }
  if (item.action === "remind") return `${who} зовёт пройти тест`;
  if (item.action === "quiz") return `${who} ${verb("прошёл", "прошла")} тест совместимости`;
  if (item.action === "message") return `${who} ${verb("написал", "написала")} в чат`;
  if (item.action === "image") return `${who} ${verb("отправил", "отправила")} фото в чат`;
  if (item.action === "voice") return `${who} ${verb("отправил", "отправила")} голосовое`;
  if (item.action === "card") return `${who} ${verb("отправил", "отправила")} в чат${of}`;
  if (item.action === "photo") return `${who} ${verb("добавил", "добавила")} фото в альбом`;
  if (item.action === "like") return `${who} ${verb("отметил", "отметила")} фото`;
  if (item.action === "album") return `${who} ${verb("создал", "создала")} альбом${of}`;
  if (item.section === "calendar") {
    if (item.action === "deleted") return `${who} ${verb("убрал", "убрала")} из календаря${of}`;
    if (item.action === "done") return `${who} ${verb("отметил", "отметила")} дату${of}`;
    if (item.action === "created") return `${who} ${verb("добавил", "добавила")} в календарь${of}`;
    return `${who} ${verb("обновил", "обновила")} дату${of}`;
  }
  if (item.section === "wishes") {
    if (item.action === "deleted") return `${who} ${verb("удалил", "удалила")} хотелку${of}`;
    if (item.action === "fulfilled") return `${who} ${verb("исполнил", "исполнила")} хотелку${of}`;
    if (item.action === "created") return `${who} ${verb("добавил", "добавила")} хотелку${of}`;
    return `${who} ${verb("обновил", "обновила")} хотелку${of}`;
  }
  if (item.section === "album") return `${who} ${verb("обновил", "обновила")} альбом${of}`;
  if (item.action === "deleted") return `${who} ${verb("удалил", "удалила")} задачу${of}`;
  if (item.action === "done") return `${who} ${verb("выполнил", "выполнила")} задачу${of}`;
  if (item.action === "created") return `${who} ${verb("добавил", "добавила")} задачу${of}`;
  return `${who} ${verb("обновил", "обновила")} задачу${of}`;
}

/** Chat text sits under the line. Other actions already include the title. */
export function activityPreview(item: Pick<ActivityItem, "action" | "title">) {
  if (item.action !== "message") return "";
  return clipActivityText(item.title, 140);
}

export function isUnread(at: string, floor: string | null) {
  if (!at) return false;
  if (!floor) return true;
  try {
    return rowStillUnread(at, floor);
  } catch {
    const left = Date.parse(at);
    const right = Date.parse(floor);
    return Number.isFinite(left) && Number.isFinite(right) && left > right;
  }
}

function laterStamp(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left)) return b;
  if (!Number.isFinite(right)) return a;
  return left >= right ? a : b;
}

export function readFloor(section: ActivitySection, targetId: string, marks: ReadMark[]) {
  let sectionAt: string | null = null;
  let itemAt: string | null = null;
  for (const mark of marks) {
    if (mark.section !== section) continue;
    if (mark.targetId === SECTION_MARK) sectionAt = laterStamp(sectionAt, mark.readAt);
    else if (mark.targetId === targetId) itemAt = laterStamp(itemAt, mark.readAt);
  }
  return laterStamp(sectionAt, itemAt);
}

export function hasSectionMark(section: ActivitySection, marks: ReadMark[]) {
  return marks.some((mark) => mark.section === section && mark.targetId === SECTION_MARK);
}

export function selectActivity(meId: string, drafts: ActivityDraft[], marks: ReadMark[]): ActivitySnapshot {
  const best = new Map<string, ActivityDraft>();
  for (const draft of drafts) {
    if (!draft.actorId || draft.actorId === meId || !draft.at || !draft.targetId) continue;
    const key = activityItemId(draft.section, draft.targetId);
    const prev = best.get(key);
    if (!prev || Date.parse(draft.at) >= Date.parse(prev.at)) best.set(key, draft);
  }
  const unread: ActivityItem[] = [];
  for (const draft of best.values()) {
    if (!isUnread(draft.at, readFloor(draft.section, draft.targetId, marks))) continue;
    unread.push({ ...draft, id: activityItemId(draft.section, draft.targetId) });
  }
  unread.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1));
  const counts = emptyActivityCounts();
  for (const item of unread) counts[item.section] += 1;
  return { items: unread.slice(0, ACTIVITY_FEED_CAP), counts };
}

export function withoutSection(snap: ActivitySnapshot, section: ActivitySection): ActivitySnapshot {
  return {
    items: snap.items.filter((item) => item.section !== section),
    counts: { ...snap.counts, [section]: 0 },
  };
}

export function withoutItem(snap: ActivitySnapshot, id: string): ActivitySnapshot {
  const dropped = snap.items.find((item) => item.id === id);
  if (!dropped) return snap;
  return {
    items: snap.items.filter((item) => item.id !== id),
    counts: { ...snap.counts, [dropped.section]: Math.max(0, snap.counts[dropped.section] - 1) },
  };
}

export function bellTotal(chatUnread: number, counts: ActivityCounts) {
  const chat = Number.isFinite(chatUnread) ? Math.max(0, Math.floor(chatUnread)) : 0;
  return chat + counts.tasks + counts.calendar + counts.wishes + counts.album + counts.question + counts.test;
}

/** Album, daily question, and the quiz live under «Ещё». Chat keeps its own count. */
export function moreActivityCount(counts: ActivityCounts) {
  return counts.album + counts.question + counts.test;
}

export function visibleSection(tab: string, moreOpen: string | null): ActivitySection | null {
  if (moreOpen === "chat") return "chat";
  if (moreOpen === "album") return "album";
  if (moreOpen === "question") return "question";
  if (moreOpen === "test") return "test";
  if (moreOpen) return null;
  if (tab === "tasks") return "tasks";
  if (tab === "calendar") return "calendar";
  if (tab === "wishes") return "wishes";
  return null;
}

export function taskActivityAction(
  previous: { done: boolean; deleted: boolean } | null,
  next: { done: boolean; deleted: boolean },
): ActivityAction {
  if (!previous || previous.deleted) return next.deleted ? "deleted" : "created";
  if (next.deleted) return "deleted";
  if (next.done && !previous.done) return "done";
  return "updated";
}

export function wishActivityAction(
  previous: { fulfilled: boolean; deleted: boolean } | null,
  next: { fulfilled: boolean; deleted: boolean },
): ActivityAction {
  if (!previous || previous.deleted) return next.deleted ? "deleted" : "created";
  if (next.deleted) return "deleted";
  if (next.fulfilled && !previous.fulfilled) return "fulfilled";
  return "updated";
}

export function readJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseAction(value: unknown): ActivityAction | null {
  return typeof value === "string" && (ACTIVITY_ACTIONS as readonly string[]).includes(value)
    ? (value as ActivityAction)
    : null;
}

export function taskSectionOf(payload: { showInCalendar?: boolean; dueDate?: string | null }) {
  return payload.showInCalendar && payload.dueDate ? "calendar" : "tasks";
}

export function taskDraft(row: {
  id: string;
  title: string;
  updated_at?: string | null;
  payload: unknown;
}): ActivityDraft | null {
  const payload = readJson(row.payload);
  const actorId = textOf(payload.updatedBy);
  const at = row.updated_at ?? "";
  if (!actorId || !at) return null;
  const due = textOf(payload.dueDate);
  return {
    section: taskSectionOf({ showInCalendar: Boolean(payload.showInCalendar), dueDate: due }),
    targetId: row.id,
    actorId,
    at,
    action: parseAction(payload.activityAction) ?? "updated",
    title: row.title || "Задача",
    date: due || undefined,
  };
}

export function wishDraft(row: {
  id: string;
  title: string;
  updated_at?: string | null;
  payload: unknown;
}): ActivityDraft | null {
  const payload = readJson(row.payload);
  const actorId = textOf(payload.updatedBy);
  const at = row.updated_at ?? "";
  if (!actorId || !at) return null;
  return {
    section: "wishes",
    targetId: row.id,
    actorId,
    at,
    action: parseAction(payload.activityAction) ?? "updated",
    title: row.title || "Хотелка",
  };
}

export function albumRecordDraft(row: {
  id: string;
  title: string;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}): ActivityDraft | null {
  const createdAt = row.created_at ?? "";
  const updatedAt = row.updated_at || createdAt;
  const updatedBy = row.updated_by ?? "";
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (updatedBy && Number.isFinite(created) && Number.isFinite(updated) && updated > created + 1500) {
    return {
      section: "album",
      targetId: `album_${row.id}`,
      actorId: updatedBy,
      at: updatedAt,
      action: "updated",
      title: row.title,
    };
  }
  if (!row.created_by || !createdAt) return null;
  return {
    section: "album",
    targetId: `album_${row.id}`,
    actorId: row.created_by,
    at: createdAt,
    action: "album",
    title: row.title,
  };
}

export function photoDraft(row: { id: string; author_user_id: string; created_at?: string | null }): ActivityDraft | null {
  if (!row.author_user_id || !row.created_at) return null;
  return {
    section: "album",
    targetId: row.id,
    actorId: row.author_user_id,
    at: row.created_at,
    action: "photo",
    title: "",
  };
}

export function likeDraft(row: { photo_id: string; user_id: string; created_at?: string | null }): ActivityDraft | null {
  if (!row.user_id || !row.photo_id || !row.created_at) return null;
  return {
    section: "album",
    targetId: `like_${row.photo_id}`,
    actorId: row.user_id,
    at: row.created_at,
    action: "like",
    title: "",
  };
}

export function answerDraft(row: { user_id: string; day_key: string; answered_at?: string | null }): ActivityDraft | null {
  if (!row.user_id || !row.day_key || !row.answered_at) return null;
  return {
    section: "question",
    targetId: row.day_key,
    actorId: row.user_id,
    at: row.answered_at,
    action: "answered",
    title: "",
  };
}

export function quizDrafts(row: {
  user_id: string;
  done_at?: string | null;
  reminded_at?: string | null;
}): ActivityDraft[] {
  const out: ActivityDraft[] = [];
  if (row.user_id && row.done_at) {
    out.push({ section: "test", targetId: "done", actorId: row.user_id, at: row.done_at, action: "quiz", title: "" });
  }
  if (row.user_id && row.reminded_at) {
    out.push({
      section: "test",
      targetId: "remind",
      actorId: row.user_id,
      at: row.reminded_at,
      action: "remind",
      title: "",
    });
  }
  return out;
}

export function chatDraft(row: {
  id: string;
  author_user_id: string;
  kind: string;
  body?: string | null;
  created_at?: string | null;
  card_title?: string | null;
  deleted_at?: string | null;
}): ActivityDraft | null {
  if (!row.author_user_id || !row.created_at || row.deleted_at) return null;
  const kind = row.kind;
  const action: ActivityAction =
    kind === "image" ? "image" : kind === "voice" ? "voice" : kind === "card" ? "card" : "message";
  return {
    section: "chat",
    targetId: row.id,
    actorId: row.author_user_id,
    at: row.created_at,
    action,
    title: action === "card" ? (row.card_title ?? "") : action === "message" ? (row.body ?? "") : "",
  };
}

/** Newest partner stamp in a section, used to seed history without marking the viewer unread. */
export function seedStamp(section: ActivitySection, meId: string, drafts: ActivityDraft[], now: string) {
  let best = "";
  for (const draft of drafts) {
    if (draft.section !== section || !draft.actorId || draft.actorId === meId || !draft.at) continue;
    if (!best || Date.parse(draft.at) > Date.parse(best)) best = draft.at;
  }
  return best || now;
}
