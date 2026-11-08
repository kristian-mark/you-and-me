const URL = "https://vydpgldekbudzlmystvm.supabase.co";
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZHBnbGRla2J1ZHpsbXlzdHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTA5MjAsImV4cCI6MjEwOTQ2NjkyMH0.J3y8L5rUWApol0ZLKd_j7CrYmtw8Z7guJOokk3EKr0w";

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

export function wishPublicUrl(path: string) {
  return `${URL}/storage/v1/object/public/wishes/${path}`;
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T[];
}

export async function sbInsert<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = (await res.json()) as T[];
  return rows[0] ?? row;
}

export async function sbUpsert<T extends Record<string, unknown>>(table: string, row: T): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sbPatch(table: string, query: string, row: Record<string, unknown>) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sbDelete(table: string, query: string) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

export async function uploadWishPhoto(path: string, dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  const res = await fetch(`${URL}/storage/v1/object/wishes/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": match[1] || "image/jpeg",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) return null;
  return wishPublicUrl(path);
}
