import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Wish } from "@/lib/couple-store";
import { sbDelete, sbSelect, sbUpsert, uploadWishPhoto } from "@/lib/supabase-app";

type Row = {
  id: string;
  pair_id: string;
  owner_user_id: string | null;
  title: string;
  fulfilled: boolean;
  photo_path: string | null;
  payload: Record<string, unknown> | string;
};

export function packWish(wish: Wish): Wish {
  return wish;
}

function parseWish(row: Row): Wish {
  const extra = (typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : row.payload ?? {}) as Partial<Wish>;
  return {
    id: row.id,
    title: row.title,
    link: extra.link ?? "",
    photo: extra.photo ?? "",
    price: extra.price ?? "",
    currency: extra.currency ?? "USD",
    priority: extra.priority ?? "want",
    note: extra.note ?? "",
    owner: extra.owner ?? "me",
    ownerUserId: row.owner_user_id,
    createdAt: extra.createdAt ?? new Date().toISOString(),
    fulfilled: row.fulfilled,
    fulfilledAt: extra.fulfilledAt,
  };
}

async function myPairId(userId: string) {
  const row = (await sbSelect<{ pair_id: string | null }>("app_profiles", `user_id=eq.${encodeURIComponent(userId)}&select=pair_id`))[0];
  return row?.pair_id ?? null;
}

export const listPairWishes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Wish[]> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return [];
    const rows = await sbSelect<Row>("app_wishes", `pair_id=eq.${pairId}&select=*&order=updated_at.desc`);
    return rows.map(parseWish);
  });

export const savePairWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((wish: Wish) => wish)
  .handler(async ({ context, data: wish }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return wish;
    let photo = wish.photo ?? "";
    let photoPath: string | null = null;
    if (photo.startsWith("data:")) {
      photoPath = `${pairId}/${wish.id}.jpg`;
      const url = await uploadWishPhoto(photoPath, photo);
      photo = url ?? "";
    }
    await sbUpsert("app_wishes", {
      id: wish.id,
      pair_id: pairId,
      owner_user_id: wish.ownerUserId ?? null,
      title: wish.title,
      fulfilled: wish.fulfilled,
      photo_path: photoPath,
      payload: {
        link: wish.link,
        photo,
        price: wish.price,
        currency: wish.currency,
        priority: wish.priority,
        note: wish.note,
        owner: wish.owner,
        createdAt: wish.createdAt,
        fulfilledAt: wish.fulfilledAt,
      },
      updated_at: new Date().toISOString(),
    });
    return { ...wish, photo };
  });

export const deletePairWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return;
    await sbDelete("app_wishes", `id=eq.${id}&pair_id=eq.${pairId}`);
  });
