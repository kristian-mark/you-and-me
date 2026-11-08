import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { sbDelete, sbInsert, sbPatch, sbSelect, sbUpsert } from "@/lib/supabase-app";

export type PairProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  inviteCode: string;
  birthday: string | null;
  pairId: string | null;
  partner: {
    userId: string;
    displayName: string | null;
    inviteCode: string;
  } | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  invite_code: string;
  birthday: string | null;
  pair_id: string | null;
};

type PairRow = {
  id: string;
  a_user_id: string;
  b_user_id: string | null;
};

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let out = "";
  for (let i = 0; i < 6; i += 1) out += ALPH[Math.floor(Math.random() * ALPH.length)];
  return out;
}

async function uniqueCode() {
  for (let i = 0; i < 12; i += 1) {
    const code = makeCode();
    const hit = await sbSelect<ProfileRow>("app_profiles", `invite_code=eq.${code}&select=user_id`);
    if (!hit[0]) return code;
  }
  return `${makeCode()}${makeCode()}`.slice(0, 8);
}

async function loadProfile(userId: string): Promise<PairProfile | null> {
  const rows = await sbSelect<ProfileRow>("app_profiles", `user_id=eq.${encodeURIComponent(userId)}&select=*`);
  const me = rows[0];
  if (!me) return null;
  let partner: PairProfile["partner"] = null;
  if (me.pair_id) {
    const pair = (await sbSelect<PairRow>("app_pairs", `id=eq.${me.pair_id}&select=*`))[0];
    const otherId = pair ? (pair.a_user_id === userId ? pair.b_user_id : pair.a_user_id) : null;
    if (otherId) {
      const them = (await sbSelect<ProfileRow>("app_profiles", `user_id=eq.${encodeURIComponent(otherId)}&select=*`))[0];
      if (them) {
        const label =
          them.display_name && them.display_name !== them.email?.split("@")[0]
            ? them.display_name
            : them.display_name || them.email?.split("@")[0] || null;
        partner = { userId: them.user_id, displayName: label, inviteCode: them.invite_code };
      }
    }
  }
  return {
    userId: me.user_id,
    email: me.email,
    displayName: me.display_name,
    inviteCode: me.invite_code,
    birthday: me.birthday,
    pairId: me.pair_id,
    partner,
  };
}

async function ensure(userId: string): Promise<PairProfile> {
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const code = await uniqueCode();
  await sbInsert("app_profiles", { user_id: userId, invite_code: code });
  return (await loadProfile(userId))!;
}

export const getMyPair = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PairProfile> => ensure(context.userId));

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName?: string; birthday?: string; email?: string }) => input)
  .handler(async ({ context, data }): Promise<PairProfile> => {
    await ensure(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.displayName) patch.display_name = data.displayName;
    if (data.birthday) patch.birthday = data.birthday;
    if (data.email) patch.email = data.email;
    if (Object.keys(patch).length) {
      await sbPatch("app_profiles", `user_id=eq.${encodeURIComponent(context.userId)}`, patch);
    }
    return (await loadProfile(context.userId))!;
  });

export const joinByInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => code.trim().toUpperCase())
  .handler(async ({ context, data: code }): Promise<PairProfile> => {
    if (code.length < 4) throw new Error("Короткий код");
    const me = await ensure(context.userId);
    if (me.pairId) throw new Error("Сначала выйди из своей пары");
    const them = (await sbSelect<ProfileRow>("app_profiles", `invite_code=eq.${code}&select=*`))[0];
    if (!them) throw new Error("Код не найден");
    if (them.user_id === context.userId) throw new Error("Это твой код");
    if (them.pair_id) {
      const pair = (await sbSelect<PairRow>("app_pairs", `id=eq.${them.pair_id}&select=*`))[0];
      if (!pair || pair.b_user_id) throw new Error("В этой паре уже двое");
      await sbPatch("app_pairs", `id=eq.${pair.id}`, { b_user_id: context.userId });
      await sbPatch("app_profiles", `user_id=eq.${encodeURIComponent(context.userId)}`, { pair_id: pair.id });
      return (await loadProfile(context.userId))!;
    }
    const pairId = crypto.randomUUID();
    await sbInsert("app_pairs", { id: pairId, a_user_id: them.user_id, b_user_id: context.userId });
    await sbPatch("app_profiles", `user_id=eq.${encodeURIComponent(them.user_id)}`, { pair_id: pairId });
    await sbPatch("app_profiles", `user_id=eq.${encodeURIComponent(context.userId)}`, { pair_id: pairId });
    return (await loadProfile(context.userId))!;
  });

export const leavePairRemote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PairProfile> => {
    const me = await ensure(context.userId);
    if (me.pairId) {
      await sbPatch("app_profiles", `pair_id=eq.${me.pairId}`, { pair_id: null });
      await sbDelete("app_pairs", `id=eq.${me.pairId}`);
    }
    return (await loadProfile(context.userId))!;
  });
