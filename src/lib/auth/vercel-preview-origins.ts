/**
 * Vercel preview deployments share one BETTER_AUTH_URL (the production origin).
 * Better Auth then rejects the preview's own Origin as "Invalid origin".
 *
 * When VERCEL_ENV=preview, trust only this deployment's hosts from the system
 * env (no scheme on those values). Production stays on BETTER_AUTH_URL.
 * Never expand to `*.vercel.app`.
 */

export type VercelPreviewEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  BETTER_AUTH_URL?: string;
};

export type PreviewAuthURLs = {
  /** Set only for a preview that exposed at least one deployment host. */
  baseURL: { allowedHosts: string[]; protocol: "https"; fallback: string } | null;
  /** Exact https origins to add. Empty outside preview. */
  trustedOrigins: string[];
};

const HOST_KEYS = ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

function httpsOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.includes("*") || value.includes("?")) return null;
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.port && url.port !== "443") return null;
  const hostname = url.hostname.toLowerCase();
  if (!hostname || !hostname.includes(".") || hostname.includes("*") || hostname === "vercel.app")
    return null;
  return `https://${hostname}`;
}

export function vercelPreviewAuth(env: VercelPreviewEnv): PreviewAuthURLs {
  if (env.VERCEL_ENV?.trim().toLowerCase() !== "preview") {
    return { baseURL: null, trustedOrigins: [] };
  }
  const trustedOrigins: string[] = [];
  const seen = new Set<string>();
  for (const key of HOST_KEYS) {
    const origin = httpsOrigin(env[key]);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    trustedOrigins.push(origin);
  }
  if (trustedOrigins.length === 0) return { baseURL: null, trustedOrigins: [] };
  const fallback = httpsOrigin(env.BETTER_AUTH_URL) ?? trustedOrigins[0];
  const allowedHosts: string[] = [];
  const hosts = new Set<string>();
  for (const origin of [fallback, ...trustedOrigins]) {
    const host = new URL(origin).hostname;
    if (hosts.has(host) || host.includes("*")) continue;
    hosts.add(host);
    allowedHosts.push(host);
  }
  return {
    baseURL: { allowedHosts, protocol: "https", fallback },
    trustedOrigins,
  };
}
