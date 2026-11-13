import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/album/purge")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleAlbumPurge } = await import("@/lib/album-http");
        return handleAlbumPurge(request);
      },
    },
  },
});
