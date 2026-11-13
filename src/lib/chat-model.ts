/** Pure chat rules: pair access, query shape, receipts, cards, and media limits. */

export const CHAT_BUCKET = "chat";
export const CHAT_POLL_MS = 4_000;
export const CHAT_BADGE_POLL_MS = 60_000;
export const CHAT_PAGE = 50;
export const TEXT_MAX = 2_000;
export const TITLE_MAX = 120;
export const SUBTITLE_MAX = 160;
export const MAX_VOICE_MS = 60_000;
export const MIN_VOICE_MS = 400;
export const MAX_VOICE_BYTES = 1_200_000;
export const URL_REFRESH_LEAD_MS = 30 * 60 * 1000;

export const CARD_KINDS = [
  "wish",
  "task",
  "event",
  "list",
  "album",
  "photo",
  "note",
  "loyalty",
] as const;

export type ChatCardKind = (typeof CARD_KINDS)[number];
export type ChatKind = "text" | "image" | "voice" | "card";

const LOCAL_CARDS = new Set<ChatCardKind>(["event", "list", "note", "loyalty"]);

export type ChatTarget = {
  kind: ChatCardKind;
  id: string;
  date?: string;
};

export type ChatCard = {
  kind: ChatCardKind;
  id: string;
  title: string;
  subtitle: string;
  removed: boolean;
  thumbUrl: string;
};

export type ChatMedia = {
  url: string;
  thumbUrl: string;
  mime: string;
  width: number;
  height: number;
  durationMs: number;
  expiresAt: number;
};

export type ChatDto = {
  id: string;
  authorUserId: string;
  kind: ChatKind;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  card: ChatCard | null;
  media: ChatMedia | null;
};

export type PairSeat = {
  id: string;
  aUserId: string;
  bUserId: string | null;
};

export type ChatAccess =
  | { ok: true; pairId: string; partnerId: string }
  | { ok: false; reason: "none" | "waiting" | "outsider" };

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

const MONTHS = [
  "ЯНВАРЯ",
  "ФЕВРАЛЯ",
  "МАРТА",
  "АПРЕЛЯ",
  "МАЯ",
  "ИЮНЯ",
  "ИЮЛЯ",
  "АВГУСТА",
  "СЕНТЯБРЯ",
  "ОКТЯБРЯ",
  "НОЯБРЯ",
  "ДЕКАБРЯ",
];

const MONTHS_LOWER = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MESSAGE_COLUMNS =
  "id,pair_id,author_user_id,kind,body,created_at,deleted_at,card_kind,card_id,card_title,card_subtitle,object_path,thumb_path,mime,byte_size,width,height,duration_ms";

export function assertChatId(value: string) {
  const id = value.trim();
  if (!SAFE_ID.test(id)) throw new Error("Некорректный идентификатор");
  return id;
}

export function chatAccess(userId: string, pair: PairSeat | null): ChatAccess {
  const actor = userId.trim();
  if (!actor || !pair?.id) return { ok: false, reason: "none" };
  const isA = actor === pair.aUserId;
  const isB = pair.bUserId !== null && actor === pair.bUserId;
  if (!isA && !isB) return { ok: false, reason: "outsider" };
  if (!pair.bUserId) return { ok: false, reason: "waiting" };
  return { ok: true, pairId: pair.id, partnerId: isA ? pair.bUserId : pair.aUserId };
}

export function isLocalCard(kind: ChatCardKind) {
  return LOCAL_CARDS.has(kind);
}

export function parseCardKind(value: unknown): ChatCardKind | null {
  return typeof value === "string" && (CARD_KINDS as readonly string[]).includes(value)
    ? (value as ChatCardKind)
    : null;
}

export function parseChatKind(value: unknown): ChatKind | null {
  return value === "text" || value === "image" || value === "voice" || value === "card" ? value : null;
}

export type SourceRow = { pairId: string; deleted: boolean } | null;

/** A shared server row must belong to this pair and still be alive. Local cards are snapshots. */
export function shareGate(kind: ChatCardKind, row: SourceRow, pairId: string): "ok" | "missing" | "foreign" {
  if (isLocalCard(kind)) return "ok";
  if (!row) return "missing";
  if (row.pairId !== pairId) return "foreign";
  if (row.deleted) return "missing";
  return "ok";
}

export function cardIsRemoved(kind: ChatCardKind, row: SourceRow, pairId: string) {
  return shareGate(kind, row, pairId) !== "ok";
}

export function canDeleteMessage(authorUserId: string, actorUserId: string, deletedAt: string | null) {
  return !deletedAt && authorUserId.length > 0 && authorUserId === actorUserId;
}

export function cleanChatText(raw: string) {
  let out = "";
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || code >= 32) out += char;
  }
  return out.trim().slice(0, TEXT_MAX);
}

export function cleanCardLine(raw: string, max: number) {
  return cleanChatText(raw).replace(/\s+/g, " ").slice(0, max);
}

export function cursorIso(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error("Некорректный курсор");
  return new Date(time).toISOString();
}

export function clampReadAt(value: string, now = Date.now()) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error("Некорректное время");
  return new Date(Math.min(time, now)).toISOString();
}

export function clampPage(value: number) {
  if (!Number.isFinite(value)) return CHAT_PAGE;
  return Math.max(1, Math.min(80, Math.floor(value)));
}

export function clampDuration(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_VOICE_MS, Math.max(0, Math.round(n)));
}

function pairEq(pairId: string) {
  return `pair_id=eq.${encodeURIComponent(assertChatId(pairId))}`;
}

export type ThreadQuery =
  | { mode: "latest"; limit: number }
  | { mode: "after"; cursor: string; limit: number }
  | { mode: "before"; cursor: string; limit: number }
  | { mode: "deleted"; cursor: string; limit: number };

/** Every message read is pinned to one pair. The cursor is a normalized timestamp, never raw input. */
export function threadFilter(pairId: string, query: ThreadQuery) {
  const pair = pairEq(pairId);
  const limit = clampPage(query.limit);
  if (query.mode === "latest") {
    return `${pair}&deleted_at=is.null&select=${MESSAGE_COLUMNS}&order=created_at.desc&limit=${limit}`;
  }
  const cursor = encodeURIComponent(cursorIso(query.cursor));
  if (query.mode === "after") {
    return `${pair}&created_at=gt.${cursor}&select=${MESSAGE_COLUMNS}&order=created_at.asc&limit=${limit}`;
  }
  if (query.mode === "before") {
    return `${pair}&deleted_at=is.null&created_at=lt.${cursor}&select=${MESSAGE_COLUMNS}&order=created_at.desc&limit=${limit}`;
  }
  return `${pair}&deleted_at=gt.${cursor}&select=id,pair_id&order=deleted_at.asc&limit=${limit}`;
}

export function unreadFilter(pairId: string, myUserId: string, readAt: string | null) {
  const pair = pairEq(pairId);
  const author = `author_user_id=neq.${encodeURIComponent(assertChatId(myUserId))}`;
  const since = readAt ? `&created_at=gt.${encodeURIComponent(cursorIso(readAt))}` : "";
  return `${pair}&${author}&deleted_at=is.null${since}&select=id&order=created_at.asc&limit=100`;
}

export function idsInPairFilter(pairId: string, ids: string[], columns: string) {
  const safe = ids.map((id) => assertChatId(id));
  if (!safe.length) throw new Error("Пустой список");
  return `${pairEq(pairId)}&id=in.(${safe.join(",")})&select=${columns}`;
}

export type ThreadStamp = {
  id: string;
  authorUserId: string;
  createdAt: string;
  deletedAt?: string | null;
};

export function countUnread(items: ThreadStamp[], myUserId: string, readAt: string | null) {
  const cursor = readAt ? Date.parse(readAt) : Number.NEGATIVE_INFINITY;
  if (readAt && !Number.isFinite(cursor)) return 0;
  let count = 0;
  for (const item of items) {
    if (item.deletedAt) continue;
    if (item.authorUserId === myUserId) continue;
    const at = Date.parse(item.createdAt);
    if (Number.isFinite(at) && at > cursor) count += 1;
  }
  return count;
}

export function latestOwn<T extends ThreadStamp>(items: T[], myUserId: string): T | null {
  let found: T | null = null;
  for (const item of items) {
    if (item.deletedAt || item.authorUserId !== myUserId) continue;
    if (!found || item.createdAt > found.createdAt) found = item;
  }
  return found;
}

export function partnerReadMine(myLatestAt: string | null, partnerReadAt: string | null) {
  if (!myLatestAt || !partnerReadAt) return false;
  const mine = Date.parse(myLatestAt);
  const read = Date.parse(partnerReadAt);
  if (!Number.isFinite(mine) || !Number.isFinite(read)) return false;
  return read >= mine;
}

export function badgeLabel(count: number) {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > 99) return "99+";
  return String(Math.floor(count));
}

export function mergeThread<T extends { id: string; createdAt: string; deletedAt?: string | null }>(
  current: T[],
  incoming: T[],
  deletedIds: string[],
): T[] {
  const drop = new Set(deletedIds);
  const map = new Map<string, T>();
  for (const item of current) {
    if (!drop.has(item.id) && !item.deletedAt) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (drop.has(item.id) || item.deletedAt) map.delete(item.id);
    else map.set(item.id, { ...map.get(item.id), ...item });
  }
  return [...map.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function chatClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function chatDayKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function chatDateLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function groupByDay<T extends { createdAt: string }>(items: T[]) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = chatDayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) groups.push({ key, label: chatDateLabel(item.createdAt), items: [item] });
    else last.items.push(item);
  }
  return groups;
}

export function prettyCardSubtitle(kind: ChatCardKind, subtitle: string) {
  if ((kind === "event" || kind === "task") && /^\d{4}-\d{2}-\d{2}$/.test(subtitle)) {
    const date = new Date(`${subtitle}T12:00:00`);
    if (Number.isNaN(date.getTime())) return subtitle;
    return `${date.getDate()} ${MONTHS_LOWER[date.getMonth()]}`;
  }
  return subtitle;
}

export function cardKindLabel(kind: ChatCardKind) {
  switch (kind) {
    case "wish":
      return "ХОТЕЛКА";
    case "task":
      return "ЗАДАЧА";
    case "event":
      return "СОБЫТИЕ";
    case "list":
      return "СПИСОК";
    case "album":
      return "АЛЬБОМ";
    case "photo":
      return "ФОТО";
    case "note":
      return "ЗАМЕТКА";
    case "loyalty":
      return "КАРТА";
  }
}

export function eventDateOf(subtitle: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(subtitle) ? subtitle : undefined;
}

const VOICE_PREFERRED = ["audio/mp4", "audio/aac"] as const;

/**
 * Record only AAC/MP4 so an iPhone can play what the other iPhone recorded.
 * WebM-only browsers hide the mic: that file would sit silent in iOS Safari.
 * When the browser cannot answer `isTypeSupported` but also cannot do WebM,
 * we still ask for audio/mp4 — older iOS reports false negatives.
 */
export function voiceMimeFor(isSupported: ((type: string) => boolean) | null) {
  if (!isSupported) return "audio/mp4";
  for (const type of VOICE_PREFERRED) {
    if (isSupported(type)) return type;
  }
  const webm = isSupported("audio/webm") || isSupported("audio/webm;codecs=opus");
  return webm ? null : "audio/mp4";
}

export function voiceCaptureSupported() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    voiceMimeFor(typeof MediaRecorder.isTypeSupported === "function" ? (type) => MediaRecorder.isTypeSupported(type) : null) !==
      null
  );
}

export function voiceLikelySilent(mime: string, ua: string) {
  return /iPhone|iPad|iPod/i.test(ua) && /webm|ogg/i.test(mime);
}

export function sniffAudio(bytes: Uint8Array): "audio/mp4" | "audio/webm" | "audio/mpeg" | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["isom", "iso2", "mp41", "mp42", "M4A ", "M4B ", "mp4a", "dash", "MSNV"].includes(brand)) {
      return "audio/mp4";
    }
  }
  return null;
}

export function audioExt(mime: "audio/mp4" | "audio/webm" | "audio/mpeg" | "audio/aac") {
  if (mime === "audio/webm") return "webm" as const;
  if (mime === "audio/mpeg") return "mp3" as const;
  return "m4a" as const;
}

export function chatObjectPath(
  pairId: string,
  id: string,
  role: "full" | "thumb" | "voice",
  ext: "webp" | "jpg" | "m4a" | "webm" | "mp3",
) {
  const pair = assertChatId(pairId);
  const media = assertChatId(id);
  const name =
    role === "full" ? `${media}.${ext}` : role === "thumb" ? `${media}.thumb.${ext}` : `${media}.voice.${ext}`;
  return `${pair}/${name}`;
}

export function chatPathBelongs(path: string, pairId: string) {
  if (!SAFE_ID.test(pairId)) return false;
  if (!path || path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  const [pair, name, extra] = path.split("/");
  if (extra !== undefined || pair !== pairId || !name) return false;
  return (
    /^[A-Za-z0-9_-]{1,80}\.(thumb\.)?(webp|jpg)$/.test(name) ||
    /^[A-Za-z0-9_-]{1,80}\.voice\.(m4a|webm|mp3)$/.test(name)
  );
}

export function mediaNeedsRefresh(expiresAt: number, now = Date.now()) {
  return expiresAt - now < URL_REFRESH_LEAD_MS;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  let out = "";
  for (let i = 0; i < length && start + i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[start + i] ?? 0);
  }
  return out;
}
