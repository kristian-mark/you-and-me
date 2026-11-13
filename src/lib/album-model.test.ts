import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  absoluteSignedUrl,
  albumAfterRemoval,
  albumObjectPath,
  albumSpan,
  cleanTitle,
  DEFAULT_QUOTA_BYTES,
  fitsQuota,
  formatBytes,
  groupByMonth,
  looksLikeHeic,
  mergeFreshUrls,
  normalizeTakenAt,
  pathBelongsToPair,
  photoCountLabel,
  prepareStoredImage,
  removalQuery,
  purgeDeadline,
  quotaLimitBytes,
  readCaptureDate,
  sniffImage,
  trashDaysLeft,
  TRASH_DAYS,
  viewerStamp,
  withDownload,
} from "./album-model.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("quota defaults to 500 MB and ignores junk", () => {
  assert.equal(quotaLimitBytes(undefined), DEFAULT_QUOTA_BYTES);
  assert.equal(quotaLimitBytes("  "), DEFAULT_QUOTA_BYTES);
  assert.equal(quotaLimitBytes("nope"), DEFAULT_QUOTA_BYTES);
  assert.equal(quotaLimitBytes("100"), DEFAULT_QUOTA_BYTES);
  assert.equal(quotaLimitBytes(String(20 * 1024 * 1024)), 20 * 1024 * 1024);
});

test("byte labels stay in megabytes until a gigabyte", () => {
  assert.equal(formatBytes(0), "0 МБ");
  assert.equal(formatBytes(2.8 * 1024 * 1024), "2,8 МБ");
  assert.equal(formatBytes(500 * 1024 * 1024), "500 МБ");
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), "1,5 ГБ");
  assert.equal(photoCountLabel(4), "4 фото");
});

test("quota math refuses an upload that would pass the limit", () => {
  const limit = 500;
  assert.equal(fitsQuota(400, limit, 100), true);
  assert.equal(fitsQuota(400, limit, 101), false);
  assert.equal(fitsQuota(0, limit, 0), true);
});

test("trash stays 30 days and then is due", () => {
  const deleted = new Date("2026-11-01T00:00:00Z");
  const purge = purgeDeadline(deleted);
  assert.equal(purge.getTime() - deleted.getTime(), TRASH_DAYS * 24 * 60 * 60 * 1000);
  assert.equal(trashDaysLeft(purge.toISOString(), new Date("2026-11-20T00:00:00Z")), 11);
  assert.equal(trashDaysLeft(purge.toISOString(), new Date("2026-12-02T00:00:00Z")), 0);
});

test("capture clock is kept and a wild date falls back to now", () => {
  const now = new Date("2026-11-13T08:00:00Z");
  assert.equal(normalizeTakenAt("2026-11-12T23:29:01", now), "2026-11-12T23:29:01Z");
  assert.equal(normalizeTakenAt("1990-01-01T00:00:00Z", now), "1990-01-01T00:00:00Z");
  assert.match(normalizeTakenAt("1800-01-01T00:00:00Z", now), /^2026-11-13T/);
  assert.match(normalizeTakenAt("not a date", now), /^2026-11-13T/);
});

test("months group by capture date and today gets its own label", () => {
  const now = new Date(2026, 10, 13, 12, 0, 0);
  const groups = groupByMonth(
    [
      { id: "a", takenAt: "2026-11-13T09:00:00Z" },
      { id: "b", takenAt: "2026-10-02T09:00:00Z" },
      { id: "c", takenAt: "2026-11-13T18:00:00Z" },
    ],
    now,
  );
  assert.deepEqual(
    groups.map((group) => [group.label, group.photos.map((photo) => photo.id)]),
    [
      ["Сегодня", ["c", "a"]],
      ["Октябрь 2026", ["b"]],
    ],
  );
  assert.equal(
    albumSpan(["2026-10-02T09:00:00Z", "2026-11-13T09:00:00Z"]),
    "Октябрь — ноябрь 2026",
  );
  assert.equal(viewerStamp("2026-11-12T23:29:00Z"), "12 ноября в 23:29");
});

test("object paths stay inside the couple prefix", () => {
  const path = albumObjectPath("pair-1", "photo-1", "thumb", "image/webp");
  assert.equal(path, "pair-1/photo-1.thumb.webp");
  assert.equal(pathBelongsToPair(path, "pair-1"), true);
  assert.equal(pathBelongsToPair("pair-2/photo-1.webp", "pair-1"), false);
  assert.equal(pathBelongsToPair("../pair-1/photo-1.webp", "pair-1"), false);
  assert.equal(pathBelongsToPair("/pair-1/photo-1.webp", "pair-1"), false);
  assert.equal(pathBelongsToPair("pair-1/../photo-1.webp", "pair-1"), false);
  assert.throws(() => albumObjectPath("../x", "photo-1", "full", "image/jpeg"));
});

test("signed urls stay on the project and can force a download", () => {
  const url = absoluteSignedUrl(
    "https://vydpgldekbudzlmystvm.supabase.co/",
    "/object/sign/album/pair/photo.webp?token=abc",
  );
  assert.equal(
    url,
    "https://vydpgldekbudzlmystvm.supabase.co/storage/v1/object/sign/album/pair/photo.webp?token=abc",
  );
  assert.equal(withDownload(url, "photo.webp"), `${url}&download=photo.webp`);
});

test("a fresh signed url is kept until it is close to expiry", () => {
  const now = 1_000_000;
  const prev = [{ id: "a", thumbUrl: "old", expiresAt: now + 60 * 60 * 1000, takenAt: "x" }];
  const next = [{ id: "a", thumbUrl: "new", expiresAt: now + 6 * 60 * 60 * 1000, takenAt: "x" }];
  assert.equal(mergeFreshUrls(prev, next, now)[0].thumbUrl, "old");
  const stale = [{ id: "a", thumbUrl: "old", expiresAt: now + 60 * 1000, takenAt: "x" }];
  assert.equal(mergeFreshUrls(stale, next, now)[0].thumbUrl, "new");
});

test("removing a photo from an album leaves it in all photos", () => {
  const next = albumAfterRemoval({ photoIds: ["p1", "p2", "p3"], coverPhotoId: "p1" }, ["p1"]);
  assert.deepEqual(next, { photoIds: ["p2", "p3"], coverPhotoId: "p2" });
  const allPhotos = ["p1", "p2", "p3"];
  assert.deepEqual(
    allPhotos.filter((id) => !next.photoIds.includes(id)),
    ["p1"],
  );
  const query = removalQuery("pair-1", "album-1", ["p1"]);
  assert.match(query, /pair_id=eq\.pair-1/);
  assert.match(query, /album_id=eq\.album-1/);
  assert.match(query, /photo_id=in\.\("p1"\)/);
  assert.equal(query.includes("app_album_photos"), false);
});

test("titles lose control characters", () => {
  assert.equal(cleanTitle("  Котики \n"), "Котики");
  assert.equal(cleanTitle("   "), "");
});

test("jpeg exif date is read and then stripped, including a gps marker", () => {
  const jpeg = jpegWithExif("2026:11:12 23:29:01", "GPS 55.7 37.6");
  assert.equal(sniffImage(jpeg), "image/jpeg");
  assert.equal(readCaptureDate(jpeg), "2026-11-12T23:29:01");
  const stored = prepareStoredImage(jpeg);
  assert.ok(stored);
  assert.equal(stored.mime, "image/jpeg");
  assert.equal(readCaptureDate(stored.bytes), null);
  assert.equal(Buffer.from(stored.bytes).includes(Buffer.from("GPS")), false);
  assert.equal(stored.bytes[0], 0xff);
  assert.equal(stored.bytes[1], 0xd8);
});

test("webp exif chunk is removed and the image chunk stays", () => {
  const webp = webpWithExif();
  assert.equal(sniffImage(webp), "image/webp");
  assert.equal(readCaptureDate(webp), "2024-01-02T03:04:05");
  const stored = prepareStoredImage(webp);
  assert.ok(stored);
  assert.equal(Buffer.from(stored.bytes).includes(Buffer.from("EXIF")), false);
  assert.equal(Buffer.from(stored.bytes).includes(Buffer.from("FRAME")), true);
  assert.equal(sniffImage(stored.bytes), "image/webp");
});

test("heic brand is recognized and a planted exif date is readable", () => {
  const heic = heicWithExif();
  assert.equal(sniffImage(heic), "image/heic");
  assert.equal(looksLikeHeic(heic, "IMG.HEIC", ""), true);
  assert.equal(readCaptureDate(heic), "2026-11-12T23:29:01");
  assert.equal(prepareStoredImage(heic), null);
});

test("album migration enables rls, revokes anon, and creates no storage policy", () => {
  for (const file of [
    "migrations/0007_album.sql",
    "supabase/migrations/20261113120000_album.sql",
  ]) {
    const sql = readFileSync(join(root, file), "utf8");
    assert.match(sql, /enable row level security/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /revoke all privileges/);
    assert.match(sql, /public = false/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /'album'/);
  }
});

function jpegWithExif(date: string, gps: string) {
  const tiff = tiffWithDate(date);
  const payload = Buffer.concat([
    Buffer.from("Exif\0\0", "ascii"),
    tiff,
    Buffer.from(gps, "ascii"),
  ]);
  const app1 = Buffer.alloc(4 + payload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(payload.length + 2, 2);
  payload.copy(app1, 4);
  const comment = Buffer.from([0xff, 0xfe, 0x00, 0x05, 0x68, 0x69, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, comment, Buffer.from([0xff, 0xd9])]);
}

function tiffWithDate(date: string) {
  const text = Buffer.from(`${date}\0`, "ascii");
  assert.equal(text.length, 20);
  const tiff = Buffer.alloc(68);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32);
  tiff.writeUInt32LE(48, 36);
  tiff.writeUInt32LE(0, 40);
  text.copy(tiff, 48);
  return tiff;
}

function webpWithExif() {
  const exif = Buffer.concat([
    Buffer.from("Exif\0\0", "ascii"),
    tiffWithDate("2024:01:02 03:04:05"),
  ]);
  const vp8x = chunk("VP8X", Buffer.from([0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
  const exifChunk = chunk("EXIF", exif);
  const frame = chunk("VP8 ", Buffer.from("FRAME"));
  const body = Buffer.concat([Buffer.from("WEBP", "ascii"), vp8x, exifChunk, frame]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length, 0);
  return Buffer.concat([Buffer.from("RIFF", "ascii"), size, body]);
}

function chunk(type: string, data: Buffer) {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length, 0);
  const pad = data.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(type, "ascii"), size, data, pad]);
}

function heicWithExif() {
  const head = Buffer.alloc(16);
  head.writeUInt32BE(16, 0);
  head.write("ftypheic", 4, "ascii");
  const exif = Buffer.concat([
    Buffer.from("Exif\0\0", "ascii"),
    tiffWithDate("2026:11:12 23:29:01"),
  ]);
  return Buffer.concat([head, Buffer.from("pad"), exif]);
}
