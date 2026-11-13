import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  badgeLabel,
  canDeleteMessage,
  cardIsRemoved,
  chatAccess,
  chatClock,
  chatDateLabel,
  chatObjectPath,
  chatPathBelongs,
  cleanChatText,
  countUnread,
  cursorIso,
  groupByDay,
  latestOwn,
  mergeThread,
  partnerReadMine,
  prettyCardSubtitle,
  shareGate,
  sniffAudio,
  threadFilter,
  unreadFilter,
  voiceLikelySilent,
  voiceMimeFor,
  TEXT_MAX,
} from "./chat-model.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pair = { id: "pair-1", aUserId: "user-a", bUserId: "user-b" };

test("only the two members of a complete pair can use the chat", () => {
  assert.deepEqual(chatAccess("user-a", pair), { ok: true, pairId: "pair-1", partnerId: "user-b" });
  assert.deepEqual(chatAccess("user-b", pair), { ok: true, pairId: "pair-1", partnerId: "user-a" });
  assert.deepEqual(chatAccess("user-c", pair), { ok: false, reason: "outsider" });
  assert.deepEqual(chatAccess("user-a", { ...pair, bUserId: null }), { ok: false, reason: "waiting" });
  assert.deepEqual(chatAccess("user-c", { ...pair, bUserId: null }), { ok: false, reason: "outsider" });
  assert.deepEqual(chatAccess("", pair), { ok: false, reason: "none" });
  assert.deepEqual(chatAccess("user-a", null), { ok: false, reason: "none" });
});

test("a partner cannot delete the other person's message", () => {
  assert.equal(canDeleteMessage("user-a", "user-a", null), true);
  assert.equal(canDeleteMessage("user-a", "user-b", null), false);
  assert.equal(canDeleteMessage("user-a", "user-a", "2026-11-13T00:00:00.000Z"), false);
  assert.equal(canDeleteMessage("", "user-a", null), false);
});

test("server cards from another pair or a deleted row stay closed", () => {
  assert.equal(shareGate("wish", { pairId: "pair-1", deleted: false }, "pair-1"), "ok");
  assert.equal(shareGate("wish", { pairId: "pair-2", deleted: false }, "pair-1"), "foreign");
  assert.equal(shareGate("task", { pairId: "pair-1", deleted: true }, "pair-1"), "missing");
  assert.equal(shareGate("photo", null, "pair-1"), "missing");
  assert.equal(shareGate("event", null, "pair-1"), "ok");
  assert.equal(cardIsRemoved("wish", null, "pair-1"), true);
  assert.equal(cardIsRemoved("note", null, "pair-1"), false);
  assert.equal(cardIsRemoved("album", { pairId: "pair-9", deleted: false }, "pair-1"), true);
});

test("every thread query is pinned to the pair and ignores raw cursors", () => {
  const latest = threadFilter("pair-1", { mode: "latest", limit: 500 });
  assert.match(latest, /^pair_id=eq\.pair-1&/);
  assert.match(latest, /deleted_at=is\.null/);
  assert.match(latest, /limit=80/);
  assert.doesNotMatch(latest, /pair-2/);

  const after = threadFilter("pair-1", { mode: "after", cursor: "2026-11-05T10:47:00.000Z", limit: 10 });
  assert.match(after, /^pair_id=eq\.pair-1&created_at=gt\./);
  assert.match(after, /limit=10/);

  const gone = threadFilter("pair-1", { mode: "deleted", cursor: "2026-11-05T10:47:00Z", limit: 10 });
  assert.match(gone, /^pair_id=eq\.pair-1&deleted_at=gt\./);
  assert.match(gone, /select=id,pair_id/);

  assert.throws(() => threadFilter("pair' or true", { mode: "latest", limit: 10 }));
  assert.throws(() => threadFilter("../pair", { mode: "latest", limit: 10 }));
  assert.throws(() => threadFilter("pair-1", { mode: "after", cursor: "not a date", limit: 10 }));
  assert.equal(cursorIso("2026-11-05T10:47:00Z"), "2026-11-05T10:47:00.000Z");
});

test("unread count ignores my messages, deletions, and what I already read", () => {
  const items = [
    { id: "1", authorUserId: "user-b", createdAt: "2026-11-05T10:00:00.000Z" },
    { id: "2", authorUserId: "user-a", createdAt: "2026-11-05T10:01:00.000Z" },
    { id: "3", authorUserId: "user-b", createdAt: "2026-11-05T10:02:00.000Z", deletedAt: "2026-11-05T10:03:00.000Z" },
    { id: "4", authorUserId: "user-b", createdAt: "2026-11-05T10:04:00.000Z" },
  ];
  assert.equal(countUnread(items, "user-a", "2026-11-05T10:00:00.000Z"), 1);
  assert.equal(countUnread(items, "user-a", null), 2);
  const filter = unreadFilter("pair-1", "user-a", "2026-11-05T10:00:00.000Z");
  assert.match(filter, /^pair_id=eq\.pair-1&author_user_id=neq\.user-a&/);
  assert.match(filter, /deleted_at=is\.null/);
  assert.throws(() => unreadFilter("pair-1", "user a", null));
});

test("read receipt follows the partner cursor, and deletes do not come back", () => {
  const mine = latestOwn(
    [
      { id: "a", authorUserId: "user-b", createdAt: "2026-11-05T10:00:00.000Z" },
      { id: "b", authorUserId: "user-a", createdAt: "2026-11-05T10:47:00.000Z" },
      { id: "c", authorUserId: "user-a", createdAt: "2026-11-05T09:00:00.000Z" },
    ],
    "user-a",
  );
  assert.equal(mine?.id, "b");
  assert.equal(partnerReadMine(mine?.createdAt ?? null, "2026-11-05T10:47:00.000Z"), true);
  assert.equal(partnerReadMine(mine?.createdAt ?? null, "2026-11-05T10:46:00.000Z"), false);
  const merged = mergeThread(
    [
      { id: "b", createdAt: "2026-11-05T10:47:00.000Z", body: "Омлет", deletedAt: null as string | null },
      { id: "old", createdAt: "2026-11-05T09:00:00.000Z", body: "Привет", deletedAt: null as string | null },
    ],
    [{ id: "new", createdAt: "2026-11-05T11:00:00.000Z", body: "тут" }],
    ["old"],
  );
  assert.deepEqual(
    merged.map((item) => item.id),
    ["b", "new"],
  );
  const dropped = mergeThread(merged, [{ id: "new", createdAt: "2026-11-05T11:00:00.000Z", deletedAt: "2026-11-05T11:01:00.000Z", body: "" }], []);
  assert.deepEqual(dropped.map((item) => item.id), ["b"]);
});

test("dates, emoji, and card snapshots stay readable", () => {
  const when = new Date(2026, 10, 5, 10, 47);
  assert.equal(chatClock(when.toISOString()), "10:47");
  assert.equal(chatDateLabel(when.toISOString()), "5 НОЯБРЯ");
  const groups = groupByDay([
    { createdAt: new Date(2026, 10, 5, 10, 0).toISOString(), id: "a" },
    { createdAt: new Date(2026, 10, 6, 6, 14).toISOString(), id: "b" },
  ]);
  assert.deepEqual(groups.map((group) => group.label), ["5 НОЯБРЯ", "6 НОЯБРЯ"]);
  assert.equal(cleanChatText("  привет ❤️ \u0000"), "привет ❤️");
  assert.equal(cleanChatText("я".repeat(TEXT_MAX + 20)).length, TEXT_MAX);
  assert.equal(prettyCardSubtitle("event", "2026-11-06"), "6 ноября");
  assert.equal(prettyCardSubtitle("wish", "очень хочу"), "очень хочу");
  assert.equal(badgeLabel(0), "");
  assert.equal(badgeLabel(12), "12");
  assert.equal(badgeLabel(120), "99+");
});

test("voice prefers mp4 and refuses a webm-only browser", () => {
  assert.equal(voiceMimeFor((type) => type === "audio/mp4"), "audio/mp4");
  assert.equal(voiceMimeFor((type) => type === "audio/webm"), null);
  assert.equal(voiceMimeFor(() => false), "audio/mp4");
  assert.equal(voiceMimeFor(null), "audio/mp4");
  assert.equal(voiceLikelySilent("audio/webm", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(voiceLikelySilent("audio/mp4", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), false);
  const mp4 = new Uint8Array(16);
  mp4.set([0, 0, 0, 20], 0);
  mp4.set([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 4);
  assert.equal(sniffAudio(mp4), "audio/mp4");
  assert.equal(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), "audio/webm");
  assert.equal(sniffAudio(new Uint8Array([1, 2, 3, 4])), null);
});

test("media paths cannot leave the pair", () => {
  const path = chatObjectPath("pair-1", "photo-1", "thumb", "webp");
  assert.equal(path, "pair-1/photo-1.thumb.webp");
  assert.equal(chatPathBelongs(path, "pair-1"), true);
  assert.equal(chatPathBelongs(path, "pair-2"), false);
  assert.equal(chatPathBelongs("pair-1/../photo-1.webp", "pair-1"), false);
  assert.equal(chatPathBelongs("/pair-1/photo-1.webp", "pair-1"), false);
  assert.throws(() => chatObjectPath("pair 1", "photo-1", "full", "webp"));
});

test("chat migration locks the tables and the bucket without a storage policy", () => {
  for (const file of ["migrations/0008_chat.sql", "supabase/migrations/20261113153000_chat.sql"]) {
    const sql = readFileSync(join(root, file), "utf8");
    const code = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(sql, /enable row level security/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /revoke all privileges/);
    assert.match(sql, /public = false/);
    assert.match(sql, /'chat'/);
    assert.doesNotMatch(code, /create policy/i);
    assert.doesNotMatch(code, /drop table/i);
  }
});

test("chat reads and writes go through the pair gate", () => {
  const source = readFileSync(join(root, "src/lib/chat-core.ts"), "utf8");
  const exported = [...source.matchAll(/^export async function /gm)].map((match) => match[0]);
  const gates = [...source.matchAll(/await gate\(/g)];
  assert.equal(exported.length, 10);
  assert.equal(gates.length, exported.length - 1);
  assert.match(source, /export async function removePairChat/);
  assert.doesNotMatch(source, /from "anon"|role:\s*"anon"/);
});
