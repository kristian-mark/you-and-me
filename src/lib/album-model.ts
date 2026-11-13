/** Pure album rules: quota, dates, paths, and stripping EXIF before storage. */

export const ALBUM_BUCKET = "album";
export const DEFAULT_QUOTA_BYTES = 500 * 1024 * 1024;
export const MAX_FULL_BYTES = 3_500_000;
export const MAX_THUMB_BYTES = 400_000;
export const TRASH_DAYS = 30;
export const SIGNED_URL_SECONDS = 6 * 60 * 60;
export const URL_REFRESH_MS = 30 * 60 * 1000;

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const MONTHS_GENITIVE = [
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

export type StoredMime = "image/webp" | "image/jpeg";

export function quotaLimitBytes(raw: string | undefined) {
  if (!raw?.trim()) return DEFAULT_QUOTA_BYTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1024 * 1024) return DEFAULT_QUOTA_BYTES;
  return Math.floor(n);
}

export function formatBytes(bytes: number) {
  const n = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (n >= 1024 * 1024 * 1024) return `${trimNum(n / (1024 * 1024 * 1024))} ГБ`;
  return `${trimNum(n / (1024 * 1024))} МБ`;
}

function trimNum(value: number) {
  const text = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return text.replace(/\.0$/, "").replace(".", ",");
}

export function usedRatio(used: number, limit: number) {
  if (limit <= 0) return 1;
  return Math.min(1, Math.max(0, used / limit));
}

export function fitsQuota(used: number, limit: number, incoming: number) {
  return incoming >= 0 && used + incoming <= limit;
}

export function purgeDeadline(deletedAt: Date) {
  return new Date(deletedAt.getTime() + TRASH_DAYS * 24 * 60 * 60 * 1000);
}

export function isDueForPurge(purgeAt: string, now: Date) {
  const at = Date.parse(purgeAt);
  return !Number.isNaN(at) && at <= now.getTime();
}

export function trashDaysLeft(purgeAt: string, now: Date) {
  const at = Date.parse(purgeAt);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.ceil((at - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function photoCountLabel(count: number) {
  return `${count} фото`;
}

const STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export function clockParts(value: string) {
  const match = value.match(STAMP);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return {
    year: Number(match[1]),
    month,
    day,
    hour,
    minute,
    second,
    dayKey: `${match[1]}-${match[2]}-${match[3]}`,
    monthKey: `${match[1]}-${match[2]}`,
  };
}

export function localStamp(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/** Keep the camera clock. Store it as UTC so Postgres does not shift the month. */
export function normalizeTakenAt(raw: string | undefined, now: Date) {
  const parts = raw ? clockParts(raw) : null;
  const fallback = clockParts(localStamp(now));
  const use = parts ?? fallback;
  if (!use) return new Date(now).toISOString();
  const wall = Date.UTC(use.year, use.month - 1, use.day, use.hour, use.minute, use.second);
  const future = wall - now.getTime();
  if (use.year < 1970 || future > 36 * 60 * 60 * 1000) {
    return new Date(now).toISOString();
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${use.year}-${pad(use.month)}-${pad(use.day)}T${pad(use.hour)}:${pad(use.minute)}:${pad(use.second)}Z`;
}

function monthName(monthKey: string) {
  const month = Number(monthKey.slice(5, 7));
  return MONTHS[month - 1] ?? monthKey;
}

function capital(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function viewerStamp(takenAt: string) {
  const parts = clockParts(takenAt);
  if (!parts) return "";
  const name = MONTHS_GENITIVE[parts.month - 1] ?? monthName(parts.monthKey);
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return `${parts.day} ${name} в ${hh}:${mm}`;
}

export function albumSpan(takenAts: string[]) {
  const keys = takenAts
    .map((value) => clockParts(value)?.monthKey)
    .filter((key): key is string => Boolean(key));
  if (!keys.length) return "";
  keys.sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === last) return capital(`${monthName(first)} ${first.slice(0, 4)}`);
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${capital(monthName(first))} — ${monthName(last)} ${last.slice(0, 4)}`;
  }
  return `${capital(monthName(first))} ${first.slice(0, 4)} — ${monthName(last)} ${last.slice(0, 4)}`;
}

export type MonthGroup<T> = { key: string; label: string; photos: T[] };

export function groupByMonth<T extends { takenAt: string }>(
  photos: T[],
  now = new Date(),
): MonthGroup<T>[] {
  const today = localStamp(now).slice(0, 10);
  const buckets = new Map<string, T[]>();
  const ordered = [...photos].sort((a, b) =>
    a.takenAt < b.takenAt ? 1 : a.takenAt > b.takenAt ? -1 : 0,
  );
  for (const photo of ordered) {
    const parts = clockParts(photo.takenAt);
    const key = parts?.monthKey ?? "unknown";
    const list = buckets.get(key);
    if (list) list.push(photo);
    else buckets.set(key, [photo]);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => {
      const allToday = items.every((photo) => clockParts(photo.takenAt)?.dayKey === today);
      const label = allToday
        ? "Сегодня"
        : key === "unknown"
          ? "Без даты"
          : capital(`${monthName(key)} ${key.slice(0, 4)}`);
      return { key, label, photos: items };
    });
}

export function cleanTitle(raw: string) {
  let title = "";
  for (const char of raw) {
    if (char.charCodeAt(0) >= 32) title += char;
  }
  return title.trim().slice(0, 80);
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;

export function albumObjectPath(
  pairId: string,
  photoId: string,
  kind: "full" | "thumb",
  mime: StoredMime,
) {
  if (!SAFE_SEGMENT.test(pairId) || !SAFE_SEGMENT.test(photoId)) {
    throw new Error("Некорректный идентификатор");
  }
  const ext = mime === "image/webp" ? "webp" : "jpg";
  const name = kind === "thumb" ? `${photoId}.thumb.${ext}` : `${photoId}.${ext}`;
  return `${pairId}/${name}`;
}

export function pathBelongsToPair(path: string, pairId: string) {
  if (!SAFE_SEGMENT.test(pairId)) return false;
  if (!path || path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  const [pair, name, extra] = path.split("/");
  if (extra !== undefined || pair !== pairId || !name) return false;
  return /^[A-Za-z0-9_-]{1,80}\.(thumb\.)?(webp|jpg)$/.test(name);
}

export function absoluteSignedUrl(projectUrl: string, signedPath: string) {
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  const root = projectUrl.replace(/\/$/, "");
  const path = signedPath.startsWith("/") ? signedPath : `/${signedPath}`;
  if (path.startsWith("/storage/v1/")) return `${root}${path}`;
  return `${root}/storage/v1${path}`;
}

export function withDownload(url: string, filename: string) {
  const safe = filename.replace(/[^\w.-]+/g, "") || "photo.webp";
  const hashAt = url.indexOf("#");
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}download=${encodeURIComponent(safe)}`;
}

export type UrlCarrier = { id: string; thumbUrl: string; expiresAt: number };

export function mergeFreshUrls<T extends UrlCarrier>(prev: T[] | null, next: T[], now: number) {
  if (!prev?.length) return next;
  const old = new Map(prev.map((item) => [item.id, item]));
  return next.map((item) => {
    const was = old.get(item.id);
    if (was?.thumbUrl && was.expiresAt > now + URL_REFRESH_MS) {
      return { ...item, thumbUrl: was.thumbUrl, expiresAt: was.expiresAt };
    }
    return item;
  });
}

export function sniffImage(bytes: Uint8Array): StoredMime | "image/heic" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand))
      return "image/heic";
  }
  return null;
}

export function looksLikeHeic(bytes: Uint8Array, name: string, type: string) {
  if (/heic|heif/i.test(type) || /\.(heic|heif)$/i.test(name)) return true;
  return sniffImage(bytes) === "image/heic";
}

export function prepareStoredImage(
  bytes: Uint8Array,
  maxBytes = MAX_FULL_BYTES,
): { mime: StoredMime; bytes: Uint8Array } | null {
  const sniffed = sniffImage(bytes);
  if (sniffed !== "image/jpeg" && sniffed !== "image/webp") return null;
  const stripped = sniffed === "image/jpeg" ? stripJpeg(bytes) : stripWebp(bytes);
  if (!stripped.length || stripped.length > maxBytes) return null;
  if (sniffImage(stripped) !== sniffed) return null;
  return { mime: sniffed, bytes: stripped };
}

export function readCaptureDate(bytes: Uint8Array) {
  const tiff = findExifTiff(bytes);
  if (!tiff) return null;
  const raw = readTiffDate(tiff);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const stamp = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  return clockParts(stamp) ? stamp : null;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  let out = "";
  for (let i = 0; i < length && start + i < bytes.length; i += 1)
    out += String.fromCharCode(bytes[start + i]);
  return out;
}

function findExifTiff(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xd8) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null;
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2 || i + 2 + len > bytes.length) return null;
      if (marker === 0xe1 && ascii(bytes, i + 4, 6) === "Exif\0\0") {
        return bytes.subarray(i + 10, i + 2 + len);
      }
      i += 2 + len;
    }
  }
  const needle = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const cap = Math.min(bytes.length, 2_000_000);
  for (let i = 0; i + 16 < cap; i += 1) {
    let found = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return bytes.subarray(i + 6);
  }
  return null;
}

function readTiffDate(tiff: Uint8Array) {
  if (tiff.length < 8) return null;
  const little = ascii(tiff, 0, 2) === "II";
  if (!little && ascii(tiff, 0, 2) !== "MM") return null;
  const u16 = (offset: number) => {
    if (offset + 2 > tiff.length) return null;
    return little ? tiff[offset] | (tiff[offset + 1] << 8) : (tiff[offset] << 8) | tiff[offset + 1];
  };
  const u32 = (offset: number) => {
    if (offset + 4 > tiff.length) return null;
    const b = [tiff[offset], tiff[offset + 1], tiff[offset + 2], tiff[offset + 3]];
    return little
      ? (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0
      : ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  };
  if (u16(2) !== 42) return null;
  const ifd0 = u32(4);
  if (ifd0 == null) return null;
  const date = readIfdDate(ifd0, u16, u32, tiff, true);
  return date;
}

function readIfdDate(
  offset: number,
  u16: (offset: number) => number | null,
  u32: (offset: number) => number | null,
  tiff: Uint8Array,
  followExif: boolean,
): string | null {
  const count = u16(offset);
  if (count == null || count > 256) return null;
  let exifAt: number | null = null;
  let original: string | null = null;
  let fallback: string | null = null;
  for (let i = 0; i < count; i += 1) {
    const entry = offset + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const n = u32(entry + 4);
    if (tag == null || type == null || n == null) break;
    if (followExif && tag === 0x8769 && type === 4) exifAt = u32(entry + 8);
    if (type === 2 && (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && n >= 19 && n <= 32) {
      const start = n <= 4 ? entry + 8 : u32(entry + 8);
      if (start == null || start + 19 > tiff.length) continue;
      const text = ascii(tiff, start, 19);
      if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
        if (tag === 0x9003) original = text;
        else if (!fallback) fallback = text;
      }
    }
  }
  if (original) return original;
  if (followExif && exifAt != null) {
    const nested = readIfdDate(exifAt, u16, u32, tiff, false);
    if (nested) return nested;
  }
  return fallback;
}

function concatBytes(parts: Uint8Array[]) {
  let n = 0;
  for (const part of parts) n += part.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function stripJpeg(bytes: Uint8Array) {
  const parts: Uint8Array[] = [Uint8Array.of(0xff, 0xd8)];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      parts.push(Uint8Array.of(0xff, 0xd9));
      return concatBytes(parts);
    }
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      return concatBytes(parts);
    }
    if (i + 4 > bytes.length) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) break;
    const drop = marker === 0xe1 || marker === 0xed;
    if (!drop) parts.push(bytes.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Uint8Array.of();
}

function stripWebp(bytes: Uint8Array) {
  if (sniffImage(bytes) !== "image/webp" || bytes.length < 12) return bytes;
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const size = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24);
    const dataStart = i + 8;
    const dataEnd = dataStart + size;
    if (size < 0 || dataEnd > bytes.length) return bytes;
    const pad = size % 2 === 1 && dataEnd < bytes.length ? 1 : 0;
    if (type === "EXIF" || type === "XMP ") {
      i = dataEnd + pad;
      continue;
    }
    if (type === "VP8X" && size >= 1) {
      const copy = bytes.slice(i, dataEnd + pad);
      copy[8] = copy[8] & ~0x0c;
      chunks.push(copy);
    } else {
      chunks.push(bytes.subarray(i, dataEnd + pad));
    }
    i = dataEnd + pad;
  }
  let payload = 4;
  for (const chunk of chunks) payload += chunk.length;
  const out = new Uint8Array(8 + payload);
  out.set(bytes.subarray(0, 4), 0);
  out[4] = payload & 0xff;
  out[5] = (payload >> 8) & 0xff;
  out[6] = (payload >> 16) & 0xff;
  out[7] = (payload >> 24) & 0xff;
  out.set(bytes.subarray(8, 12), 8);
  let at = 12;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
