import { absoluteSignedUrl } from "@/lib/album-model";
import { env } from "@/lib/env.server";

function serverConfig() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase is server-only");
  }
  const url = env("SUPABASE_URL")?.replace(/\/$/, "");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server");
  }
  return { url, key };
}

function headers() {
  const { key } = serverConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function assertSafeId(value: string) {
  const id = value.trim();
  if (!SAFE_ID.test(id)) throw new Error("Некорректный идентификатор");
  return id;
}

export function eqFilter(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

async function fail(res: Response): Promise<never> {
  throw new Error(`supabase ${res.status}`);
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const { url } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!res.ok) return fail(res);
  return (await res.json()) as T[];
}

export async function sbInsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T> {
  const { url } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (res.status === 409) {
    const error = new Error("conflict");
    error.name = "ConflictError";
    throw error;
  }
  if (!res.ok) return fail(res);
  const rows = (await res.json()) as T[];
  return rows[0] ?? row;
}

export async function sbPatch<T = Record<string, unknown>>(
  table: string,
  query: string,
  row: Record<string, unknown>,
): Promise<T[]> {
  const { url } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) return fail(res);
  const text = await res.text();
  if (!text) return [];
  return JSON.parse(text) as T[];
}

export async function sbDelete(table: string, query: string) {
  await sbDeleteReturning(table, query);
}

/**
 * Delete and return the rows that actually went away.
 * No JSON content-type: an empty JSON body makes PostgREST ignore the filter
 * and answer 204 without deleting.
 */
export async function sbDeleteReturning<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "return=representation",
    },
  });
  if (!res.ok) return fail(res);
  const text = await res.text();
  if (!text) return [];
  const parsed = JSON.parse(text) as T | T[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function sbInsertMany(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { url } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) return fail(res);
}

/** Page past the API's default row cap. `query` must not already set a limit. */
export async function sbSelectAll<T>(table: string, query: string): Promise<T[]> {
  const { url } = serverConfig();
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; from < 20_000; from += page) {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { ...headers(), Range: `${from}-${from + page - 1}` },
    });
    if (!res.ok) return fail(res);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

function storageHeaders(contentType?: string) {
  const { key } = serverConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function storageUpload(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  const { url } = serverConfig();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeObjectPath(path)}`, {
    method: "POST",
    headers: { ...storageHeaders(contentType), "x-upsert": "false" },
    body: Buffer.from(bytes),
  });
  return res.ok;
}

export async function storageRemove(bucket: string, paths: string[]) {
  const clean = [
    ...new Set(paths.filter((path) => path && !path.includes("..") && !path.startsWith("/"))),
  ];
  if (!clean.length) return;
  const { url } = serverConfig();
  for (let i = 0; i < clean.length; i += 100) {
    const prefixes = clean.slice(i, i + 100);
    await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: storageHeaders("application/json"),
      body: JSON.stringify({ prefixes }),
    });
  }
}

export async function storageSign(bucket: string, paths: string[], expiresIn: number) {
  const unique = [
    ...new Set(paths.filter((path) => path && !path.includes("..") && !path.startsWith("/"))),
  ];
  const { url } = serverConfig();
  const signed = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const res = await fetch(`${url}/storage/v1/object/sign/${bucket}`, {
      method: "POST",
      headers: storageHeaders("application/json"),
      body: JSON.stringify({ expiresIn, paths: batch }),
    });
    if (!res.ok) continue;
    const rows = (await res.json()) as { path?: string; signedURL?: string | null }[];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row.path || !row.signedURL) continue;
      signed.set(row.path, absoluteSignedUrl(url, row.signedURL));
    }
  }
  return signed;
}

export function wishObjectPath(pairId: string, wishId: string) {
  return `${assertSafeId(pairId)}/${assertSafeId(wishId)}.jpg`;
}

export function pathFromWishUrl(url: string) {
  const marker = "/storage/v1/object/public/wishes/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0] ?? "");
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  return path;
}

export async function uploadWishPhoto(path: string, dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  if (path.includes("..") || path.startsWith("/")) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_500_000) return null;
  const { url, key } = serverConfig();
  const res = await fetch(`${url}/storage/v1/object/wishes/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": match[1] || "image/jpeg",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) return null;
  return path;
}

export async function downloadWishPhoto(path: string) {
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  const { url, key } = serverConfig();
  const res = await fetch(`${url}/storage/v1/object/wishes/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 1_500_000) return null;
  const type = res.headers.get("content-type") || "image/jpeg";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

export async function removeWishPhoto(path: string) {
  if (!path || path.includes("..") || path.startsWith("/")) return;
  const { url, key } = serverConfig();
  await fetch(`${url}/storage/v1/object/wishes/${path}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}
