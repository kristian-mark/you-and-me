import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/album/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAlbumUpload } = await import("@/lib/album-http");
        return handleAlbumUpload(request);
      },
    },
  },
});
