import { eqFilter, sbInsert, sbSelect } from "@/lib/supabase-app";

export type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  invite_code: string;
  birthday: string | null;
  pair_id: string | null;
};

export type PairRow = {
  id: string;
  a_user_id: string;
  b_user_id: string | null;
};

export type Membership = {
  userId: string;
  profile: ProfileRow;
  pair: PairRow | null;
  pairId: string | null;
  seat: "a" | "b" | null;
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
    const hit = await sbSelect<ProfileRow>("app_profiles", `${eqFilter("invite_code", code)}&select=user_id`);
    if (!hit[0]) return code;
  }
  return `${makeCode()}${makeCode()}`.slice(0, 8);
}

export async function membershipOf(userId: string): Promise<Membership | null> {
  const profile = (await sbSelect<ProfileRow>("app_profiles", `${eqFilter("user_id", userId)}&select=*`))[0];
  if (!profile) return null;
  let pair: PairRow | null = null;
  if (profile.pair_id) {
    pair = (await sbSelect<PairRow>("app_pairs", `${eqFilter("id", profile.pair_id)}&select=*`))[0] ?? null;
  }
  const seat = pair ? (pair.a_user_id === userId ? "a" : "b") : null;
  return { userId, profile, pair, pairId: profile.pair_id, seat };
}

export async function ensureMembership(userId: string): Promise<Membership> {
  const existing = await membershipOf(userId);
  if (existing) return existing;
  const code = await uniqueCode();
  try {
    await sbInsert("app_profiles", { user_id: userId, invite_code: code });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
  }
  const created = await membershipOf(userId);
  if (!created) throw new Error("Профиль не создался");
  return created;
}

export async function myPairId(userId: string) {
  const row = (await sbSelect<{ pair_id: string | null }>("app_profiles", `${eqFilter("user_id", userId)}&select=pair_id`))[0];
  return row?.pair_id ?? null;
}

export async function stillInPair(userId: string, pairId: string) {
  return (await myPairId(userId)) === pairId;
}
