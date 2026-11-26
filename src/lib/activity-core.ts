/** Load partner activity and move read cursors. The secret key is the only database path. */

import { unreadFilter, unreadLowerBound } from "@/lib/chat-model";
import { myPairId } from "@/lib/pair-access";
import { eqFilter, sbSelect, sbUpsert } from "@/lib/supabase-app";
import {
  albumRecordDraft,
  answerDraft,
  chatDraft,
  emptyActivity,
  hasSectionMark,
  likeDraft,
  photoDraft,
  quizDrafts,
  SECTION_MARK,
  SEEDED_SECTIONS,
  seedStamp,
  selectActivity,
  STORED_SECTIONS,
  taskDraft,
  wishDraft,
  type ActivityDraft,
  type ActivitySection,
  type ActivitySnapshot,
  type ReadMark,
  type StoredSection,
} from "@/lib/activity-model";

type MarkRow = { section: string; target_id: string; read_at: string };

const STORED = new Set<string>(STORED_SECTIONS);

function missingTable(error: unknown) {
  return error instanceof Error && /supabase 404/.test(error.message);
}

async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (missingTable(error)) return fallback;
    throw error;
  }
}

async function readMarks(pairId: string, userId: string): Promise<ReadMark[] | null> {
  try {
    const rows = await sbSelect<MarkRow>(
      "app_activity_reads",
      `${eqFilter("pair_id", pairId)}&${eqFilter("user_id", userId)}&select=section,target_id,read_at&limit=500`,
    );
    const marks: ReadMark[] = [];
    for (const row of rows) {
      if (!STORED.has(row.section) || !row.read_at || !row.target_id) continue;
      marks.push({ section: row.section as StoredSection, targetId: row.target_id, readAt: row.read_at });
    }
    return marks;
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

async function writeMark(pairId: string, userId: string, section: StoredSection, targetId: string, readAt: string) {
  await sbUpsert(
    "app_activity_reads",
    { pair_id: pairId, user_id: userId, section, target_id: targetId, read_at: readAt },
    "pair_id,user_id,section,target_id",
  );
}

async function chatPart(pairId: string, userId: string): Promise<{ drafts: ActivityDraft[]; mark: ReadMark | null; count: number }> {
  const reads = await sbSelect<{ read_at: string }>(
    "app_chat_reads",
    `${eqFilter("pair_id", pairId)}&${eqFilter("user_id", userId)}&select=read_at&limit=1`,
  );
  const readAt = reads[0]?.read_at ?? null;
  const countRows = await sbSelect<{ id: string }>("app_chat_messages", unreadFilter(pairId, userId, readAt));
  const bound = readAt ? unreadLowerBound(readAt) : null;
  const since = bound ? `&created_at=${bound.op}.${encodeURIComponent(bound.stamp)}` : "";
  const rows = await sbSelect<{
    id: string;
    author_user_id: string;
    kind: string;
    body: string | null;
    created_at: string;
    card_title: string | null;
    deleted_at: string | null;
  }>(
    "app_chat_messages",
    `${eqFilter("pair_id", pairId)}&author_user_id=neq.${encodeURIComponent(userId)}&deleted_at=is.null${since}&select=id,author_user_id,kind,body,created_at,card_title,deleted_at&order=created_at.desc&limit=20`,
  );
  return {
    drafts: rows.flatMap((row) => {
      const draft = chatDraft(row);
      return draft ? [draft] : [];
    }),
    mark: readAt ? { section: "chat", targetId: SECTION_MARK, readAt } : null,
    count: countRows.length,
  };
}

export async function loadActivity(userId: string): Promise<ActivitySnapshot> {
  const pairId = await myPairId(userId);
  if (!pairId) return emptyActivity();
  const marks = await readMarks(pairId, userId);
  if (!marks) return emptyActivity();

  const [tasks, wishes, photos, albums, likes, answers, quiz, chat] = await Promise.all([
    optional(
      () =>
        sbSelect<{ id: string; title: string; updated_at: string; payload: unknown }>(
          "app_tasks",
          `${eqFilter("pair_id", pairId)}&select=id,title,updated_at,payload&order=updated_at.desc&limit=40`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{ id: string; title: string; updated_at: string; payload: unknown }>(
          "app_wishes",
          `${eqFilter("pair_id", pairId)}&select=id,title,updated_at,payload&order=updated_at.desc&limit=40`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{ id: string; author_user_id: string; created_at: string }>(
          "app_album_photos",
          `${eqFilter("pair_id", pairId)}&deleted_at=is.null&select=id,author_user_id,created_at&order=created_at.desc&limit=40`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{
          id: string;
          title: string;
          created_by: string;
          created_at: string;
          updated_by: string | null;
          updated_at: string;
        }>(
          "app_albums",
          `${eqFilter("pair_id", pairId)}&select=id,title,created_by,created_at,updated_by,updated_at&order=updated_at.desc&limit=20`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{ photo_id: string; user_id: string; created_at: string }>(
          "app_album_likes",
          `${eqFilter("pair_id", pairId)}&select=photo_id,user_id,created_at&order=created_at.desc&limit=20`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{ user_id: string; day_key: string; answered_at: string }>(
          "app_daily_answers",
          `${eqFilter("pair_id", pairId)}&select=user_id,day_key,answered_at&order=answered_at.desc&limit=12`,
        ),
      [],
    ),
    optional(
      () =>
        sbSelect<{ user_id: string; done_at: string | null; reminded_at: string | null }>(
          "app_quiz",
          `${eqFilter("pair_id", pairId)}&select=user_id,done_at,reminded_at`,
        ),
      [],
    ),
    optional(() => chatPart(pairId, userId), { drafts: [], mark: null, count: 0 }),
  ]);

  const drafts: ActivityDraft[] = [
    ...tasks.flatMap((row) => {
      const draft = taskDraft(row);
      return draft ? [draft] : [];
    }),
    ...wishes.flatMap((row) => {
      const draft = wishDraft(row);
      return draft ? [draft] : [];
    }),
    ...photos.flatMap((row) => {
      const draft = photoDraft(row);
      return draft ? [draft] : [];
    }),
    ...albums.flatMap((row) => {
      const draft = albumRecordDraft(row);
      return draft ? [draft] : [];
    }),
    ...likes.flatMap((row) => {
      const draft = likeDraft(row);
      return draft ? [draft] : [];
    }),
    ...answers.flatMap((row) => {
      const draft = answerDraft(row);
      return draft ? [draft] : [];
    }),
    ...quiz.flatMap((row) => quizDrafts(row)),
    ...chat.drafts,
  ];

  const now = new Date().toISOString();
  for (const section of SEEDED_SECTIONS) {
    if (hasSectionMark(section, marks)) continue;
    const readAt = seedStamp(section, userId, drafts, now);
    await writeMark(pairId, userId, section, SECTION_MARK, readAt);
    marks.push({ section, targetId: SECTION_MARK, readAt });
  }
  if (chat.mark) marks.push(chat.mark);

  const snap = selectActivity(userId, drafts, marks);
  snap.counts.chat = chat.count;
  return snap;
}

export async function markActivity(userId: string, section: StoredSection, targetId: string) {
  const pairId = await myPairId(userId);
  if (!pairId) return;
  await writeMark(pairId, userId, section, targetId, new Date().toISOString());
}

export async function markAllActivity(userId: string) {
  const pairId = await myPairId(userId);
  if (!pairId) return;
  const now = new Date().toISOString();
  await Promise.all(STORED_SECTIONS.map((section) => writeMark(pairId, userId, section, SECTION_MARK, now)));
  await sbUpsert("app_chat_reads", { pair_id: pairId, user_id: userId, read_at: now }, "pair_id,user_id");
}

export function isActivitySectionName(value: string): value is ActivitySection {
  return STORED.has(value) || value === "chat";
}
