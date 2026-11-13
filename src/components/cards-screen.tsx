import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { SheetHeader } from "@/components/sheet-header";
import { UsBadge } from "@/components/ui/shell";
import { useCouple, usePlayerColors, type CardKind, type LoyaltyCard } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";
import { code128Pattern, ean13Pattern, patternToBars, qrGrid } from "@/lib/card-codes";

const COLORS = ["#3f8f46", "#d46a5c", "#5b7fc7", "#d4a017", "#2aa8a8", "#9b6bb8"];

const KINDS: { id: CardKind; label: string }[] = [
  { id: "ean13", label: "EAN-13" },
  { id: "code128", label: "Code-128" },
  { id: "qr", label: "QR" },
];

function formatNumber(value: string) {
  const raw = value.replace(/\s+/g, "");
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

export function detectKind(value: string): CardKind {
  const raw = value.replace(/\s+/g, "");
  if (!raw) return "ean13";
  const digitsOnly = /^\d+$/.test(raw);
  if (digitsOnly && raw.length === 13) return "ean13";
  if (digitsOnly) return "code128";
  if (/https?:\/\//i.test(raw) || raw.includes("/") || raw.length > 22) return "qr";
  if (/[^A-Za-z0-9]/.test(raw)) return "qr";
  return "code128";
}

export function CardsScreen({ onBack }: { onBack: () => void }) {
  const cards = useCouple((s) => s.cards);
  const updateCard = useCouple((s) => s.updateCard);
  const deleteCard = useCouple((s) => s.deleteCard);
  const addChat = useCouple((s) => s.addChat);
  const [mode, setMode] = useState<"list" | "scan" | "form">("list");
  const [draft, setDraft] = useState({ title: "", number: "", kind: "ean13" as CardKind, color: COLORS[0] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const selected = cards.find((c) => c.id === openId);
  const menuCard = cards.find((c) => c.id === menuId);
  const renameCard = cards.find((c) => c.id === renameId);

  if (mode === "scan") {
    return (
      <ScanCard
        onCancel={() => setMode("list")}
        onManual={(number, kind) => {
          setDraft({ title: "", number, kind, color: COLORS[0] });
          setMode("form");
        }}
      />
    );
  }

  if (mode === "form") {
    return (
      <CardForm
        draft={draft}
        onChange={setDraft}
        onCancel={() => setMode("list")}
        onSave={() => {
          useCouple.getState().addCard(draft);
          setMode("list");
        }}
      />
    );
  }

  if (selected) {
    return <CardDetail card={selected} onBack={() => setOpenId(null)} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mt-5 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-[30px] font-semibold tracking-tight sm:text-[34px]">Карты</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("scan")}
            className="grid size-11 place-items-center rounded-2xl bg-raised"
            aria-label="Добавить"
          >
            <Plus className="size-5" />
          </button>
          <UsBadge />
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {cards.map((card) => (
          <li key={card.id}>
            <CardRow
              card={card}
              onOpen={() => setOpenId(card.id)}
              onHold={() => setMenuId(card.id)}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setMode("scan")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-line py-6 text-[16px] text-muted"
      >
        <Plus className="size-4" />
        Сканировать карту
      </button>
      {toast ? <p className="mt-4 text-center text-sm text-green">{toast}</p> : null}

      {menuCard ? (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMenuId(null)}>
          <div
            className="absolute inset-x-4 bottom-10 overflow-hidden rounded-[22px] bg-raised"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-5 py-3 text-sm text-muted">{menuCard.title}</p>
            <button
              type="button"
              className="block w-full border-t border-line px-5 py-4 text-left text-[17px]"
              onClick={() => {
                setRenameId(menuCard.id);
                setMenuId(null);
              }}
            >
              Переименовать
            </button>
            <button
              type="button"
              className="block w-full border-t border-line px-5 py-4 text-left text-[17px]"
              onClick={() => {
                addChat(menuCard.title, menuCard.id);
                setMenuId(null);
                setToast("Отправлено в чат");
              }}
            >
              Отправить в чат
            </button>
            <button
              type="button"
              className="block w-full border-t border-line px-5 py-4 text-left text-[17px] text-pink"
              onClick={() => {
                deleteCard(menuCard.id);
                setMenuId(null);
              }}
            >
              Удалить
            </button>
            <button
              type="button"
              className="block w-full border-t border-line px-5 py-4 text-center text-muted"
              onClick={() => setMenuId(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {renameCard ? (
        <RenameSheet
          title={renameCard.title}
          onCancel={() => setRenameId(null)}
          onSave={(title) => {
            updateCard(renameCard.id, { title });
            setRenameId(null);
          }}
        />
      ) : null}
    </section>
  );
}

function CardRow({
  card,
  onOpen,
  onHold,
}: {
  card: LoyaltyCard;
  onOpen: () => void;
  onHold: () => void;
}) {
  const timer = useRef(0);
  const held = useRef(false);
  const colors = usePlayerColors();
  const clear = () => window.clearTimeout(timer.current);
  return (
    <button
      type="button"
      onPointerDown={() => {
        held.current = false;
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, 420);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => {
        e.preventDefault();
        onHold();
      }}
      onClick={() => {
        if (held.current) return;
        onOpen();
      }}
      className="relative flex w-full items-start justify-between rounded-[22px] px-5 py-5 text-left text-white"
      style={{ background: card.color }}
    >
      <span>
        <span className="block text-[20px] font-semibold">{card.title}</span>
        <span className="mt-3 block font-mono text-[15px] tracking-wide opacity-90">
          {formatNumber(card.number) || "—"}
        </span>
      </span>
      <span className={`mt-1 size-3.5 rounded-full ${pieceBg(card.owner === "me" ? colors.me : colors.partner)}`} />
    </button>
  );
}

function RenameSheet({
  title,
  onCancel,
  onSave,
}: {
  title: string;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(title);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 px-4 pb-10">
      <div className="w-full rounded-[22px] bg-raised p-5">
        <p className="text-[13px] text-muted">Новое название</p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-3 w-full rounded-2xl bg-chip px-4 py-3 text-[17px] outline-none"
          autoFocus
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-full bg-chip py-3 text-muted">
            Отмена
          </button>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => onSave(value.trim())}
            className="flex-1 rounded-full bg-cream py-3 font-semibold text-cream-fg disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanCard({
  onCancel,
  onManual,
}: {
  onCancel: () => void;
  onManual: (number: string, kind: CardKind) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [denied, setDenied] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let dead = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (dead) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<{ rawValue: string; format: string }[]>;
        } }).BarcodeDetector;
        if (!Detector || !videoRef.current) return;
        const detector = new Detector({ formats: ["ean_13", "code_128", "qr_code"] });
        const tick = async () => {
          if (dead || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const hit = found[0];
            if (hit?.rawValue) {
              const kind: CardKind =
                hit.format === "qr_code" ? "qr" : hit.format === "code_128" ? "code128" : "ean13";
              onManual(hit.rawValue, kind);
              return;
            }
          } catch {
            /* keep scanning */
          }
          timer = window.setTimeout(tick, 400);
        };
        timer = window.setTimeout(tick, 600);
      } catch {
        if (!dead) setDenied(true);
      }
    };

    void start();
    return () => {
      dead = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // camera starts once per scan screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onCancel} className="pt-5 text-left text-[17px] text-muted">
        Отмена
      </button>
      <h1 className="mt-16 text-center text-[28px] font-semibold leading-8">
        Наведи на штрихкод
        <br />
        на обороте карты
      </h1>

      <div className="relative mx-auto mt-10 w-full max-w-sm overflow-hidden rounded-[28px] bg-raised">
        <video ref={videoRef} className="aspect-[16/10] w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-5 top-5 h-10 w-10 rounded-tl-md border-l-[3px] border-t-[3px] border-blue" />
          <span className="absolute right-5 top-5 h-10 w-10 rounded-tr-md border-r-[3px] border-t-[3px] border-blue" />
          <span className="absolute bottom-5 left-5 h-10 w-10 rounded-bl-md border-b-[3px] border-l-[3px] border-blue" />
          <span className="absolute bottom-5 right-5 h-10 w-10 rounded-br-md border-b-[3px] border-r-[3px] border-blue" />
          <span className="scan-line absolute left-10 right-10 top-1/2 h-px bg-blue" />
        </div>
      </div>

      <p className="mt-5 text-center text-[14px] leading-5 text-muted">
        {denied
          ? "Камера недоступна. Введи номер вручную или возьми фото из галереи."
          : "EAN-13, Code-128 и QR распознаются сами"}
      </p>
      {hint ? <p className="mt-2 text-center text-[13px] text-pink">{hint}</p> : null}

      <button
        type="button"
        onClick={() => onManual("", "ean13")}
        className="mt-8 w-full rounded-full border border-line py-4 text-[16px]"
      >
        Ввести номер вручную
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-3 w-full rounded-full border border-line py-4 text-[16px]"
      >
        Выбрать из галереи
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<{ rawValue: string; format: string }[]>;
          } }).BarcodeDetector;
          if (!Detector) {
            setHint("С этого телефона фото не читается — введи номер вручную.");
            onManual("", "ean13");
            return;
          }
          try {
            const bmp = await createImageBitmap(file);
            const found = await new Detector({ formats: ["ean_13", "code_128", "qr_code"] }).detect(bmp);
            const hit = found[0];
            if (hit?.rawValue) {
              const kind: CardKind =
                hit.format === "qr_code" ? "qr" : hit.format === "code_128" ? "code128" : "ean13";
              onManual(hit.rawValue, kind);
              return;
            }
          } catch {
            /* fall through */
          }
          setHint("На фото код не нашёлся. Введи номер вручную.");
          onManual("", "ean13");
        }}
      />
    </section>
  );
}

function CardForm({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: { title: string; number: string; kind: CardKind; color: string };
  onChange: (next: { title: string; number: string; kind: CardKind; color: string }) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [kindsOpen, setKindsOpen] = useState(false);
  const kindLabel = KINDS.find((k) => k.id === draft.kind)?.label ?? "EAN-13";
  const ready = draft.title.trim().length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <SheetHeader flush title="Новая карта" onCancel={onCancel} onDone={onSave} doneDisabled={!ready} />

      <label className="mt-5 block rounded-[22px] bg-raised px-5 py-4">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">название</span>
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          className="mt-1 w-full bg-transparent text-[17px] outline-none"
          autoFocus
        />
      </label>

      <div className="relative mt-3 rounded-[22px] bg-raised px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] tracking-[0.14em] text-muted uppercase">номер</span>
          <button type="button" onClick={() => setKindsOpen((v) => !v)} className="text-[13px] text-blue">
            {kindLabel}
          </button>
        </div>
        <input
          value={draft.number}
          onChange={(e) => {
            const number = e.target.value;
            onChange({ ...draft, number, kind: detectKind(number) });
          }}
          placeholder="Цифры с карты"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
        {kindsOpen ? (
          <div className="absolute right-3 top-12 z-10 min-w-[140px] overflow-hidden rounded-2xl bg-[#2a2a2e] py-2 shadow-xl">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  onChange({ ...draft, kind: k.id });
                  setKindsOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-[16px]"
              >
                {k.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-[22px] bg-raised px-5 py-4">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">цвет</p>
        <div className="mt-3 flex gap-3">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...draft, color })}
              className={`size-9 rounded-full ${draft.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-raised" : ""}`}
              style={{ background: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CardDetail({ card, onBack }: { card: LoyaltyCard; onBack: () => void }) {
  const [qr, setQr] = useState(card.kind === "qr");
  const colors = usePlayerColors();
  const kindLabel = KINDS.find((k) => k.id === card.kind)?.label ?? "Code-128";
  const groups = formatNumber(card.number).split(" ").filter(Boolean);
  const mid = Math.max(1, Math.ceil(groups.length / 2));
  const line1 = groups.slice(0, mid).join("   ");
  const line2 = groups.slice(mid).join("   ");

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#fff";
    let lock: { release: () => Promise<void> } | null = null;
    void navigator.wakeLock
      ?.request("screen")
      .then((sent) => {
        lock = sent;
      })
      .catch(() => undefined);
    return () => {
      document.body.style.background = prev;
      void lock?.release();
    };
  }, []);

  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-white px-5 text-black">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-[17px] text-[#8b8b92]">
          Готово
        </button>
        <span className="rounded-full bg-[#efefef] px-3 py-1 text-[11px] tracking-[0.08em] text-[#6b6b70] uppercase">
          яркость 100%
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center pt-10">
        <h1 className="text-center text-[34px] font-semibold tracking-tight">{card.title}</h1>
        <p className="mt-3 flex items-center gap-2 text-[15px] text-[#8b8b92]">
          <span className={`size-3 rounded-full ${pieceBg(card.owner === "me" ? colors.me : colors.partner)}`} />
          {card.owner === "me" ? "Ты" : "Партнёр"} · {kindLabel}
        </p>

        <div className="mt-10 w-full max-w-[280px]">
          {qr ? <QrMark value={card.number} /> : <BarcodeMark card={card} />}
        </div>

        <p className="mt-8 text-center font-mono text-[28px] leading-9 tracking-wide">
          {line1}
          {line2 ? (
            <>
              <br />
              {line2}
            </>
          ) : null}
        </p>
      </div>

      <div className="pb-10">
        <button
          type="button"
          onClick={() => setQr((v) => !v)}
          className="w-full rounded-full border border-[#d8d8d8] py-4 text-[17px]"
        >
          {qr ? "Показать штрихкод" : "Показать QR"}
        </button>
        <p className="mt-3 text-center text-[13px] text-[#8b8b92]">экран не гаснет, пока карта открыта</p>
      </div>
    </section>
  );
}

function BarcodeMark({ card }: { card: LoyaltyCard }) {
  const raw = card.number.replace(/\s+/g, "");
  const packed =
    card.kind === "ean13"
      ? patternToBars(ean13Pattern(raw), true)
      : patternToBars(code128Pattern(raw) || code128Pattern("0"));
  const height = 120;
  return (
    <svg viewBox={`0 0 ${packed.width} ${height}`} className="h-[140px] w-full" role="img" aria-label="barcode">
      {packed.bars.map((bar, i) =>
        bar.black ? (
          <rect key={i} x={bar.x} y={0} width={bar.w} height={height} fill="#111" />
        ) : null,
      )}
    </svg>
  );
}

function QrMark({ value }: { value: string }) {
  const grid = qrGrid(value);
  const n = grid.length;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="mx-auto h-[220px] w-[220px]" role="img" aria-label="qr">
      {grid.map((row, y) =>
        row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" /> : null)),
      )}
    </svg>
  );
}
