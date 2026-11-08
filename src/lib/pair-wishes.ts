import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Wish } from "@/lib/couple-store";
import { myPairId, stillInPair } from "@/lib/pair-access";
import {
  assertSafeId,
  downloadWishPhoto,
  eqFilter,
  pathFromWishUrl,
  removeWishPhoto,
  sbDelete,
  sbInsert,
  sbPatch,
  sbSelect,
  uploadWishPhoto,
  wishObjectPath,
} from "@/lib/supabase-app";

type Payload = Partial<Wish> & { deleted?: boolean };

type Row = {
  id: string;
  pair_id: string;
  owner_user_id: string | null;
  title: string;
  fulfilled: boolean;
  photo_path: string | null;
  payload: Payload | string | null;
  updated_at?: string;
};

function payloadOf(row: Row): Payload {
  if (!row.payload) return {};
  if (typeof row.payload === "string") {
    try {
      return JSON.parse(row.payload) as Payload;
    } catch {
      return {};
    }
  }
  return row.payload;
}

export function packWish(wish: Wish): Wish {
  return wish;
}

function parseWish(row: Row): Wish {
  const extra = payloadOf(row);
  let photo = extra.photo ?? "";
  let photoPath = row.photo_path;
  const fromUrl = photo ? pathFromWishUrl(photo) : null;
  if (fromUrl) {
    photoPath = photoPath || fromUrl;
    photo = "";
  }
  return {
    id: row.id,
    title: row.title,
    link: extra.link ?? "",
    photo,
    photoPath,
    price: extra.price ?? "",
    currency: extra.currency ?? "USD",
    priority: extra.priority ?? "want",
    note: extra.note ?? "",
    owner: extra.owner === "partner" ? "partner" : "me",
    ownerUserId: row.owner_user_id,
    createdAt: extra.createdAt ?? row.updated_at ?? new Date().toISOString(),
    fulfilled: row.fulfilled,
    fulfilledAt: extra.fulfilledAt,
    updatedAt: row.updated_at,
    deleted: Boolean(extra.deleted),
  };
}

async function rowById(id: string) {
  const rows = await sbSelect<Row>("app_wishes", `${eqFilter("id", id)}&select=*`);
  return rows[0] ?? null;
}

async function photoForSave(pairId: string, wish: Wish) {
  const photo = wish.photo ?? "";
  if (photo.startsWith("data:")) {
    const path = wishObjectPath(pairId, wish.id);
    const stored = await uploadWishPhoto(path, photo);
    if (!stored) throw new Error("Фото не сохранилось");
    return { photoPath: path, photo: "" };
  }
  const fromUrl = photo ? pathFromWishUrl(photo) : null;
  if (fromUrl) {
    if (!fromUrl.startsWith(`${pairId}/`)) throw new Error("Чужое фото");
    return { photoPath: fromUrl, photo: "" };
  }
  if (wish.photoPath) {
    if (!wish.photoPath.startsWith(`${pairId}/`)) throw new Error("Чужое фото");
    return { photoPath: wish.photoPath, photo: photo.startsWith("data:") ? "" : photo };
  }
  return { photoPath: null as string | null, photo };
}

export const listPairWishes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Wish[]> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return [];
    const rows = await sbSelect<Row>("app_wishes", `${eqFilter("pair_id", pairId)}&select=*&order=updated_at.desc`);
    return rows.map(parseWish);
  });

export const savePairWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((wish: Wish) => wish)
  .handler(async ({ context, data: wish }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return wish;
    const id = assertSafeId(wish.id);
    const existing = await rowById(id);
    if (existing && existing.pair_id !== pairId) throw new Error("Чужая хотелка");
    const photo = await photoForSave(pairId, { ...wish, id });
    const body: Record<string, unknown> = {
      owner_user_id: wish.ownerUserId ?? null,
      title: wish.title || "Хотелка",
      fulfilled: wish.fulfilled,
      payload: {
        link: wish.link ?? "",
        photo: photo.photo,
        price: wish.price ?? "",
        currency: wish.currency ?? "USD",
        priority: wish.priority ?? "want",
        note: wish.note ?? "",
        owner: wish.owner,
        createdAt: wish.createdAt,
        fulfilledAt: wish.fulfilledAt ?? null,
        deleted: false,
      },
      updated_at: new Date().toISOString(),
    };
    if (photo.photoPath) body.photo_path = photo.photoPath;
    if (!existing) {
      try {
        await sbInsert("app_wishes", { id, pair_id: pairId, photo_path: photo.photoPath, ...body });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
        const again = await rowById(id);
        if (!again || again.pair_id !== pairId) throw new Error("Чужая хотелка");
        await sbPatch("app_wishes", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`, body);
      }
    } else {
      await sbPatch("app_wishes", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`, body);
    }
    if (!(await stillInPair(context.userId, pairId))) {
      await sbDelete("app_wishes", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`);
      if (photo.photoPath) await removeWishPhoto(photo.photoPath);
      return { ...wish, id, photo: photo.photo, photoPath: photo.photoPath };
    }
    const saved = await rowById(id);
    return saved ? parseWish(saved) : { ...wish, id, photo: photo.photo, photoPath: photo.photoPath };
  });

export const deletePairWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => assertSafeId(id))
  .handler(async ({ context, data: id }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return;
    const existing = await rowById(id);
    if (!existing || payloadOf(existing).deleted) return;
    if (existing.pair_id !== pairId) throw new Error("Чужая хотелка");
    const current = parseWish(existing);
    await sbPatch("app_wishes", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`, {
      payload: { ...payloadOf(existing), deleted: true, photo: "" },
      photo_path: null,
      updated_at: new Date().toISOString(),
    });
    if (current.photoPath?.startsWith(`${pairId}/`)) await removeWishPhoto(current.photoPath);
    if (!(await stillInPair(context.userId, pairId))) {
      await sbDelete("app_wishes", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`);
    }
  });

export const getWishPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => assertSafeId(id))
  .handler(async ({ context, data: id }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return "";
    const row = await rowById(id);
    if (!row || row.pair_id !== pairId || payloadOf(row).deleted) return "";
    const path = row.photo_path;
    if (!path || !path.startsWith(`${pairId}/`)) return "";
    return (await downloadWishPhoto(path)) ?? "";
  });
