import { createServerFn } from "@tanstack/react-start";
import { loadActivity, markActivity, markAllActivity } from "@/lib/activity-core";
import { assertActivityId, isStoredSection, SECTION_MARK } from "@/lib/activity-model";
import { authMiddleware } from "@/lib/auth/middleware";

function lift(error: unknown): never {
  if (error instanceof Error && error.message && !/^supabase \d+$/.test(error.message)) throw error;
  throw new Error("Не вышло проверить новое");
}

export const getPairActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      return await loadActivity(context.userId);
    } catch (error) {
      lift(error);
    }
  });

export const markActivitySeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { section?: string; targetId?: string } | null) => {
    const section = input?.section ?? "";
    if (!isStoredSection(section)) throw new Error("Не тот раздел");
    const targetId = assertActivityId(input?.targetId ?? "");
    if (targetId === SECTION_MARK) throw new Error("Некорректный идентификатор");
    return { section, targetId };
  })
  .handler(async ({ context, data }) => {
    try {
      await markActivity(context.userId, data.section, data.targetId);
    } catch (error) {
      lift(error);
    }
  });

export const markActivitySection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { section?: string } | null) => {
    const section = input?.section ?? "";
    if (!isStoredSection(section)) throw new Error("Не тот раздел");
    return { section };
  })
  .handler(async ({ context, data }) => {
    try {
      await markActivity(context.userId, data.section, SECTION_MARK);
    } catch (error) {
      lift(error);
    }
  });

export const markAllPairActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await markAllActivity(context.userId);
    } catch (error) {
      lift(error);
    }
  });
