import { getBearerToken } from "@/lib/auth/client";
import {
  localStamp,
  looksLikeHeic,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  readCaptureDate,
  sniffImage,
} from "@/lib/album-model";
import type { AlbumPhoto } from "@/lib/album-server";

const FULL_SIDE = 2048;
const THUMB_SIDE = 400;

export type PreparedUpload = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  takenAt: string;
};

export async function prepareAlbumUpload(file: File): Promise<PreparedUpload> {
  const original = new Uint8Array(await file.arrayBuffer());
  if (
    !sniffImage(original) &&
    !/^image\//i.test(file.type) &&
    !looksLikeHeic(original, file.name, file.type)
  ) {
    throw new Error("Это не фото");
  }
  const captured = readCaptureDate(original);
  const takenAt = captured ?? localStamp(new Date(file.lastModified || Date.now()));
  let blob: Blob = new Blob([original], { type: file.type || "application/octet-stream" });
  if (looksLikeHeic(original, file.name, file.type)) blob = await transcodeHeic(blob);
  const decoded = await decodeImage(blob);
  try {
    const fullCanvas = draw(decoded, FULL_SIDE);
    const thumbCanvas = draw(decoded, THUMB_SIDE);
    const full = await encode(fullCanvas, MAX_FULL_BYTES);
    const thumb = await encode(thumbCanvas, MAX_THUMB_BYTES);
    return {
      full: full.blob,
      thumb: thumb.blob,
      width: fullCanvas.width,
      height: fullCanvas.height,
      takenAt,
    };
  } finally {
    decoded.close();
  }
}

export function uploadPrepared(prepared: PreparedUpload, onProgress: (fraction: number) => void) {
  return new Promise<AlbumPhoto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.set("full", prepared.full, "full");
    body.set("thumb", prepared.thumb, "thumb");
    body.set("takenAt", prepared.takenAt);
    body.set("width", String(prepared.width));
    body.set("height", String(prepared.height));
    xhr.open("POST", "/api/album/upload");
    const token = getBearerToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Связь прервалась"));
    xhr.onload = () => {
      let payload: { photo?: AlbumPhoto; error?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as { photo?: AlbumPhoto; error?: string };
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.photo) resolve(payload.photo);
      else reject(new Error(payload?.error || "Фото не сохранилось"));
    };
    xhr.send(body);
  });
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImage(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // HEIC that the browser cannot decode, or a still-wrapped file.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Фото не открылось"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function transcodeHeic(blob: Blob) {
  try {
    const mod = (await import("heic-to")) as {
      heicTo?: (options: { blob: Blob; type: string; quality: number }) => Promise<Blob>;
    };
    if (!mod.heicTo) return blob;
    return await mod.heicTo({ blob, type: "image/jpeg", quality: 0.92 });
  } catch {
    return blob;
  }
}

function draw(image: Decoded, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Фото не сжалось");
  ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encode(canvas: HTMLCanvasElement, maxBytes: number) {
  let mime: "image/webp" | "image/jpeg" = "image/webp";
  let quality = 0.8;
  let blob = await toBlob(canvas, mime, quality);
  if (!blob || (blob.type && blob.type !== "image/webp")) {
    mime = "image/jpeg";
    blob = await toBlob(canvas, mime, quality);
  }
  while (blob && blob.size > maxBytes && quality > 0.5) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    const next = await toBlob(canvas, mime, quality);
    if (!next) break;
    blob = next;
  }
  if (!blob || blob.size > maxBytes) throw new Error("Файл слишком большой");
  return { blob, mime };
}

/**
 * Save into Photos via the share sheet when the browser can share a file
 * (iOS shows «Сохранить изображение»). Otherwise download a blob URL.
 * Never assign location or click a remote href — WebKit would leave the app.
 * Shared bytes are JPEG so Photos does not have to accept WebP.
 */
export async function saveAlbumPhoto(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось сохранить");
  const file = await jpegFile(await response.blob(), "photo.jpg");
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function jpegFile(blob: Blob, name: string) {
  if (blob.type === "image/jpeg") return new File([blob], name, { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось сохранить");
    ctx.drawImage(bitmap, 0, 0);
    const jpeg = await toBlob(canvas, "image/jpeg", 0.92);
    if (!jpeg) throw new Error("Не удалось сохранить");
    return new File([jpeg], name, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), mime, quality),
  );
}
