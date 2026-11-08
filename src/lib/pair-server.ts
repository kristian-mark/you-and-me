import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureMembership, membershipOf, type ProfileRow } from "@/lib/pair-access";
import { assertSafeId, eqFilter, removeWishPhoto, sbDelete, sbInsert, sbPatch, sbSelect } from "@/lib/supabase-app";
import { deleteCoupleGames } from "@/lib/turn/server";

export type PairProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  inviteCode: string;
  birthday: string | null;
  pairId: string | null;
  seat: "a" | "b" | null;
  togetherSince: string | null;
  pairedAt: string | null;
  partner: {
    userId: string;
    displayName: string | null;
    inviteCode: string;
    birthday: string | null;
  } | null;
};

function labelOf(row: ProfileRow) {
  const name = row.display_name?.trim();
  if (name) return name;
  const local = row.email?.split("@")[0]?.trim();
  return local || null;
}

function dayOf(value: string | null | undefined) {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

async function profileView(userId: string): Promise<PairProfile> {
  const me = await ensureMembership(userId);
  let partner: PairProfile["partner"] = null;
  if (me.pair) {
    const otherId = me.pair.a_user_id === userId ? me.pair.b_user_id : me.pair.a_user_id;
    if (otherId) {
      const them = (await sbSelect<ProfileRow>("app_profiles", `${eqFilter("user_id", otherId)}&select=*`))[0];
      if (them) {
        partner = {
          userId: them.user_id,
          displayName: labelOf(them),
          inviteCode: them.invite_code,
          birthday: them.birthday,
        };
      }
    }
  }
  return {
    userId: me.profile.user_id,
    email: me.profile.email,
    displayName: labelOf(me.profile),
    inviteCode: me.profile.invite_code,
    birthday: me.profile.birthday,
    pairId: me.pairId,
    seat: partner ? me.seat : null,
    togetherSince: dayOf(me.pair?.together_since),
    pairedAt: me.pair?.created_at ?? null,
    partner,
  };
}

export const getMyPair = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PairProfile> => profileView(context.userId));

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName?: string; birthday?: string; email?: string }) => input)
  .handler(async ({ context, data }): Promise<PairProfile> => {
    await ensureMembership(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.displayName) patch.display_name = data.displayName.slice(0, 80);
    if (data.birthday) patch.birthday = data.birthday.slice(0, 32);
    if (data.email) patch.email = data.email.slice(0, 200);
    if (Object.keys(patch).length) {
      await sbPatch("app_profiles", eqFilter("user_id", context.userId), patch);
    }
    return profileView(context.userId);
  });

export const saveTogetherSince = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (input === null || input === "") return null;
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error("Некорректная дата");
    if (Number.isNaN(Date.parse(`${input}T12:00:00Z`))) throw new Error("Некорректная дата");
    return input;
  })
  .handler(async ({ context, data }): Promise<PairProfile> => {
    const me = await membershipOf(context.userId);
    if (!me?.pairId) throw new Error("Сначала соединитесь парой");
    const patched = await sbPatch(
      "app_pairs",
      eqFilter("id", assertSafeId(me.pairId)),
      { together_since: data },
    );
    if (!patched.length) throw new Error("Дату пары не удалось сохранить");
    return profileView(context.userId);
  });

export const joinByInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 4 || clean.length > 12) throw new Error("Короткий код");
    return clean;
  })
  .handler(async ({ context, data: code }): Promise<PairProfile> => {
    const me = await ensureMembership(context.userId);
    if (me.pairId) throw new Error("Сначала выйди из своей пары");
    const them = (await sbSelect<ProfileRow>("app_profiles", `${eqFilter("invite_code", code)}&select=*`))[0];
    if (!them) throw new Error("Код не найден");
    if (them.user_id === context.userId) throw new Error("Это твой код");

    if (them.pair_id) {
      const pairId = assertSafeId(them.pair_id);
      const pair = (await sbSelect<{ a_user_id: string; b_user_id: string | null }>("app_pairs", `${eqFilter("id", pairId)}&select=a_user_id,b_user_id`))[0];
      if (!pair || pair.a_user_id !== them.user_id || pair.b_user_id) throw new Error("В этой паре уже двое");
      const claimed = await sbPatch("app_pairs", `${eqFilter("id", pairId)}&b_user_id=is.null&${eqFilter("a_user_id", them.user_id)}`, {
        b_user_id: context.userId,
      });
      if (!claimed.length) throw new Error("В этой паре уже двое");
      const linked = await sbPatch("app_profiles", `${eqFilter("user_id", context.userId)}&pair_id=is.null`, {
        pair_id: pairId,
      });
      if (!linked.length) {
        await sbPatch("app_pairs", `${eqFilter("id", pairId)}&${eqFilter("b_user_id", context.userId)}`, {
          b_user_id: null,
        });
        throw new Error("Сначала выйди из своей пары");
      }
      return profileView(context.userId);
    }

    const pairId = crypto.randomUUID();
    try {
      await sbInsert("app_pairs", { id: pairId, a_user_id: them.user_id, b_user_id: context.userId });
    } catch {
      const again = await membershipOf(them.user_id);
      if (again?.pairId) throw new Error("В этой паре уже двое");
      throw new Error("Не вышло соединиться");
    }
    const linkedThem = await sbPatch("app_profiles", `${eqFilter("user_id", them.user_id)}&pair_id=is.null`, {
      pair_id: pairId,
    });
    if (!linkedThem.length) {
      await sbDelete("app_pairs", eqFilter("id", pairId));
      throw new Error("В этой паре уже двое");
    }
    const linkedMe = await sbPatch("app_profiles", `${eqFilter("user_id", context.userId)}&pair_id=is.null`, {
      pair_id: pairId,
    });
    if (!linkedMe.length) {
      await sbPatch("app_profiles", `${eqFilter("user_id", them.user_id)}&${eqFilter("pair_id", pairId)}`, {
        pair_id: null,
      });
      await sbDelete("app_pairs", eqFilter("id", pairId));
      throw new Error("Сначала выйди из своей пары");
    }
    return profileView(context.userId);
  });

export const leavePairRemote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PairProfile> => {
    const me = await ensureMembership(context.userId);
    const pairId = me.pairId;
    if (!pairId) return profileView(context.userId);
    const wishes = await sbSelect<{ photo_path: string | null }>(
      "app_wishes",
      `${eqFilter("pair_id", pairId)}&select=photo_path`,
    );
    await sbPatch("app_profiles", eqFilter("pair_id", pairId), { pair_id: null });
    await sbDelete("app_tasks", eqFilter("pair_id", pairId));
    await sbDelete("app_wishes", eqFilter("pair_id", pairId));
    for (const wish of wishes) {
      if (wish.photo_path?.startsWith(`${pairId}/`)) await removeWishPhoto(wish.photo_path);
    }
    await deleteCoupleGames(pairId);
    await sbDelete("app_pairs", eqFilter("id", pairId));
    await sbDelete("app_tasks", eqFilter("pair_id", pairId));
    await sbDelete("app_wishes", eqFilter("pair_id", pairId));
    return profileView(context.userId);
  });
