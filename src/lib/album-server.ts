import { createServerFn } from "@tanstack/react-start";
import {
  changeAlbumPhotos,
  createCoupleAlbum,
  deleteCoupleAlbum,
  loadAlbumHome,
  loadAlbumTrash,
  purgeAlbumPhotos,
  restoreAlbumPhotos,
  setAlbumLike,
  signAlbumFull,
  signAlbumThumbs,
  softDeletePhotos,
  updateCoupleAlbum,
  type AlbumHome,
  type TrashPhoto,
} from "@/lib/album-core";
import { authMiddleware } from "@/lib/auth/middleware";

export type { AlbumCard, AlbumHome, AlbumPhoto, AlbumQuota, TrashPhoto } from "@/lib/album-core";

export const getAlbumHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AlbumHome> => loadAlbumHome(context.userId));

export const getAlbumTrash = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TrashPhoto[]> => loadAlbumTrash(context.userId));

export const signAlbumPhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ids?: string[] }) => ({ ids: input.ids ?? [] }))
  .handler(async ({ context, data }) => signAlbumThumbs(context.userId, data.ids));

export const openAlbumPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; download?: boolean }) => input)
  .handler(async ({ context, data }) =>
    signAlbumFull(context.userId, data.id, Boolean(data.download)),
  );

export const createAlbum = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; photoIds?: string[]; coverPhotoId?: string | null }) => input)
  .handler(async ({ context, data }) => createCoupleAlbum(context.userId, data));

export const updateAlbum = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; title?: string; coverPhotoId?: string | null }) => input)
  .handler(async ({ context, data }) => updateCoupleAlbum(context.userId, data));

export const deleteAlbum = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    await deleteCoupleAlbum(context.userId, data);
  });

export const editAlbumPhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { albumId: string; add?: string[]; remove?: string[] }) => input)
  .handler(async ({ context, data }) => changeAlbumPhotos(context.userId, data));

export const deleteAlbumPhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((ids: string[]) => ids)
  .handler(async ({ context, data }) => {
    await softDeletePhotos(context.userId, data);
  });

export const restorePhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((ids: string[]) => ids)
  .handler(async ({ context, data }) => {
    await restoreAlbumPhotos(context.userId, data);
  });

export const erasePhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((ids: string[]) => ids)
  .handler(async ({ context, data }) => {
    await purgeAlbumPhotos(context.userId, data);
  });

export const likeAlbumPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; liked: boolean }) => input)
  .handler(async ({ context, data }) => {
    await setAlbumLike(context.userId, data.id, data.liked);
  });
