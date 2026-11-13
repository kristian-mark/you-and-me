import { env } from "@/lib/env.server";
import {
  ALBUM_BUCKET,
  albumObjectPath,
  cleanTitle,
  fitsQuota,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  normalizeTakenAt,
  pathBelongsToPair,
  prepareStoredImage,
  purgeDeadline,
  quotaLimitBytes,
  SIGNED_URL_SECONDS,
  trashDaysLeft,
  type StoredMime,
} from "@/lib/album-model";
import { myPairId } from "@/lib/pair-access";
import {
  assertSafeId,
  eqFilter,
  sbDelete,
  sbInsert,
  sbInsertMany,
  sbPatch,
  sbSelectAll,
  storageRemove,
  storageSign,
  storageUpload,
} from "@/lib/supabase-app";

export type AlbumPhoto = {
  id: string;
  takenAt: string;
  authorUserId: string;
  byteSize: number;
  width: number;
  height: number;
  thumbUrl: string;
  expiresAt: number;
  likedByMe: boolean;
  likedByPartner: boolean;
  albumIds: string[];
};

export type AlbumCard = {
  id: string;
  title: string;
  coverPhotoId: string | null;
  photoIds: string[];
};

export type AlbumQuota = {
  used: number;
  limit: number;
  free: number;
  trashBytes: number;
  photoCount: number;
  trashCount: number;
};

export type AlbumHome = {
  photos: AlbumPhoto[];
  albums: AlbumCard[];
  quota: AlbumQuota;
};

export type TrashPhoto = {
  id: string;
  takenAt: string;
  authorUserId: string;
  byteSize: number;
  thumbUrl: string;
  expiresAt: number;
  purgeAt: string;
  daysLeft: number;
};

type PhotoRow = {
  id: string;
  pair_id: string;
  author_user_id: string;
  taken_at: string;
  byte_size: number;
  width: number;
  height: number;
  mime: string;
  object_path: string;
  thumb_path: string;
  deleted_at: string | null;
  purge_at: string | null;
};

type AlbumRow = {
  id: string;
  pair_id: string;
  title: string;
  cover_photo_id: string | null;
};

type ItemRow = { album_id: string; photo_id: string };
type LikeRow = { photo_id: string; user_id: string };

const RECENT_THUMBS = 16;

function idsOf(values: string[], cap = 200) {
  const out: string[] = [];
  for (const value of values) {
    if (out.length >= cap) break;
    try {
      const id = assertSafeId(value);
      if (!out.includes(id)) out.push(id);
    } catch {
      // skip a bad id instead of failing the whole batch
    }
  }
  return out;
}

function inFilter(column: string, ids: string[]) {
  return `${column}=in.(${ids.map((id) => assertSafeId(id)).join(",")})`;
}

async function requirePair(userId: string) {
  const pairId = await myPairId(userId);
  if (!pairId) throw new Error("Сначала соединитесь парой");
  return assertSafeId(pairId);
}

function limitBytes() {
  return quotaLimitBytes(env("ALBUM_QUOTA_BYTES"));
}

async function usedBytes(pairId: string) {
  const rows = await sbSelectAll<{ byte_size: number }>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=is.null&select=byte_size`,
  );
  return rows.reduce((sum, row) => sum + (Number(row.byte_size) || 0), 0);
}

export async function purgePairAlbum(pairId: string) {
  const now = new Date().toISOString();
  const due = await sbSelectAll<Pick<PhotoRow, "id" | "object_path" | "thumb_path">>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&purge_at=lte.${encodeURIComponent(now)}&select=id,object_path,thumb_path`,
  );
  await dropPhotoFiles(pairId, due);
}

export async function purgeExpiredAlbums() {
  const now = new Date().toISOString();
  const due = await sbSelectAll<Pick<PhotoRow, "id" | "pair_id" | "object_path" | "thumb_path">>(
    "app_album_photos",
    `deleted_at=not.is.null&purge_at=lte.${encodeURIComponent(now)}&select=id,pair_id,object_path,thumb_path`,
  );
  const byPair = new Map<string, Pick<PhotoRow, "id" | "object_path" | "thumb_path">[]>();
  for (const row of due) {
    const list = byPair.get(row.pair_id) ?? [];
    list.push(row);
    byPair.set(row.pair_id, list);
  }
  for (const [pairId, rows] of byPair) {
    if (!pathBelongsToPair(`${pairId}/x.webp`, pairId) && !/^[A-Za-z0-9_-]{1,80}$/.test(pairId))
      continue;
    await dropPhotoFiles(pairId, rows);
  }
  return due.length;
}

async function dropPhotoFiles(
  pairId: string,
  rows: Pick<PhotoRow, "id" | "object_path" | "thumb_path">[],
) {
  const mine = rows.filter(
    (row) =>
      pathBelongsToPair(row.object_path, pairId) && pathBelongsToPair(row.thumb_path, pairId),
  );
  if (!mine.length) return;
  await storageRemove(
    ALBUM_BUCKET,
    mine.flatMap((row) => [row.object_path, row.thumb_path]),
  );
  await sbDelete(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&${inFilter(
      "id",
      mine.map((row) => row.id),
    )}`,
  );
}

async function signThumbs(paths: string[]) {
  const signed = await storageSign(ALBUM_BUCKET, paths, SIGNED_URL_SECONDS);
  return { signed, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 };
}

function photoDto(
  row: PhotoRow,
  userId: string,
  albumIds: string[],
  likes: LikeRow[],
  thumbUrl: string,
  expiresAt: number,
): AlbumPhoto {
  const mine = likes.filter((like) => like.photo_id === row.id);
  return {
    id: row.id,
    takenAt: row.taken_at,
    authorUserId: row.author_user_id,
    byteSize: Number(row.byte_size) || 0,
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    thumbUrl,
    expiresAt: thumbUrl ? expiresAt : 0,
    likedByMe: mine.some((like) => like.user_id === userId),
    likedByPartner: mine.some((like) => like.user_id !== userId),
    albumIds,
  };
}

export async function loadAlbumHome(userId: string): Promise<AlbumHome> {
  const pairId = await requirePair(userId);
  await purgePairAlbum(pairId);
  const [live, trash, albums, items, likes] = await Promise.all([
    sbSelectAll<PhotoRow>(
      "app_album_photos",
      `${eqFilter("pair_id", pairId)}&deleted_at=is.null&select=*&order=taken_at.desc`,
    ),
    sbSelectAll<{ byte_size: number }>(
      "app_album_photos",
      `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&select=byte_size`,
    ),
    sbSelectAll<AlbumRow>(
      "app_albums",
      `${eqFilter("pair_id", pairId)}&select=id,pair_id,title,cover_photo_id&order=updated_at.desc`,
    ),
    sbSelectAll<ItemRow>(
      "app_album_items",
      `${eqFilter("pair_id", pairId)}&select=album_id,photo_id`,
    ),
    sbSelectAll<LikeRow>(
      "app_album_likes",
      `${eqFilter("pair_id", pairId)}&select=photo_id,user_id`,
    ),
  ]);
  const liveIds = new Set(live.map((row) => row.id));
  const albumsOut: AlbumCard[] = albums.map((album) => {
    const photoIds = items
      .filter((item) => item.album_id === album.id && liveIds.has(item.photo_id))
      .map((item) => item.photo_id);
    const cover = photoIds.includes(album.cover_photo_id ?? "")
      ? album.cover_photo_id
      : (photoIds[0] ?? null);
    return { id: album.id, title: album.title, coverPhotoId: cover, photoIds };
  });
  const wanted = new Set(live.slice(0, RECENT_THUMBS).map((row) => row.id));
  for (const album of albumsOut) if (album.coverPhotoId) wanted.add(album.coverPhotoId);
  const toSign = live.filter((row) => wanted.has(row.id)).map((row) => row.thumb_path);
  const { signed, expiresAt } = await signThumbs(toSign);
  const byPhoto = new Map<string, string[]>();
  for (const album of albumsOut) {
    for (const photoId of album.photoIds) {
      const list = byPhoto.get(photoId) ?? [];
      list.push(album.id);
      byPhoto.set(photoId, list);
    }
  }
  const used = live.reduce((sum, row) => sum + (Number(row.byte_size) || 0), 0);
  const trashBytes = trash.reduce((sum, row) => sum + (Number(row.byte_size) || 0), 0);
  const limit = limitBytes();
  return {
    photos: live.map((row) =>
      photoDto(
        row,
        userId,
        byPhoto.get(row.id) ?? [],
        likes,
        signed.get(row.thumb_path) ?? "",
        expiresAt,
      ),
    ),
    albums: albumsOut,
    quota: {
      used,
      limit,
      free: Math.max(0, limit - used),
      trashBytes,
      photoCount: live.length,
      trashCount: trash.length,
    },
  };
}

export async function signAlbumThumbs(userId: string, photoIds: string[]) {
  const pairId = await requirePair(userId);
  const ids = idsOf(photoIds, 120);
  if (!ids.length) return [] as { id: string; thumbUrl: string; expiresAt: number }[];
  const rows = await sbSelectAll<Pick<PhotoRow, "id" | "thumb_path">>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=is.null&${inFilter("id", ids)}&select=id,thumb_path`,
  );
  const safe = rows.filter((row) => pathBelongsToPair(row.thumb_path, pairId));
  const { signed, expiresAt } = await signThumbs(safe.map((row) => row.thumb_path));
  return safe
    .map((row) => ({ id: row.id, thumbUrl: signed.get(row.thumb_path) ?? "", expiresAt }))
    .filter((row) => row.thumbUrl);
}

export async function signAlbumFull(userId: string, photoId: string, download: boolean) {
  const pairId = await requirePair(userId);
  const id = assertSafeId(photoId);
  const row = (
    await sbSelectAll<Pick<PhotoRow, "object_path" | "mime">>(
      "app_album_photos",
      `${eqFilter("pair_id", pairId)}&${eqFilter("id", id)}&deleted_at=is.null&select=object_path,mime`,
    )
  )[0];
  if (!row || !pathBelongsToPair(row.object_path, pairId)) throw new Error("Фото не найдено");
  const { signed, expiresAt } = await signThumbs([row.object_path]);
  const url = signed.get(row.object_path);
  if (!url) throw new Error("Фото не открылось");
  const ext = row.mime === "image/jpeg" ? "jpg" : "webp";
  return {
    url: download
      ? `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(`photo.${ext}`)}`
      : url,
    expiresAt,
  };
}

export async function loadAlbumTrash(userId: string): Promise<TrashPhoto[]> {
  const pairId = await requirePair(userId);
  await purgePairAlbum(pairId);
  const rows = await sbSelectAll<PhotoRow>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&select=*&order=deleted_at.desc`,
  );
  const safe = rows.filter((row) => pathBelongsToPair(row.thumb_path, pairId) && row.purge_at);
  const { signed, expiresAt } = await signThumbs(safe.map((row) => row.thumb_path));
  const now = new Date();
  return safe.map((row) => ({
    id: row.id,
    takenAt: row.taken_at,
    authorUserId: row.author_user_id,
    byteSize: Number(row.byte_size) || 0,
    thumbUrl: signed.get(row.thumb_path) ?? "",
    expiresAt,
    purgeAt: row.purge_at as string,
    daysLeft: trashDaysLeft(row.purge_at as string, now),
  }));
}

async function liveOwned(pairId: string, ids: string[]) {
  if (!ids.length) return [] as PhotoRow[];
  const rows = await sbSelectAll<PhotoRow>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=is.null&${inFilter("id", ids)}&select=*`,
  );
  const wanted = new Set(ids);
  return rows.filter((row) => wanted.has(row.id));
}

async function albumInPair(pairId: string, albumId: string) {
  const id = assertSafeId(albumId);
  return (
    (
      await sbSelectAll<AlbumRow>(
        "app_albums",
        `${eqFilter("pair_id", pairId)}&${eqFilter("id", id)}&select=id,pair_id,title,cover_photo_id`,
      )
    )[0] ?? null
  );
}

export async function createCoupleAlbum(
  userId: string,
  input: { title: string; photoIds?: string[]; coverPhotoId?: string | null },
) {
  const pairId = await requirePair(userId);
  const title = cleanTitle(input.title ?? "");
  if (!title) throw new Error("Напиши название");
  const owned = await liveOwned(pairId, idsOf(input.photoIds ?? []));
  const id = crypto.randomUUID();
  const cover = owned.some((row) => row.id === input.coverPhotoId)
    ? input.coverPhotoId
    : (owned[0]?.id ?? null);
  await sbInsert("app_albums", {
    id,
    pair_id: pairId,
    title,
    cover_photo_id: cover,
    created_by: userId,
  });
  if (owned.length) {
    await sbInsertMany(
      "app_album_items",
      owned.map((row) => ({ album_id: id, photo_id: row.id, pair_id: pairId })),
    );
  }
  return id;
}

export async function updateCoupleAlbum(
  userId: string,
  input: { id: string; title?: string; coverPhotoId?: string | null },
) {
  const pairId = await requirePair(userId);
  const album = await albumInPair(pairId, input.id);
  if (!album) throw new Error("Альбом не найден");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    const title = cleanTitle(input.title);
    if (!title) throw new Error("Напиши название");
    patch.title = title;
  }
  if (input.coverPhotoId) {
    const owned = await liveOwned(pairId, [input.coverPhotoId]);
    if (!owned.length) throw new Error("Фото не найдено");
    const inside = await sbSelectAll<ItemRow>(
      "app_album_items",
      `${eqFilter("pair_id", pairId)}&${eqFilter("album_id", album.id)}&${eqFilter("photo_id", owned[0].id)}&select=photo_id`,
    );
    if (!inside.length) throw new Error("Этого фото нет в альбоме");
    patch.cover_photo_id = owned[0].id;
  }
  await sbPatch("app_albums", `${eqFilter("pair_id", pairId)}&${eqFilter("id", album.id)}`, patch);
  return album.id;
}

export async function deleteCoupleAlbum(userId: string, albumId: string) {
  const pairId = await requirePair(userId);
  const album = await albumInPair(pairId, albumId);
  if (!album) return;
  await sbDelete("app_albums", `${eqFilter("pair_id", pairId)}&${eqFilter("id", album.id)}`);
}

export async function changeAlbumPhotos(
  userId: string,
  input: { albumId: string; add?: string[]; remove?: string[] },
) {
  const pairId = await requirePair(userId);
  const album = await albumInPair(pairId, input.albumId);
  if (!album) throw new Error("Альбом не найден");
  const remove = idsOf(input.remove ?? []);
  if (remove.length) {
    await sbDelete(
      "app_album_items",
      `${eqFilter("pair_id", pairId)}&${eqFilter("album_id", album.id)}&${inFilter("photo_id", remove)}`,
    );
  }
  const add = await liveOwned(pairId, idsOf(input.add ?? []));
  if (add.length) {
    const existing = await sbSelectAll<ItemRow>(
      "app_album_items",
      `${eqFilter("pair_id", pairId)}&${eqFilter("album_id", album.id)}&select=album_id,photo_id`,
    );
    const have = new Set(existing.map((row) => row.photo_id));
    const fresh = add.filter((row) => !have.has(row.id));
    if (fresh.length) {
      await sbInsertMany(
        "app_album_items",
        fresh.map((row) => ({ album_id: album.id, photo_id: row.id, pair_id: pairId })),
      );
    }
  }
  const left = await sbSelectAll<ItemRow>(
    "app_album_items",
    `${eqFilter("pair_id", pairId)}&${eqFilter("album_id", album.id)}&select=album_id,photo_id`,
  );
  const still = new Set(left.map((row) => row.photo_id));
  if (!album.cover_photo_id || !still.has(album.cover_photo_id)) {
    await sbPatch("app_albums", `${eqFilter("pair_id", pairId)}&${eqFilter("id", album.id)}`, {
      cover_photo_id: left[0]?.photo_id ?? null,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function softDeletePhotos(userId: string, photoIds: string[]) {
  const pairId = await requirePair(userId);
  const ids = idsOf(photoIds);
  if (!ids.length) return;
  const now = new Date();
  await sbPatch(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=is.null&${inFilter("id", ids)}`,
    { deleted_at: now.toISOString(), purge_at: purgeDeadline(now).toISOString() },
  );
}

export async function restoreAlbumPhotos(userId: string, photoIds: string[]) {
  const pairId = await requirePair(userId);
  const ids = idsOf(photoIds);
  if (!ids.length) return;
  const rows = await sbSelectAll<Pick<PhotoRow, "id" | "byte_size">>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&${inFilter("id", ids)}&select=id,byte_size`,
  );
  if (!rows.length) return;
  const incoming = rows.reduce((sum, row) => sum + (Number(row.byte_size) || 0), 0);
  const used = await usedBytes(pairId);
  if (!fitsQuota(used, limitBytes(), incoming)) throw new Error("Место закончилось");
  await sbPatch(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&${inFilter(
      "id",
      rows.map((row) => row.id),
    )}`,
    { deleted_at: null, purge_at: null },
  );
}

export async function purgeAlbumPhotos(userId: string, photoIds: string[]) {
  const pairId = await requirePair(userId);
  const ids = idsOf(photoIds);
  if (!ids.length) return;
  const rows = await sbSelectAll<Pick<PhotoRow, "id" | "object_path" | "thumb_path">>(
    "app_album_photos",
    `${eqFilter("pair_id", pairId)}&deleted_at=not.is.null&${inFilter("id", ids)}&select=id,object_path,thumb_path`,
  );
  await dropPhotoFiles(pairId, rows);
}

export async function setAlbumLike(userId: string, photoId: string, liked: boolean) {
  const pairId = await requirePair(userId);
  const id = assertSafeId(photoId);
  const row = (
    await sbSelectAll<{ id: string }>(
      "app_album_photos",
      `${eqFilter("pair_id", pairId)}&${eqFilter("id", id)}&deleted_at=is.null&select=id`,
    )
  )[0];
  if (!row) throw new Error("Фото не найдено");
  if (!liked) {
    await sbDelete(
      "app_album_likes",
      `${eqFilter("pair_id", pairId)}&${eqFilter("photo_id", id)}&${eqFilter("user_id", userId)}`,
    );
    return;
  }
  try {
    await sbInsert("app_album_likes", { photo_id: id, user_id: userId, pair_id: pairId });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
  }
}

function dimension(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(20000, Math.round(value));
}

export async function saveUploadedPhoto(
  userId: string,
  full: Uint8Array,
  thumb: Uint8Array,
  takenAt: string | undefined,
  width: number,
  height: number,
): Promise<AlbumPhoto> {
  const pairId = await requirePair(userId);
  await purgePairAlbum(pairId);
  const fullImage = prepareStoredImage(full, MAX_FULL_BYTES);
  const thumbImage = prepareStoredImage(thumb, MAX_THUMB_BYTES);
  if (!fullImage || !thumbImage) throw new Error("Это не фото");
  const byteSize = fullImage.bytes.length + thumbImage.bytes.length;
  const limit = limitBytes();
  if (!fitsQuota(await usedBytes(pairId), limit, byteSize)) throw new Error("Место закончилось");
  const id = crypto.randomUUID();
  const objectPath = albumObjectPath(pairId, id, "full", fullImage.mime);
  const thumbPath = albumObjectPath(pairId, id, "thumb", thumbImage.mime);
  const stored = await putPairFiles(pairId, objectPath, fullImage, thumbPath, thumbImage);
  if (!stored) throw new Error("Фото не сохранилось");
  const stamp = normalizeTakenAt(takenAt, new Date());
  try {
    await sbInsert("app_album_photos", {
      id,
      pair_id: pairId,
      author_user_id: userId,
      taken_at: stamp,
      byte_size: byteSize,
      width: dimension(width),
      height: dimension(height),
      mime: fullImage.mime,
      object_path: objectPath,
      thumb_path: thumbPath,
    });
  } catch (error) {
    await storageRemove(ALBUM_BUCKET, [objectPath, thumbPath]);
    throw error instanceof Error && error.name === "ConflictError"
      ? new Error("Фото не сохранилось")
      : error;
  }
  if ((await usedBytes(pairId)) > limit) {
    await sbDelete("app_album_photos", `${eqFilter("pair_id", pairId)}&${eqFilter("id", id)}`);
    await storageRemove(ALBUM_BUCKET, [objectPath, thumbPath]);
    throw new Error("Место закончилось");
  }
  const { signed, expiresAt } = await signThumbs([thumbPath]);
  return {
    id,
    takenAt: stamp,
    authorUserId: userId,
    byteSize,
    width: dimension(width),
    height: dimension(height),
    thumbUrl: signed.get(thumbPath) ?? "",
    expiresAt,
    likedByMe: false,
    likedByPartner: false,
    albumIds: [],
  };
}

async function putPairFiles(
  pairId: string,
  objectPath: string,
  full: { mime: StoredMime; bytes: Uint8Array },
  thumbPath: string,
  thumb: { mime: StoredMime; bytes: Uint8Array },
) {
  if (!pathBelongsToPair(objectPath, pairId) || !pathBelongsToPair(thumbPath, pairId)) return false;
  const okFull = await storageUpload(ALBUM_BUCKET, objectPath, full.bytes, full.mime);
  const okThumb = await storageUpload(ALBUM_BUCKET, thumbPath, thumb.bytes, thumb.mime);
  if (okFull && okThumb) return true;
  await storageRemove(ALBUM_BUCKET, [objectPath, thumbPath]);
  return false;
}

export async function removePairAlbum(pairId: string) {
  const safe = assertSafeId(pairId);
  const rows = await sbSelectAll<Pick<PhotoRow, "id" | "object_path" | "thumb_path">>(
    "app_album_photos",
    `${eqFilter("pair_id", safe)}&select=id,object_path,thumb_path`,
  );
  await sbDelete("app_album_items", eqFilter("pair_id", safe));
  await sbDelete("app_album_likes", eqFilter("pair_id", safe));
  await sbDelete("app_albums", eqFilter("pair_id", safe));
  await sbDelete("app_album_photos", eqFilter("pair_id", safe));
  const paths = rows
    .filter(
      (row) => pathBelongsToPair(row.object_path, safe) && pathBelongsToPair(row.thumb_path, safe),
    )
    .flatMap((row) => [row.object_path, row.thumb_path]);
  await storageRemove(ALBUM_BUCKET, paths);
}
