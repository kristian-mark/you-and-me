import { createServerFn } from "@tanstack/react-start";
import {
  badgeFor,
  deleteOwn,
  markRead,
  refreshMedia,
  sendCard,
  sendText,
  syncThread,
  type ChatSync,
} from "@/lib/chat-core";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  SUBTITLE_MAX,
  TITLE_MAX,
  assertChatId,
  cleanCardLine,
  cleanChatText,
  cursorIso,
  parseCardKind,
  type ChatDto,
} from "@/lib/chat-model";

export type { ChatDto, ChatSync };

function lift(error: unknown): never {
  if (error instanceof Error && error.message && !/^supabase \d+$/.test(error.message)) throw error;
  throw new Error("Чат не ответил");
}

export const syncChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { after?: string | null; before?: string | null } | null) => ({
    after: input?.after ? cursorIso(input.after) : null,
    before: input?.before ? cursorIso(input.before) : null,
  }))
  .handler(async ({ context, data }): Promise<ChatSync> => {
    try {
      return await syncThread(context.userId, data);
    } catch (error) {
      lift(error);
    }
  });

export const getChatBadge = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      return await badgeFor(context.userId);
    } catch (error) {
      lift(error);
    }
  });

export const sendChatText = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { text?: string }) => {
    const text = cleanChatText(input?.text ?? "");
    if (!text) throw new Error("Пустое сообщение");
    return { text };
  })
  .handler(async ({ context, data }): Promise<ChatDto> => {
    try {
      return await sendText(context.userId, data.text);
    } catch (error) {
      lift(error);
    }
  });

export const sendChatCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind?: string; id?: string; title?: string; subtitle?: string }) => {
    const kind = parseCardKind(input?.kind);
    if (!kind) throw new Error("Нечего отправить");
    return {
      kind,
      id: assertChatId(input?.id ?? ""),
      title: cleanCardLine(input?.title ?? "", TITLE_MAX) || "Без названия",
      subtitle: cleanCardLine(input?.subtitle ?? "", SUBTITLE_MAX),
    };
  })
  .handler(async ({ context, data }): Promise<ChatDto> => {
    try {
      return await sendCard(context.userId, data);
    } catch (error) {
      lift(error);
    }
  });

export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => assertChatId(id))
  .handler(async ({ context, data }) => {
    try {
      await deleteOwn(context.userId, data);
    } catch (error) {
      lift(error);
    }
  });

export const markChatRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((at: string) => at)
  .handler(async ({ context, data }) => {
    try {
      return await markRead(context.userId, data);
    } catch (error) {
      lift(error);
    }
  });

export const refreshChatMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((ids: string[]) => (Array.isArray(ids) ? ids : []))
  .handler(async ({ context, data }) => {
    try {
      return await refreshMedia(context.userId, data);
    } catch (error) {
      lift(error);
    }
  });
