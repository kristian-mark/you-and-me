import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getAuthSession } from "@/lib/auth/verify.server";
import { endLoginSession, endOtherLoginSessions, listLoginActivity, takeUnseenLogins } from "@/lib/login-events.server";

async function currentSession(bearerToken?: string) {
  const session = await getAuthSession(bearerToken);
  return session;
}

/** Other devices' logins. Called on app open and focus, not on the game poll. */
export const loadLoginNotice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const session = await currentSession(context.bearerToken);
    if (!session || session.userId !== context.userId) return [];
    return takeUnseenLogins(session.userId, session.sessionId);
  });

export const loadLoginActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const session = await currentSession(context.bearerToken);
    if (!session || session.userId !== context.userId) return { active: [], history: [] };
    return listLoginActivity(session.userId, session.sessionId);
  });

export const finishLoginSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id.trim())
  .handler(async ({ data, context }) => {
    const session = await currentSession(context.bearerToken);
    if (!session || session.userId !== context.userId) return;
    await endLoginSession(session.userId, session.sessionId, data);
  });

export const finishOtherLoginSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const session = await currentSession(context.bearerToken);
    if (!session || session.userId !== context.userId) return;
    await endOtherLoginSessions(session.userId, session.sessionId);
  });
