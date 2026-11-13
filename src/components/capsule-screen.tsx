import { useMemo, useState } from "react";
import { addYears, differenceInCalendarDays } from "date-fns";
import { LockKeyhole, PencilLine } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { SheetHeader } from "@/components/sheet-header";
import { formatRuDay, toIsoDate } from "@/lib/dates";
import { useCouple, usePlayerColors, type Capsule } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";
import { togetherDay } from "@/lib/pair-identity";

function daysWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toIso(d: Date) {
  return toIsoDate(d);
}

function nextFromStamp(iso: string) {
  const src = parseDay(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), src.getMonth(), src.getDate());
  if (next < start) next = new Date(now.getFullYear() + 1, src.getMonth(), src.getDate());
  return next;
}

function labelDay(iso: string, style: "dayMonth" | "long") {
  return formatRuDay(iso, style);
}

export function CapsuleScreen({ onBack }: { onBack: () => void }) {
  const capsules = useCouple((s) => s.capsules);
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = capsules.find((c) => c.id === openId);
  const canView =
    Boolean(selected) &&
    selected!.author !== "me" &&
    differenceInCalendarDays(parseDay(selected!.opensAt), new Date()) <= 0;

  if (writing) return <WriteCapsule onClose={() => setWriting(false)} />;
  if (selected && canView) return <CapsuleDetail capsule={selected} onBack={() => setOpenId(null)} />;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-8">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-[17px] text-muted">
          ‹ Ещё
        </button>
        <button type="button" onClick={() => setWriting(true)} className="text-[17px] text-blue">
          Написать
        </button>
      </div>
      <h1 className="mt-5 text-[34px] font-semibold tracking-tight">Капсулы</h1>

      <ul className="mt-6 space-y-3">
        {capsules.map((c) => (
          <li key={c.id}>
            <CapsuleRow
              capsule={c}
              onOpen={() => {
                const days = differenceInCalendarDays(parseDay(c.opensAt), new Date());
                if (c.author === "me" || days > 0) return;
                setOpenId(c.id);
              }}
            />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-line py-4 text-[16px] text-muted"
          >
            <PencilLine className="size-4" />
            Написать капсулу
          </button>
        </li>
      </ul>
    </section>
  );
}

function CapsuleRow({
  capsule,
  onOpen,
}: {
  capsule: Capsule;
  onOpen: () => void;
}) {
  const opens = parseDay(capsule.opensAt);
  const days = differenceInCalendarDays(opens, new Date());
  const locked = capsule.author === "me" || days > 0;
  return (
    <div className="overflow-hidden rounded-[22px] border-r-4 border-blue bg-raised px-4 py-4">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 size-6 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-medium">{capsule.title || "Без названия"}</p>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            откроется {formatRuDay(capsule.opensAt, "dayMonth")}
            {days > 0 ? ` · через ${days} ${daysWord(days)}` : ""}
            {capsule.author === "me" ? " · запечатана" : days > 0 ? "" : " · можно читать"}
          </p>
        </div>
      </div>
    </div>
  );
}

function WriteCapsule({ onClose }: { onClose: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const anniversaryDate = useCouple((s) => s.anniversaryDate);
  const pairedAt = useCouple((s) => s.pairedAt);
  const addCapsule = useCouple((s) => s.addCapsule);
  const presets = useMemo(() => {
    const today = new Date();
    const year = addYears(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1);
    const chosen = togetherDay(anniversaryDate, pairedAt);
    const anniversary = chosen ? nextFromStamp(chosen) : year;
    const newYear = new Date(today.getFullYear() + 1, 0, 1);
    return {
      anniversary: toIso(anniversary),
      newyear: toIso(newYear),
      year: toIso(year),
    };
  }, [anniversaryDate, pairedAt]);

  const [opensAt, setOpensAt] = useState(presets.year);
  const [preset, setPreset] = useState<"anniversary" | "newyear" | "year" | "custom">("year");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pickDate, setPickDate] = useState(false);
  const ready = Boolean(title.trim() && body.trim() && opensAt);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-5 pb-8">
      <SheetHeader
        flush
        title="Капсула"
        onCancel={onClose}
        doneLabel="Запечатать"
        doneDisabled={!ready}
        onDone={() => {
          addCapsule({ title, body, opensAt, to: "partner" });
          onClose();
        }}
      />

      <div className="mt-6 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[22px] bg-raised px-4 py-4">
        <span className="text-[16px] text-muted">Кому</span>
        <span className="flex min-w-0 max-w-full items-center gap-2">
          <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
          <span className="min-w-0 break-words text-[16px]">{partnerName}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPickDate(true)}
        className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span className="text-[16px] text-muted">Откроется</span>
        <span className="rounded-full bg-chip px-3 py-1 text-[14px]">
          {opensAt ? labelDay(opensAt, "long") : "дата"}
        </span>
      </button>

      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {(
          [
            ["anniversary", "Годовщина", presets.anniversary],
            ["newyear", "Новый год", presets.newyear],
            ["year", "Через год", presets.year],
          ] as const
        ).map(([id, label, iso]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPreset(id);
              setOpensAt(iso);
            }}
            className={`max-w-full rounded-full px-4 py-2 text-[14px] break-words ${
              preset === id ? "bg-cream text-cream-fg" : "bg-raised text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex min-h-[280px] flex-1 flex-col rounded-[22px] bg-raised px-4 py-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Название — «Для тебя, в нашу годовщину»'
          className="bg-transparent pb-3 text-[16px] outline-none placeholder:text-muted"
        />
        <div className="h-px bg-line" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Пиши дальше…"
          className="mt-3 min-h-[180px] flex-1 resize-none bg-transparent text-[16px] leading-6 outline-none placeholder:text-muted"
        />
      </div>

      <p className="mt-3 rounded-[22px] bg-[#15202b] px-4 py-4 text-[14px] leading-5 text-[#9aa8b5]">
        После «Запечатать» текст уже не изменить. До{" "}
        {opensAt ? labelDay(opensAt, "dayMonth") : "даты"} {partnerName} увидит
        только то, что письмо есть.
      </p>
      {pickDate ? (
        <DatePicker
          mode="fromToday"
          label="Откроется"
          value={opensAt}
          onPick={(day) => {
            setOpensAt(day);
            setPreset("custom");
            setPickDate(false);
          }}
          onClose={() => setPickDate(false)}
        />
      ) : null}
    </section>
  );
}

function CapsuleDetail({ capsule, onBack }: { capsule: Capsule; onBack: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  const opens = parseDay(capsule.opensAt);
  const days = differenceInCalendarDays(opens, new Date());
  const locked = days > 0;
  const canRead = !locked;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-8">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Капсулы
      </button>
      <h1 className="mt-6 text-[32px] font-semibold leading-9">{capsule.title}</h1>
      <p className="mt-2 text-[14px] text-muted">
        для {capsule.to === "partner" ? partnerName : "тебя"} ·{" "}
        {locked
          ? `откроется ${formatRuDay(capsule.opensAt, "long")}`
          : `открылась ${formatRuDay(capsule.opensAt, "long")}`}
      </p>
      {canRead ? (
        <p className="mt-6 whitespace-pre-wrap rounded-[22px] bg-raised px-5 py-5 text-[16px] leading-7">
          {capsule.body}
        </p>
      ) : (
        <div className="mt-6 rounded-[22px] bg-raised px-5 py-8 text-center">
          <LockKeyhole className="mx-auto size-8 text-muted" />
          <p className="mt-3 text-[16px]">Капсула запечатана</p>
          <p className="mt-2 text-[14px] text-muted">
            До {formatRuDay(capsule.opensAt, "dayMonth")} с ней нельзя ничего сделать.
          </p>
        </div>
      )}
    </section>
  );
}
