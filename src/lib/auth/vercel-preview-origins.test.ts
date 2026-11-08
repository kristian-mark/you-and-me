import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { vercelPreviewAuth } from "./vercel-preview-origins.ts";

const require = createRequire(import.meta.url);
const { matchesOriginPattern } =
  require("../../../node_modules/better-auth/dist/auth/trusted-origins.mjs") as {
    matchesOriginPattern: (url: string, pattern: string) => boolean;
  };

const previewHost = "you-and-me-git-cursor-birthday-picker-mobile-35f3-kristian-mark.vercel.app";
const deploymentHost = "you-and-me-abc123-kristian-mark.vercel.app";
const production = "https://you-and-me-black.vercel.app";

const previewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_URL: deploymentHost,
  VERCEL_BRANCH_URL: `https://${previewHost}/`,
  VERCEL_PROJECT_PRODUCTION_URL: "you-and-me-black.vercel.app",
  BETTER_AUTH_URL: production,
};

test("preview trusts only this deployment's https origins", () => {
  const auth = vercelPreviewAuth(previewEnv);
  assert.deepEqual(auth.trustedOrigins, [
    `https://${deploymentHost}`,
    `https://${previewHost}`,
    "https://you-and-me-black.vercel.app",
  ]);
  assert.deepEqual(auth.baseURL?.allowedHosts, [
    "you-and-me-black.vercel.app",
    deploymentHost,
    previewHost,
  ]);
  assert.equal(auth.baseURL?.protocol, "https");
  assert.equal(auth.baseURL?.fallback, production);
  assert.equal(
    auth.baseURL?.allowedHosts.some((host) => host.includes("*")),
    false,
  );
});

test("better-auth accepts the preview origin and rejects other vercel.app hosts", () => {
  const { trustedOrigins } = vercelPreviewAuth(previewEnv);
  const trusted = (origin: string) =>
    trustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
  assert.equal(trusted(`https://${previewHost}`), true);
  assert.equal(trusted(`https://${previewHost}/login`), true);
  assert.equal(trusted(`https://${deploymentHost}`), true);
  assert.equal(trusted("https://you-and-me-black.vercel.app"), true);
  assert.equal(trusted("https://evil.vercel.app"), false);
  assert.equal(trusted("https://you-and-me-other-branch-kristian-mark.vercel.app"), false);
  assert.equal(trusted(`https://${previewHost}.evil.com`), false);
  assert.equal(trusted("https://vercel.app"), false);
});

test("production ignores deployment urls", () => {
  const auth = vercelPreviewAuth({ ...previewEnv, VERCEL_ENV: "production" });
  assert.equal(auth.baseURL, null);
  assert.deepEqual(auth.trustedOrigins, []);
});

test("unset and development envs do not widen trust", () => {
  assert.deepEqual(vercelPreviewAuth({ ...previewEnv, VERCEL_ENV: undefined }).trustedOrigins, []);
  assert.deepEqual(
    vercelPreviewAuth({ ...previewEnv, VERCEL_ENV: "development" }).trustedOrigins,
    [],
  );
});

test("wildcard and junk hosts are dropped, never expanded", () => {
  const auth = vercelPreviewAuth({
    VERCEL_ENV: "preview",
    VERCEL_URL: "*.vercel.app",
    VERCEL_BRANCH_URL: "https://*.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "not a host",
    BETTER_AUTH_URL: production,
  });
  assert.equal(auth.baseURL, null);
  assert.deepEqual(auth.trustedOrigins, []);
});

test("duplicate hosts collapse and a custom production domain is exact", () => {
  const auth = vercelPreviewAuth({
    VERCEL_ENV: " Preview ",
    VERCEL_URL: previewHost,
    VERCEL_BRANCH_URL: previewHost,
    VERCEL_PROJECT_PRODUCTION_URL: "https://us.example.com/path",
  });
  assert.deepEqual(auth.trustedOrigins, [`https://${previewHost}`, "https://us.example.com"]);
  assert.equal(auth.baseURL?.fallback, `https://${previewHost}`);
});
