import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CreditCard,
  Gift,
  ImagePlus,
  Images,
  ListChecks,
  Mic,
  Plus,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import { prepareAlbumUpload } from "@/lib/album-image";
import { getAlbumHome, type AlbumPhoto } from "@/lib/album-server";
import { uploadChatImage, uploadChatVoice } from "@/lib/chat-image";
import {
  CHAT_POLL_MS,
  MAX_VOICE_MS,
  cardKindLabel,
  chatClock,
  groupByDay,
  latestOwn,
  mediaNeedsRefresh,
  mergeThread,
  partnerReadMine,
  prettyCardSubtitle,
  voiceCaptureSupported,
  voiceLikelySilent,
  voiceMimeFor,
  type ChatCardKind,
  type ChatDto,
} from "@/lib/chat-model";
import { openChatCard, shareToChat } from "@/lib/chat-nav";
import {
  deleteChatMessage,
  markChatRead,
  refreshChatMedia,
  sendChatText,
  syncChat,
} from "@/lib/chat-server";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";
import { useScreenPoll } from "@/lib/screen-poll";

type KeyboardFrame = { inset: number; offset: number };

function useKeyboardFrame() {
  const [frame, setFrame] = useState<KeyboardFrame>({ inset: 0, offset: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setFrame({
        inset: inset > 120 ? Math.round(inset) : 0,
        offset: Math.max(0, Math.round(vv.offsetTop)),
      });
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return frame;
}

export function ChatScreen({ onBack }: { onBack: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const setUnread = useCouple((s) => s.setChatUnread);
  const colors = usePlayerColors();
  const keyboard = useKeyboardFrame();
  const [items, setItems] = useState<ChatDto[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [banner, setBanner] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<ChatDto | null>(null);
  const [plus, setPlus] = useState(false);
  const [album, setAlbum] = useState<AlbumPhoto[] | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceOk, setVoiceOk] = useState(false);
  const [ready, setReady] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const itemsRef = useRef(items);
  const marked = useRef("");
  const fails = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordStarted = useRef(0);
  const stopRef = useRef<(send: boolean) => void>(() => undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  itemsRef.current = items;

  useEffect(() => {
    setVoiceOk(voiceCaptureSupported());
    return () => releaseRecorder(false);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const next = Date.now() - recordStarted.current;
      setElapsed(next);
      if (next >= MAX_VOICE_MS) stopRef.current(true);
    }, 200);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [items, busy, recording]);

  async function pull() {
    const after = itemsRef.current.at(-1)?.createdAt ?? null;
    const sync = await syncChat({ data: { after } });
    const stamps = [after, ...sync.messages.map((item) => item.createdAt)].filter((value): value is string => Boolean(value));
    const newest = stamps.sort().at(-1) ?? null;
    setItems((current) => mergeThread(current, sync.messages, sync.deletedIds));
    setPartnerReadAt(sync.partnerReadAt);
    if (!after) setHasOlder(sync.hasOlder);
    if (newest && marked.current !== newest && (!sync.myReadAt || Date.parse(sync.myReadAt) < Date.parse(newest))) {
      marked.current = newest;
      try {
        await markChatRead({ data: newest });
      } catch {
        marked.current = "";
      }
    }
    setUnread(0);
    const stale = itemsRef.current
      .filter((item) => item.media && mediaNeedsRefresh(item.media.expiresAt))
      .map((item) => item.id)
      .slice(0, 40);
    if (stale.length) {
      const fresh = await refreshChatMedia({ data: stale }).catch(() => []);
      if (fresh.length) setItems((current) => mergeThread(current, fresh, []));
    }
    fails.current = 0;
    setBanner("");
    setReady(true);
  }

  useScreenPoll("chat", true, CHAT_POLL_MS, async () => {
    try {
      await pull();
    } catch (error) {
      fails.current += 1;
      if (fails.current >= 2) setBanner(error instanceof Error ? error.message : "Чат не ответил");
      setReady(true);
      throw error;
    }
  });

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }

  async function loadOlder() {
    const oldest = items[0];
    if (!oldest) return;
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    stick.current = false;
    try {
      const sync = await syncChat({ data: { before: oldest.createdAt } });
      setHasOlder(sync.hasOlder);
      setItems((current) => mergeThread(sync.messages, current, []));
      requestAnimationFrame(() => {
        const node = scroller.current;
        if (!node) return;
        node.scrollTop += node.scrollHeight - before;
      });
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Чат не ответил");
    }
  }

  async function sendText() {
    const draft = text.trim();
    if (!draft || busy) return;
    setText("");
    setBusy(true);
    stick.current = true;
    try {
      const saved = await sendChatText({ data: { text: draft } });
      setItems((current) => mergeThread(current, [saved], []));
      marked.current = saved.createdAt;
      void markChatRead({ data: saved.createdAt }).catch(() => undefined);
    } catch (error) {
      setText((current) => current || draft);
      setBanner(error instanceof Error ? error.message : "Не ушло");
    } finally {
      setBusy(false);
    }
  }

  async function sendFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (!files.length) return;
    setPlus(false);
    setBusy(true);
    stick.current = true;
    try {
      for (const file of files.slice(0, 6)) {
        const prepared = await prepareAlbumUpload(file);
        const saved = await uploadChatImage(prepared);
        setItems((current) => mergeThread(current, [saved], []));
      }
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Фото не ушло");
    } finally {
      setBusy(false);
    }
  }

  async function openAlbumPicker() {
    setPlus(false);
    setAlbum([]);
    try {
      const home = await getAlbumHome();
      setAlbum(home.photos.filter((photo) => photo.thumbUrl).slice(0, 24));
    } catch (error) {
      setAlbum(null);
      setBanner(error instanceof Error ? error.message : "Альбом не открылся");
    }
  }

  async function sendAlbumPhoto(photo: AlbumPhoto) {
    setAlbum(null);
    setBusy(true);
    try {
      const saved = await shareToChat({ kind: "photo", id: photo.id, title: "Фото", subtitle: "из альбома" });
      setItems((current) => mergeThread(current, [saved], []));
      stick.current = true;
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Не ушло");
    } finally {
      setBusy(false);
    }
  }

  function releaseRecorder(send: boolean) {
    const active = recorder.current;
    const media = stream.current;
    recorder.current = null;
    stream.current = null;
    if (active && active.state !== "inactive") {
      active.onstop = send ? active.onstop : null;
      active.stop();
    }
    media?.getTracks().forEach((track) => track.stop());
    if (!send) chunks.current = [];
    setRecording(false);
  }

  function stopRecorder(send: boolean) {
    const active = recorder.current;
    if (!active) {
      releaseRecorder(false);
      return;
    }
    if (!send) {
      releaseRecorder(false);
      return;
    }
    active.stop();
  }
  stopRef.current = stopRecorder;

  async function startRecord() {
    if (!voiceOk || recording || busy) return;
    const mime = voiceMimeFor(
      typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
        ? (type) => MediaRecorder.isTypeSupported(type)
        : null,
    );
    if (!mime) {
      setVoiceOk(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const next = new MediaRecorder(media, { mimeType: mime });
      chunks.current = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks.current, { type: next.mimeType || mime });
        const duration = Date.now() - recordStarted.current;
        media.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
        if (/webm|ogg/i.test(blob.type)) {
          setBanner("На этом телефоне голосовые не запишутся так, чтобы их было слышно");
          return;
        }
        void sendVoice(blob, duration);
      };
      recorder.current = next;
      recordStarted.current = Date.now();
      setElapsed(0);
      next.start();
      setRecording(true);
    } catch {
      releaseRecorder(false);
      setBanner("Нет доступа к микрофону");
    }
  }

  async function sendVoice(blob: Blob, duration: number) {
    if (duration < 400) return;
    setBusy(true);
    stick.current = true;
    try {
      const saved = await uploadChatVoice(blob, Math.min(duration, MAX_VOICE_MS));
      setItems((current) => mergeThread(current, [saved], []));
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Голосовое не ушло");
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage(message: ChatDto) {
    setMenu(null);
    if (!message.body) return;
    try {
      await navigator.clipboard.writeText(message.body);
    } catch {
      const area = document.createElement("textarea");
      area.value = message.body;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  async function removeMessage(message: ChatDto) {
    setMenu(null);
    try {
      await deleteChatMessage({ data: message.id });
      setItems((current) => current.filter((item) => item.id !== message.id));
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Не удалилось");
    }
  }

  const mineId = latestOwn(items, myUserId ?? "")?.id ?? "";
  const days = groupByDay(items.filter((item) => !item.deletedAt));
  const showSend = text.trim().length > 0 || !voiceOk;

  return (
    <section
      className="app-frame safe-pad fixed left-1/2 z-30 flex w-full -translate-x-1/2 flex-col bg-bg"
      style={{ top: keyboard.offset, bottom: keyboard.inset }}
    >
      <header className="flex min-h-14 items-center gap-2 px-3 pt-2">
        <button type="button" onClick={onBack} className="min-h-11 shrink-0 px-1 text-[17px] text-muted" aria-label="Ещё">
          ‹
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="relative h-5 w-8 shrink-0" aria-hidden="true">
            <span className={`absolute top-0.5 left-0 size-4 rounded-full ${pieceBg(colors.me)}`} />
            <span className={`absolute top-0.5 right-0 size-4 rounded-full ${pieceBg(colors.partner)}`} />
          </span>
          <h1 className="truncate text-[17px] font-semibold">{partnerName}</h1>
        </div>
        <span className="w-7 shrink-0" />
      </header>

      {banner ? (
        <p className="px-4 pb-2 text-center text-[13px] text-muted">{banner}</p>
      ) : null}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {hasOlder ? (
          <button type="button" onClick={() => void loadOlder()} className="mx-auto mb-4 block min-h-11 text-[13px] text-muted">
            Раньше
          </button>
        ) : null}
        {!ready ? <p className="pt-16 text-center text-muted">Собираем переписку…</p> : null}
        {ready && !items.length ? (
          <p className="px-6 pt-16 text-center text-[16px] leading-snug text-muted">
            Напишите {partnerName} — сообщение появится у обоих, пока чат открыт.
          </p>
        ) : null}
        {days.map((day) => (
          <div key={day.key} className="mt-2">
            <p className="py-3 text-center text-[12px] tracking-[0.14em] text-muted">{day.label}</p>
            <div className="space-y-1.5">
              {day.items.map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  mine={message.authorUserId === myUserId}
                  color={message.authorUserId === myUserId ? colors.me : colors.partner}
                  read={message.id === mineId && partnerReadMine(message.createdAt, partnerReadAt)}
                  onOpen={() => {
                    if (!message.card || message.card.removed) return;
                    openChatCard({ kind: message.card.kind, id: message.card.id, subtitle: message.card.subtitle });
                  }}
                  onHold={() => {
                    if (message.authorUserId === myUserId) setMenu(message);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={keyboard.inset > 0 ? "px-2 pt-2 pb-2" : "px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"}>
        {recording ? (
          <div className="flex min-h-12 items-center gap-2 rounded-full bg-raised px-2">
            <button type="button" className="grid size-11 place-items-center" aria-label="Отменить" onClick={() => stopRecorder(false)}>
              <X className="size-5" />
            </button>
            <span className="size-2 shrink-0 rounded-full bg-move" />
            <span className="min-w-0 flex-1 text-[16px] tabular-nums">{formatElapsed(elapsed)}</span>
            <button type="button" className="grid size-11 place-items-center text-blue" aria-label="Отправить голосовое" onClick={() => stopRecorder(true)}>
              <Send className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-raised"
              aria-label="Прикрепить"
              onClick={() => setPlus(true)}
              disabled={busy}
            >
              <Plus className="size-5" />
            </button>
            <textarea
              rows={1}
              value={text}
              placeholder="Сообщение"
              enterKeyHint="send"
              autoCapitalize="sentences"
              className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-3xl bg-raised px-4 py-2.5 text-[16px] leading-6 outline-none"
              onChange={(event) => {
                setText(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`;
              }}
              onFocus={() => {
                window.setTimeout(() => {
                  const el = scroller.current;
                  if (el) el.scrollTop = el.scrollHeight;
                }, 280);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendText();
                }
              }}
            />
            {showSend ? (
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-blue text-bg disabled:opacity-40"
                aria-label="Отправить"
                disabled={busy || !text.trim()}
                onClick={() => void sendText()}
              >
                <Send className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-raised"
                aria-label="Голосовое"
                disabled={busy}
                onClick={() => void startRecord()}
              >
                <Mic className="size-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void sendFiles(event.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void sendFiles(event.target.files)} />

      {plus ? (
        <Sheet onClose={() => setPlus(false)}>
          <SheetButton label="Сделать фото" onClick={() => cameraRef.current?.click()} />
          <SheetButton label="Выбрать фото" onClick={() => fileRef.current?.click()} />
          <SheetButton label="Из альбома" onClick={() => void openAlbumPicker()} />
        </Sheet>
      ) : null}

      {album ? (
        <Sheet onClose={() => setAlbum(null)} title="Из альбома">
          {album.length ? (
            <div className="grid grid-cols-3 gap-2 p-3">
              {album.map((photo) => (
                <button key={photo.id} type="button" className="aspect-square overflow-hidden rounded-xl bg-chip" onClick={() => void sendAlbumPhoto(photo)}>
                  <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-muted">В альбоме пока нет фото</p>
          )}
        </Sheet>
      ) : null}

      {menu ? (
        <Sheet onClose={() => setMenu(null)}>
          {menu.body ? <SheetButton label="Копировать" onClick={() => void copyMessage(menu)} /> : null}
          <SheetButton label="Удалить у обоих" danger onClick={() => void removeMessage(menu)} />
        </Sheet>
      ) : null}
    </section>
  );
}

function Bubble({
  message,
  mine,
  color,
  read,
  onOpen,
  onHold,
}: {
  message: ChatDto;
  mine: boolean;
  color: "blue" | "pink";
  read: boolean;
  onOpen: () => void;
  onHold: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const bg = color === "blue" ? "bg-blue text-white" : "bg-pink text-bg";
  const silent = message.kind === "voice" && message.media ? voiceLikelySilent(message.media.mime, navigator.userAgent) : false;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[78%] min-w-0">
        <div
          className={`${message.kind === "text" || message.kind === "card" ? `${bg} px-3 py-2` : ""} rounded-[22px]`}
          onPointerDown={() => {
            clear();
            held.current = false;
            timer.current = window.setTimeout(() => {
              held.current = true;
              onHold();
            }, 480);
          }}
          onPointerUp={clear}
          onPointerCancel={clear}
          onPointerLeave={clear}
          onContextMenu={(event) => {
            if (!mine) return;
            event.preventDefault();
            onHold();
          }}
        >
          {message.kind === "text" ? (
            <p className="text-[16px] leading-snug break-words whitespace-pre-wrap">
              {message.body} <span className="ml-1 text-[11px] whitespace-nowrap opacity-75">{chatClock(message.createdAt)}</span>
            </p>
          ) : null}
          {message.kind === "image" && !message.media ? (
            <p className={`${bg} rounded-[22px] px-3 py-2 text-[15px]`}>Фото не открылось</p>
          ) : null}
          {message.kind === "image" && message.media ? (
            <figure className="overflow-hidden rounded-[22px]">
              <img src={message.media.thumbUrl || message.media.url} alt="" className="max-h-64 w-full object-cover" />
              <figcaption className={`px-3 py-1 text-right text-[11px] ${bg}`}>{chatClock(message.createdAt)}</figcaption>
            </figure>
          ) : null}
          {message.kind === "voice" && message.media ? (
            <div className={`${bg} rounded-[22px] px-3 py-2`}>
              {silent ? (
                <p className="text-[13px]">Это голосовое здесь не воспроизводится</p>
              ) : (
                <audio controls preload="none" src={message.media.url} className="h-9 max-w-full" />
              )}
              <p className="text-right text-[11px] opacity-75">{chatClock(message.createdAt)}</p>
            </div>
          ) : null}
          {message.kind === "card" && message.card ? (
            <button
              type="button"
              onClick={() => {
                if (held.current) {
                  held.current = false;
                  return;
                }
                onOpen();
              }}
              disabled={message.card.removed}
              className="flex w-full min-w-0 items-center gap-2 text-left disabled:opacity-70"
            >
              {message.card.thumbUrl ? (
                <img src={message.card.thumbUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <CardIcon kind={message.card.kind} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] tracking-[0.12em] opacity-80">{cardKindLabel(message.card.kind)}</span>
                <span className={`block truncate text-[15px] ${message.card.removed ? "line-through" : ""}`}>
                  {message.card.title}
                </span>
                <span className="block truncate text-[12px] opacity-80">
                  {message.card.removed ? "удалено" : prettyCardSubtitle(message.card.kind, message.card.subtitle)}
                </span>
              </span>
              {message.card.removed ? null : <ChevronRight className="size-4 shrink-0 opacity-70" />}
              <span className="self-end text-[11px] opacity-75">{chatClock(message.createdAt)}</span>
            </button>
          ) : null}
        </div>
        {read ? <p className="mt-1 pr-1 text-right text-[12px] text-muted">прочитано</p> : null}
      </div>
    </div>
  );
}

function CardIcon({ kind }: { kind: ChatCardKind }) {
  const Icon =
    kind === "wish"
      ? Gift
      : kind === "task"
        ? CheckSquare
        : kind === "event"
          ? CalendarDays
          : kind === "list"
            ? ListChecks
            : kind === "note"
              ? StickyNote
              : kind === "loyalty"
                ? CreditCard
                : kind === "photo"
                  ? ImagePlus
                  : Images;
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-black/15">
      <Icon className="size-5" />
    </span>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/55" onClick={onClose}>
      <div
        className="app-frame mx-auto max-h-[70dvh] w-full overflow-y-auto rounded-t-3xl bg-raised pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="text-[15px] text-muted">{title ?? ""}</p>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SheetButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block min-h-12 w-full border-t border-line px-4 text-left text-[17px] ${danger ? "text-move" : ""}`}
    >
      {label}
    </button>
  );
}

function formatElapsed(ms: number) {
  const total = Math.min(60, Math.floor(ms / 1000));
  return `0:${String(total).padStart(2, "0")}`;
}
