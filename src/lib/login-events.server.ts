import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { clientIp, clientPlace, deviceLabel } from "@/lib/login-device";

type SessionRow = {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function headerBag(context: { request?: Request; headers?: Headers } | null) {
  return context?.request?.headers ?? context?.headers ?? null;
}

const EMAIL_KEYS = ["RESEND_API_KEY", "SMTP_URL", "SMTP_HOST", "POSTMARK_API_KEY", "MAILGUN_API_KEY", "SENDGRID_API_KEY"];

/**
 * True only when an env key for a mail provider is already present.
 * There is still no sender in this app, so a key does not send mail by itself.
 */
export function loginEmailConfigured() {
  return EMAIL_KEYS.some((key) => Boolean(process.env[key]?.trim()));
}

/** Record a freshly created session. Failures must not block the sign-in. */
export async function recordLoginEvent(
  session: SessionRow,
  context: { request?: Request; headers?: Headers } | null,
) {
  const headers = headerBag(context);
  const userAgent = headers?.get("user-agent") || session.userAgent || "";
  const ip = (headers ? clientIp(headers) : null) || session.ipAddress || null;
  const place = headers ? clientPlace(headers) : { city: null, country: null };
  const sql = await getSql();
  await sql.query(
    `insert into login_events (id, user_id, session_id, ip, user_agent, device_label, city, country)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      session.userId,
      session.id,
      ip,
      userAgent.slice(0, 400),
      deviceLabel(userAgent),
      place.city,
      place.country,
    ],
  );
  if (loginEmailConfigured()) {
    console.warn("[auth] login email skipped: a provider key is set, but this app has no mail sender");
  }
}

export type LoginNotice = {
  id: string;
  createdAt: string;
  ip: string | null;
  device: string;
  city: string | null;
  country: string | null;
};

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

/**
 * Unseen logins from other sessions that happened after this session started.
 * Ended sessions still count. Older logins do not. Nothing is marked seen here.
 */
export async function listUnseenLogins(userId: string, sessionId: string): Promise<LoginNotice[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    created_at: string | Date;
    ip: string | null;
    device_label: string;
    city: string | null;
    country: string | null;
  }>(
    `select e.id, e.created_at, e.ip, e.device_label, e.city, e.country
     from login_events e
     where e.user_id = $1
       and e.session_id <> $2
       and e.created_at > (
         select s."createdAt" from "session" s where s."id" = $2 and s."userId" = $1
       )
       and not (e.seen_by @> array[$2]::text[])
     order by e.created_at desc
     limit 50`,
    [userId, sessionId],
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: iso(row.created_at),
    ip: row.ip,
    device: row.device_label,
    city: row.city,
    country: row.country,
  }));
}

/** «Скрыть» and «Подробнее» mark every banner row seen for this session. */
export async function markLoginsSeen(userId: string, sessionId: string, ids: string[]) {
  if (!ids.length) return;
  const sql = await getSql();
  await sql.query(
    `update login_events
     set seen_by = seen_by || array[$2]::text[]
     where user_id = $1
       and id = any($3::text[])
       and not (seen_by @> array[$2]::text[])`,
    [userId, sessionId, ids],
  );
}

export type ActiveLogin = {
  id: string;
  current: boolean;
  createdAt: string;
  ip: string | null;
  device: string;
  city: string | null;
  country: string | null;
};

export type LoginHistoryItem = {
  id: string;
  sessionId: string;
  createdAt: string;
  ip: string | null;
  device: string;
  city: string | null;
  country: string | null;
};

export async function listLoginActivity(userId: string, sessionId: string) {
  const sql = await getSql();
  const active = await sql.query<{
    id: string;
    createdAt: string | Date;
    ipAddress: string | null;
    userAgent: string | null;
    device_label: string | null;
    city: string | null;
    country: string | null;
    ip: string | null;
  }>(
    `select s."id", s."createdAt", s."ipAddress", s."userAgent",
            e.device_label, e.city, e.country, e.ip
     from "session" s
     left join lateral (
       select device_label, city, country, ip
       from login_events
       where session_id = s."id"
       order by created_at desc
       limit 1
     ) e on true
     where s."userId" = $1 and s."expiresAt" > now()
     order by s."createdAt" desc`,
    [userId],
  );
  const history = await sql.query<{
    id: string;
    session_id: string;
    created_at: string | Date;
    ip: string | null;
    device_label: string;
    city: string | null;
    country: string | null;
  }>(
    `select id, session_id, created_at, ip, device_label, city, country
     from login_events
     where user_id = $1
     order by created_at desc
     limit 20`,
    [userId],
  );
  return {
    active: active.map((row) => ({
      id: row.id,
      current: row.id === sessionId,
      createdAt: iso(row.createdAt),
      ip: row.ip || row.ipAddress || null,
      device: row.device_label || deviceLabel(row.userAgent),
      city: row.city,
      country: row.country,
    })),
    history: history.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      createdAt: iso(row.created_at),
      ip: row.ip,
      device: row.device_label,
      city: row.city,
      country: row.country,
    })),
  };
}

export async function endLoginSession(userId: string, sessionId: string, targetId: string) {
  if (!targetId || targetId === sessionId) return;
  const sql = await getSql();
  await sql.query(`delete from "session" where "id" = $1 and "userId" = $2 and "id" <> $3`, [
    targetId,
    userId,
    sessionId,
  ]);
}

export async function endOtherLoginSessions(userId: string, sessionId: string) {
  const sql = await getSql();
  await sql.query(`delete from "session" where "userId" = $1 and "id" <> $2`, [userId, sessionId]);
}
