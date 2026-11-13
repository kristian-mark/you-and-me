import { timingSafeEqual } from "node:crypto";
import { saveUploadedPhoto, purgeExpiredAlbums } from "@/lib/album-core";
import { CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { env } from "@/lib/env.server";
import { MAX_FULL_BYTES, MAX_THUMB_BYTES } from "@/lib/album-model";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function assertAlbumPost(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new CrossSiteRequestError();
}

function bearerOf(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : undefined;
}

async function fileBytes(value: FormDataEntryValue | null, max: number) {
  if (!(value instanceof File)) return null;
  if (value.size <= 0 || value.size > max) return null;
  return new Uint8Array(await value.arrayBuffer());
}

async function userIdOf(request: Request) {
  const bearer = bearerOf(request);
  try {
    return await requireUserId(bearer);
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
  }
  const { auth, authConfigured } = await import("@/lib/auth/server");
  const { gateIdentityEnabled } = await import("@/lib/auth/gate-identity.server");
  const { assertKnownUser } = await import("@/lib/auth/verify.server");
  if (!authConfigured && !gateIdentityEnabled()) throw new UnauthorizedError();
  const headers = new Headers(request.headers);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) throw new UnauthorizedError();
  await assertKnownUser(session.user.id);
  return session.user.id;
}

export async function handleAlbumUpload(request: Request) {
  try {
    assertAlbumPost(request);
    const userId = await userIdOf(request);
    const form = await request.formData();
    const full = await fileBytes(form.get("full"), MAX_FULL_BYTES);
    const thumb = await fileBytes(form.get("thumb"), MAX_THUMB_BYTES);
    if (!full || !thumb) return json({ error: "Это не фото" }, 400);
    const takenAt =
      typeof form.get("takenAt") === "string" ? String(form.get("takenAt")) : undefined;
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const photo = await saveUploadedPhoto(userId, full, thumb, takenAt, width, height);
    return json({ photo });
  } catch (error) {
    return json({ error: messageOf(error) }, statusOf(error));
  }
}

export async function handleAlbumPurge(request: Request) {
  const secret = env("CRON_SECRET");
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`))
    return json({ error: "unauthorized" }, 401);
  const purged = await purgeExpiredAlbums();
  return json({ purged });
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function statusOf(error: unknown) {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof CrossSiteRequestError) return 403;
  return 400;
}

function messageOf(error: unknown) {
  if (error instanceof UnauthorizedError) return "Сессия слетела — войди снова";
  if (error instanceof CrossSiteRequestError) return "Запрос отклонён";
  if (error instanceof Error && error.message && !/^supabase \d+/.test(error.message))
    return error.message;
  return "Фото не сохранилось";
}
