import { getBearerToken } from "@/lib/auth/client";
import type { PreparedUpload } from "@/lib/album-image";
import type { ChatDto } from "@/lib/chat-model";

function postForm(path: string, body: FormData) {
  return new Promise<ChatDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    const token = getBearerToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onerror = () => reject(new Error("Связь прервалась"));
    xhr.onload = () => {
      let payload: { message?: ChatDto; error?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as { message?: ChatDto; error?: string };
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.message) resolve(payload.message);
      else reject(new Error(payload?.error || "Не сохранилось"));
    };
    xhr.send(body);
  });
}

export function uploadChatImage(prepared: PreparedUpload) {
  const body = new FormData();
  body.set("full", prepared.full, "full");
  body.set("thumb", prepared.thumb, "thumb");
  body.set("width", String(prepared.width));
  body.set("height", String(prepared.height));
  return postForm("/api/chat/upload", body);
}

export function uploadChatVoice(blob: Blob, durationMs: number) {
  const body = new FormData();
  body.set("voice", blob, "voice.m4a");
  body.set("durationMs", String(durationMs));
  return postForm("/api/chat/upload", body);
}
