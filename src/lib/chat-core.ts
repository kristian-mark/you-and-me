import {
  ALBUM_BUCKET,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  SIGNED_URL_SECONDS,
  pathBelongsToPair,
  prepareStoredImage,
} from "@/lib/album-model";
import {
  CHAT_BUCKET,
  CHAT_PAGE,
  MAX_VOICE_BYTES,
  MIN_VOICE_MS,
  assertChatId,
  audioExt,
  canDeleteMessage,
  cardIsRemoved,
  chatAccess,
  chatObjectPath,
  chatPathBelongs,
  clampDuration,
  clampReadAt,
  idsInPairFilter,
  isLocalCard,
  parseCardKind,
  parseChatKind,
  shareGate,
  sniffAudio,
  threadFilter,
  unreadFilter,
  type ChatCardKind,
  type ChatDto,
  type ChatKind,
  type SourceRow,
} from "@/lib/chat-model";
import { membershipOf } from "@/lib/pair-access";
import { eqFilter, sbDelete, sbInsert, sbPatch, sbSelect, sbUpsert, storageRemove, storageSign, storageUpload } from "@/lib/supabase-app";

type MessageRow = {
  id: string;
  pair_id: string;
  author_user_id: string;
  kind: string;
  body: string | null;
  created_at: string;
  deleted_at: string | null;
  card_kind: string | null;
  card_id: string | null;
  card_title: string | null;
  card_subtitle: string | null;
  object_path: string | null;
  thumb_path: string | null;
  mime: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
};

export type ChatSync = {
  messages: ChatDto[];
  deletedIds: string[];
  myReadAt: string | null;
  partnerReadAt: string | null;
  unread: number;
  hasOlder: boolean;
};

const MESSAGE_COLUMNS =
  "id,pair_id,author_user_id,kind,body,created_at,deleted_at,card_kind,card_id,card_title,card_subtitle,object_path,thumb_path,mime,byte_size,width,height,duration_ms";

async function gate(userId: string) {
  const me = await membershipOf(userId);
  const access = chatAccess(
    userId,
    me?.pair
      ? { id: me.pair.id, aUserId: me.pair.a_user_id, bUserId: me.pair.b_user_id ?? null }
      : null,
  );
  if (!access.ok) throw new Error("Чат только для вашей пары");
  return access;
}

function iso(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function payloadDeleted(payload: unknown) {
  let value = payload;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return false;
    }
  }
  return Boolean(value && typeof value === "object" && (value as { deleted?: boolean }).deleted);
}

function dimension(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(8000, Math.round(value));
}

async function readMap(pairId: string) {
  const rows = await sbSelect<{ user_id: string; read_at: string }>(
    "app_chat_reads",
    `${eqFilter("pair_id", assertChatId(pairId))}&select=user_id,read_at`,
  );
  return new Map(rows.map((row) => [row.user_id, iso(row.read_at)]));
}

function cardIds(rows: MessageRow[], kind: ChatCardKind) {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.deleted_at || row.kind !== "card" || row.card_kind !== kind || !row.card_id) continue;
    try {
      const id = assertChatId(row.card_id);
      if (!ids.includes(id)) ids.push(id);
    } catch {
      // a bad id cannot be opened and is treated as removed
    }
  }
  return ids;
}

async function cardState(pairId: string, rows: MessageRow[]) {
  const alive = new Set<string>();
  const thumbs = new Map<string, string>();
  const wishes = cardIds(rows, "wish");
  const tasks = cardIds(rows, "task");
  const albums = cardIds(rows, "album");
  const photos = cardIds(rows, "photo");
  if (wishes.length) {
    const found = await sbSelect<{ id: string; payload: unknown }>(
      "app_wishes",
      idsInPairFilter(pairId, wishes, "id,payload"),
    );
    for (const row of found) if (!payloadDeleted(row.payload)) alive.add(`wish:${row.id}`);
  }
  if (tasks.length) {
    const found = await sbSelect<{ id: string; payload: unknown }>(
      "app_tasks",
      idsInPairFilter(pairId, tasks, "id,payload"),
    );
    for (const row of found) if (!payloadDeleted(row.payload)) alive.add(`task:${row.id}`);
  }
  if (albums.length) {
    const found = await sbSelect<{ id: string }>("app_albums", idsInPairFilter(pairId, albums, "id"));
    for (const row of found) alive.add(`album:${row.id}`);
  }
  if (photos.length) {
    const found = await sbSelect<{ id: string; thumb_path: string | null; deleted_at: string | null }>(
      "app_album_photos",
      idsInPairFilter(pairId, photos, "id,thumb_path,deleted_at"),
    );
    for (const row of found) {
      if (row.deleted_at) continue;
      alive.add(`photo:${row.id}`);
      if (row.thumb_path && pathBelongsToPair(row.thumb_path, pairId)) thumbs.set(row.id, row.thumb_path);
    }
  }
  return { alive, thumbs };
}

async function sourceOf(pairId: string, kind: ChatCardKind, id: string): Promise<SourceRow> {
  if (isLocalCard(kind)) return { pairId, deleted: false };
  const safe = assertChatId(id);
  if (kind === "wish" || kind === "task") {
    const table = kind === "wish" ? "app_wishes" : "app_tasks";
    const row = (
      await sbSelect<{ payload: unknown }>(table, idsInPairFilter(pairId, [safe], "id,payload"))
    )[0];
    if (!row) return null;
    return { pairId, deleted: payloadDeleted(row.payload) };
  }
  if (kind === "album") {
    const row = (await sbSelect<{ id: string }>("app_albums", idsInPairFilter(pairId, [safe], "id")))[0];
    return row ? { pairId, deleted: false } : null;
  }
  const row = (
    await sbSelect<{ deleted_at: string | null }>(
      "app_album_photos",
      idsInPairFilter(pairId, [safe], "id,deleted_at"),
    )
  )[0];
  if (!row) return null;
  return { pairId, deleted: Boolean(row.deleted_at) };
}

async function present(pairId: string, rows: MessageRow[]): Promise<ChatDto[]> {
  const mine = rows.filter((row) => row.pair_id === pairId);
  const { alive, thumbs } = await cardState(pairId, mine);
  const chatPaths: string[] = [];
  for (const row of mine) {
    if (row.deleted_at) continue;
    if ((row.kind === "image" || row.kind === "voice") && row.object_path && chatPathBelongs(row.object_path, pairId)) {
      chatPaths.push(row.object_path);
    }
    if (row.kind === "image" && row.thumb_path && chatPathBelongs(row.thumb_path, pairId)) {
      chatPaths.push(row.thumb_path);
    }
  }
  const [signedChat, signedAlbum] = await Promise.all([
    storageSign(CHAT_BUCKET, chatPaths, SIGNED_URL_SECONDS),
    storageSign(ALBUM_BUCKET, [...thumbs.values()], SIGNED_URL_SECONDS),
  ]);
  const expiresAt = Date.now() + SIGNED_URL_SECONDS * 1000;
  return mine.map((row) => toDto(pairId, row, alive, thumbs, signedChat, signedAlbum, expiresAt));
}

function toDto(
  pairId: string,
  row: MessageRow,
  alive: Set<string>,
  thumbs: Map<string, string>,
  signedChat: Map<string, string>,
  signedAlbum: Map<string, string>,
  expiresAt: number,
): ChatDto {
  const kind: ChatKind = parseChatKind(row.kind) ?? "text";
  const deletedAt = iso(row.deleted_at);
  const base: ChatDto = {
    id: row.id,
    authorUserId: row.author_user_id,
    kind,
    body: deletedAt ? "" : (row.body ?? ""),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    deletedAt,
    card: null,
    media: null,
  };
  if (deletedAt) return base;
  const cardKind = parseCardKind(row.card_kind);
  if (kind === "card" && cardKind && row.card_id) {
    const removed = cardIsRemoved(
      cardKind,
      isLocalCard(cardKind) ? { pairId, deleted: false } : alive.has(`${cardKind}:${row.card_id}`)
        ? { pairId, deleted: false }
        : null,
      pairId,
    );
    const thumbPath = cardKind === "photo" ? thumbs.get(row.card_id) : undefined;
    base.card = {
      kind: cardKind,
      id: row.card_id,
      title: row.card_title || "Без названия",
      subtitle: row.card_subtitle ?? "",
      removed,
      thumbUrl: thumbPath ? (signedAlbum.get(thumbPath) ?? "") : "",
    };
    return base;
  }
  if ((kind === "image" || kind === "voice") && row.object_path && chatPathBelongs(row.object_path, pairId)) {
    const url = signedChat.get(row.object_path) ?? "";
    const thumb = row.thumb_path && chatPathBelongs(row.thumb_path, pairId) ? (signedChat.get(row.thumb_path) ?? "") : "";
    if (url) {
      base.media = {
        url,
        thumbUrl: thumb || url,
        mime: row.mime ?? (kind === "voice" ? "audio/mp4" : "image/webp"),
        width: Number(row.width) || 0,
        height: Number(row.height) || 0,
        durationMs: Number(row.duration_ms) || 0,
        expiresAt,
      };
    }
  }
  return base;
}

async function loadMessages(pairId: string, query: Parameters<typeof threadFilter>[1]) {
  return sbSelect<MessageRow>("app_chat_messages", threadFilter(pairId, query));
}

export async function syncThread(
  userId: string,
  input: { after?: string | null; before?: string | null },
): Promise<ChatSync> {
  const access = await gate(userId);
  const limit = CHAT_PAGE;
  let rows: MessageRow[] = [];
  let deletedIds: string[] = [];
  let hasOlder = false;
  if (input.before) {
    rows = await loadMessages(access.pairId, { mode: "before", cursor: input.before, limit });
    hasOlder = rows.length === limit;
  } else if (input.after) {
    rows = await loadMessages(access.pairId, { mode: "after", cursor: input.after, limit });
    const gone = await sbSelect<{ id: string; pair_id: string }>(
      "app_chat_messages",
      threadFilter(access.pairId, { mode: "deleted", cursor: input.after, limit }),
    );
    deletedIds = gone.filter((row) => row.pair_id === access.pairId).map((row) => row.id);
  } else {
    rows = await loadMessages(access.pairId, { mode: "latest", limit });
    hasOlder = rows.length === limit;
  }
  const reads = await readMap(access.pairId);
  const myReadAt = reads.get(userId) ?? null;
  const unreadRows = await sbSelect<{ id: string }>(
    "app_chat_messages",
    unreadFilter(access.pairId, userId, myReadAt),
  );
  const messages = await present(access.pairId, rows);
  return {
    messages,
    deletedIds,
    myReadAt,
    partnerReadAt: reads.get(access.partnerId) ?? null,
    unread: unreadRows.length,
    hasOlder,
  };
}

export async function badgeFor(userId: string) {
  const access = await gate(userId);
  const reads = await readMap(access.pairId);
  const rows = await sbSelect<{ id: string }>(
    "app_chat_messages",
    unreadFilter(access.pairId, userId, reads.get(userId) ?? null),
  );
  return { unread: rows.length };
}

export async function sendText(userId: string, text: string) {
  const access = await gate(userId);
  if (!text) throw new Error("Пустое сообщение");
  const row = (await sbInsert("app_chat_messages", {
    id: crypto.randomUUID(),
    pair_id: access.pairId,
    author_user_id: userId,
    kind: "text",
    body: text,
  })) as MessageRow;
  return one(access.pairId, row);
}

export async function sendCard(
  userId: string,
  input: { kind: ChatCardKind; id: string; title: string; subtitle: string },
) {
  const access = await gate(userId);
  const source = await sourceOf(access.pairId, input.kind, input.id);
  const gateResult = shareGate(input.kind, source, access.pairId);
  if (gateResult === "foreign") throw new Error("Чужая запись");
  if (gateResult === "missing") throw new Error("Уже удалено");
  const row = (await sbInsert("app_chat_messages", {
    id: crypto.randomUUID(),
    pair_id: access.pairId,
    author_user_id: userId,
    kind: "card",
    card_kind: input.kind,
    card_id: assertChatId(input.id),
    card_title: input.title || "Без названия",
    card_subtitle: input.subtitle || null,
  })) as MessageRow;
  return one(access.pairId, row);
}

export async function deleteOwn(userId: string, messageId: string) {
  const access = await gate(userId);
  const id = assertChatId(messageId);
  const row = (
    await sbSelect<MessageRow>(
      "app_chat_messages",
      `${eqFilter("pair_id", access.pairId)}&${eqFilter("id", id)}&select=${MESSAGE_COLUMNS}`,
    )
  )[0];
  if (!row || row.pair_id !== access.pairId) return id;
  if (!canDeleteMessage(row.author_user_id, userId, row.deleted_at)) {
    throw new Error("Можно удалить только своё");
  }
  const paths = [row.object_path, row.thumb_path].filter((path): path is string =>
    Boolean(path && chatPathBelongs(path, access.pairId)),
  );
  await sbPatch(
    "app_chat_messages",
    `${eqFilter("pair_id", access.pairId)}&${eqFilter("id", id)}&${eqFilter("author_user_id", userId)}`,
    {
      deleted_at: new Date().toISOString(),
      body: null,
      object_path: null,
      thumb_path: null,
    },
  );
  if (paths.length) await storageRemove(CHAT_BUCKET, paths);
  return id;
}

export async function markRead(userId: string, at: string) {
  const access = await gate(userId);
  const readAt = clampReadAt(at);
  await sbUpsert(
    "app_chat_reads",
    { pair_id: access.pairId, user_id: userId, read_at: readAt },
    "pair_id,user_id",
  );
  return readAt;
}

export async function refreshMedia(userId: string, ids: string[]) {
  const access = await gate(userId);
  const safe = [...new Set(ids.map((id) => assertChatId(id)))].slice(0, 80);
  if (!safe.length) return [] as ChatDto[];
  const rows = await sbSelect<MessageRow>(
    "app_chat_messages",
    idsInPairFilter(access.pairId, safe, MESSAGE_COLUMNS),
  );
  return present(access.pairId, rows);
}

async function one(pairId: string, row: MessageRow) {
  const dto = (await present(pairId, [row]))[0];
  if (!dto) throw new Error("Не ушло");
  return dto;
}

async function insertMedia(pairId: string, row: Record<string, unknown>, paths: string[]) {
  try {
    const saved = (await sbInsert("app_chat_messages", row)) as MessageRow;
    return await one(pairId, saved);
  } catch (error) {
    await storageRemove(CHAT_BUCKET, paths);
    throw error;
  }
}

export async function saveChatImage(
  userId: string,
  full: Uint8Array,
  thumb: Uint8Array,
  width: number,
  height: number,
) {
  const access = await gate(userId);
  const fullImage = prepareStoredImage(full, MAX_FULL_BYTES);
  const thumbImage = prepareStoredImage(thumb, MAX_THUMB_BYTES);
  if (!fullImage || !thumbImage) throw new Error("Это не фото");
  const id = crypto.randomUUID();
  const fullExt = fullImage.mime === "image/jpeg" ? "jpg" : "webp";
  const thumbExt = thumbImage.mime === "image/jpeg" ? "jpg" : "webp";
  const objectPath = chatObjectPath(access.pairId, id, "full", fullExt);
  const thumbPath = chatObjectPath(access.pairId, id, "thumb", thumbExt);
  const okFull = await storageUpload(CHAT_BUCKET, objectPath, fullImage.bytes, fullImage.mime);
  const okThumb = await storageUpload(CHAT_BUCKET, thumbPath, thumbImage.bytes, thumbImage.mime);
  if (!okFull || !okThumb) {
    await storageRemove(CHAT_BUCKET, [objectPath, thumbPath]);
    throw new Error("Фото не сохранилось");
  }
  return insertMedia(
    access.pairId,
    {
      id,
      pair_id: access.pairId,
      author_user_id: userId,
      kind: "image",
      byte_size: fullImage.bytes.length + thumbImage.bytes.length,
      width: dimension(width),
      height: dimension(height),
      mime: fullImage.mime,
      object_path: objectPath,
      thumb_path: thumbPath,
    },
    [objectPath, thumbPath],
  );
}

export async function saveChatVoice(userId: string, bytes: Uint8Array, durationMs: number) {
  const access = await gate(userId);
  if (!bytes.length || bytes.length > MAX_VOICE_BYTES) throw new Error("Голосовое слишком большое");
  const sniffed = sniffAudio(bytes);
  if (!sniffed || sniffed === "audio/webm") throw new Error("Это голосовое не откроется на iPhone");
  const duration = clampDuration(durationMs);
  if (duration < MIN_VOICE_MS) throw new Error("Слишком короткое");
  const id = crypto.randomUUID();
  const objectPath = chatObjectPath(access.pairId, id, "voice", audioExt(sniffed));
  const ok = await storageUpload(CHAT_BUCKET, objectPath, bytes, sniffed === "audio/mpeg" ? "audio/mpeg" : "audio/mp4");
  if (!ok) throw new Error("Голосовое не сохранилось");
  return insertMedia(
    access.pairId,
    {
      id,
      pair_id: access.pairId,
      author_user_id: userId,
      kind: "voice",
      mime: sniffed === "audio/mpeg" ? "audio/mpeg" : "audio/mp4",
      byte_size: bytes.length,
      duration_ms: duration,
      object_path: objectPath,
    },
    [objectPath],
  );
}

export async function removePairChat(pairId: string) {
  let safe = "";
  try {
    safe = assertChatId(pairId);
  } catch {
    return;
  }
  try {
    const rows = await sbSelect<{ object_path: string | null; thumb_path: string | null }>(
      "app_chat_messages",
      `${eqFilter("pair_id", safe)}&select=object_path,thumb_path`,
    );
    const paths = rows.flatMap((row) => [row.object_path, row.thumb_path]).filter((path): path is string =>
      Boolean(path && chatPathBelongs(path, safe)),
    );
    if (paths.length) await storageRemove(CHAT_BUCKET, paths);
    await sbDelete("app_chat_messages", eqFilter("pair_id", safe));
    await sbDelete("app_chat_reads", eqFilter("pair_id", safe));
  } catch (error) {
    if (error instanceof Error && error.message === "supabase 404") return;
    throw error;
  }
}
