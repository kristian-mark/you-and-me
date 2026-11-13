import { useMemo, useState } from "react";
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LockKeyhole, PencilLine } from "lucide-react";
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextFromStamp(iso: string) {
  const src = parseDay(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), src.getMonth(), src.getDate());
  if (next < start) next = new Date(now.getFullYear() + 1, src.getMonth(), src.getDate());
  return next;
}

function labelDay(iso: string, pattern: string) {
  return format(parseDay(iso), pattern, { locale: ru });
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
            откроется {format(opens, "d MMMM", { locale: ru })}
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
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-8">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onClose} className="text-[17px] text-muted">
          Отмена
        </button>
        <p className="text-[17px] font-semibold">Капсула</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            addCapsule({ title, body, opensAt, to: "partner" });
            onClose();
          }}
          className={`text-[17px] ${ready ? "text-blue" : "text-muted"}`}
        >
          Запечатать
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[22px] bg-raised px-4 py-4">
        <span className="text-[16px] text-muted">Кому</span>
        <span className="flex items-center gap-2">
          <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
          <span className="min-w-0 truncate text-[16px]">{partnerName}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPickDate(true)}
        className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span className="text-[16px] text-muted">Откроется</span>
        <span className="rounded-full bg-chip px-3 py-1 text-[14px]">
          {opensAt ? labelDay(opensAt, "d MMM yyyy") : "дата"}
        </span>
      </button>

      <div className="mt-3 flex gap-2 overflow-x-auto">
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
            className={`shrink-0 rounded-full px-4 py-2 text-[14px] ${
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
        {opensAt ? labelDay(opensAt, "d MMMM") : "даты"} {partnerName} увидит
        только то, что письмо есть.
      </p>
      {pickDate ? (
        <DaySheet
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
          ? `откроется ${format(opens, "d MMMM yyyy", { locale: ru })}`
          : `открылась ${format(opens, "d MMMM yyyy", { locale: ru })}`}
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
            До {format(opens, "d MMMM", { locale: ru })} с ней нельзя ничего сделать.
          </p>
        </div>
      )}
    </section>
  );
}

function DaySheet({
  value,
  onPick,
  onClose,
}: {
  value?: string;
  onPick: (day: string) => void;
  onClose: () => void;
}) {
  const [cursor, setCursor] = useState(() => (value ? parseDay(value) : new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-raised px-5 pt-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setCursor((d) => addMonths(d, -1))}>
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-[17px] font-semibold capitalize">
            {format(cursor, "LLLL yyyy", { locale: ru })}
          </p>
          <button type="button" onClick={() => setCursor((d) => addMonths(d, 1))}>
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted">
          {["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const picked = key === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                className={`mx-auto grid size-9 place-items-center rounded-full text-[15px] ${
                  picked ? "bg-[#163a3c] text-[#6ed7dc]" : isSameMonth(day, cursor) ? "text-fg" : "text-muted/40"
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full py-3 text-muted">
          Закрыть
        </button>
      </div>
    </div>
  );
}
