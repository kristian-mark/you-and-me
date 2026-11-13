import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChatUpload } = await import("@/lib/chat-http");
        return handleChatUpload(request);
      },
    },
  },
});
