import { Pool, types } from "pg";

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;

/**
 * Supavisor session mode (`pooler.supabase.com:5432`) allows about 15 clients
 * total. Production, old production, and previews share that cap, and each
 * request was opening its own session. Transaction mode (`:6543`) multiplexes
 * those clients. Migrations keep the original `DATABASE_URL` (still :5432).
 *
 * Vercel env `DATABASE_URL`, only if you want every already-deployed build to
 * switch too: on a `*.pooler.supabase.com` URL, change `:5432/` to `:6543/`.
 * Leave the user, password, host, and database name as they are. Do not point
 * this at `db.<ref>.supabase.co` — that host has no transaction pooler.
 */
export function transactionPoolerUrl(raw: string): string {
  if (!/pooler\.supabase\./i.test(raw)) return raw;
  return raw.replace(/:5432(?=\/|\?|#|$)/, ":6543");
}

const globalRef = globalThis as typeof globalThis & { __sharedPgPool__?: Pool };

/** One pool for app SQL and Better Auth, so they do not each hold a client. */
export function getSharedPgPool(connectionString: string): Pool {
  if (globalRef.__sharedPgPool__) return globalRef.__sharedPgPool__;
  types.setTypeParser(OID_INT8, Number);
  types.setTypeParser(OID_DATE, (value) => value);
  types.setTypeParser(OID_INTERVAL, (value) => value);
  const connection = transactionPoolerUrl(connectionString);
  const transactionMode = connection !== connectionString || /:6543(?=\/|\?|#|$)/.test(connection);
  const pool = new Pool({
    connectionString: connection,
    max: 1,
    // Session mode must not keep a client after the query: a frozen isolate
    // never runs the idle timer, so the Supavisor slot stays taken. Transaction
    // mode returns the backend when the transaction ends, so the client can stay.
    maxUses: transactionMode ? Infinity : 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 4_000,
    allowExitOnIdle: true,
  });
  globalRef.__sharedPgPool__ = pool;
  return pool;
}
