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

export async function sbInsert<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
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
  const { url } = serverConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { method: "DELETE", headers: headers() });
  if (!res.ok) return fail(res);
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
