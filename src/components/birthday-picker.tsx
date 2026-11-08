import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import {
  birthdayDecades,
  birthdayIso,
  birthdayYearRange,
  daysInMonth,
  isSelectableBirthday,
  isSelectableMonth,
  mondayOffset,
  parseBirthday,
  yearInDecade,
} from "@/lib/birthday";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

type Step = "year" | "month" | "day";

function monthName(month: number): string {
  return format(new Date(2000, month - 1, 1), "LLLL", { locale: ru });
}

/**
 * Birthday sheet. Portaled to `document.body` and pinned to the viewport
 * (not `place-items-end` / `max-w-md` inside the form): on iPhone Safari the
 * old sheet was a month pager stuck to the right edge and clipped.
 */
export function BirthdayPicker({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const [today] = useState(() => new Date());
  const range = birthdayYearRange(today);
  const initial = parseBirthday(value, today);
  const [step, setStep] = useState<Step>(initial ? "day" : "year");
  const [year, setYear] = useState<number | null>(initial?.year ?? null);
  const [month, setMonth] = useState<number | null>(initial?.month ?? null);
  const [scrollYear, setScrollYear] = useState(initial?.year ?? range.anchorYear);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const decadeRowRef = useRef<HTMLDivElement>(null);
  const decadeChipRef = useRef<HTMLButtonElement>(null);
  const decades = birthdayDecades(today);
  const years: number[] = [];
  for (let y = range.minYear; y <= range.maxYear; y += 1) years.push(y);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    dialogRef.current?.focus();
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  useEffect(() => {
    if (step !== "year") return;
    const frame = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const anchor = anchorRef.current;
      if (scroller && anchor) {
        const scrollerBox = scroller.getBoundingClientRect();
        const anchorBox = anchor.getBoundingClientRect();
        const delta =
          anchorBox.top - scrollerBox.top - scroller.clientHeight / 2 + anchorBox.height / 2;
        scroller.scrollTop += delta;
        const edge = scroller.getBoundingClientRect().top;
        for (const button of scroller.querySelectorAll("button")) {
          const rect = button.getBoundingClientRect();
          if (rect.top < edge - 1 && rect.bottom > edge + 1) {
            scroller.scrollTop -= edge - rect.top;
            break;
          }
        }
      }
      const row = decadeRowRef.current;
      const chip = decadeChipRef.current;
      if (row && chip) {
        const rowBox = row.getBoundingClientRect();
        const chipBox = chip.getBoundingClientRect();
        row.scrollLeft += chipBox.left - rowBox.left - row.clientWidth / 2 + chipBox.width / 2;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step, scrollYear]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthLabel = month == null ? "" : monthName(month);
  const title =
    step === "month" && year != null
      ? String(year)
      : step === "day" && year != null && monthLabel
        ? `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`
        : "Выбери год";

  const goBack = () => {
    if (step === "day") setStep("month");
    else setStep("year");
  };

  const chooseYear = (next: number) => {
    setYear(next);
    setScrollYear(next);
    if (month != null && !isSelectableMonth(next, month, today)) setMonth(null);
    setStep("month");
  };

  const chooseMonth = (next: number) => {
    if (year == null || !isSelectableMonth(year, next, today)) return;
    setMonth(next);
    setStep("day");
  };

  const chooseDay = (iso: string) => {
    if (!isSelectableBirthday(iso, today)) return;
    onPick(iso);
    onClose();
  };

  const activeDecade = Math.floor(scrollYear / 10) * 10;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[120] flex h-dvh max-h-dvh w-full max-w-full items-end justify-center overflow-hidden sm:items-center">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="birthday-picker-title"
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-bg outline-none sm:rounded-[28px]"
        style={{
          width: "min(100%, 28rem)",
          maxHeight: "min(92dvh, 720px)",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />
        <div
          className="grid shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center px-3 pt-3"
          style={{
            paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
            paddingRight: "max(1.25rem, env(safe-area-inset-right))",
          }}
        >
          {step === "year" ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={goBack}
              aria-label="Назад"
              className="grid size-11 place-items-center rounded-full bg-raised"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0 text-center">
            <p className="text-[12px] tracking-[0.16em] text-muted uppercase">День рождения</p>
            <h2 id="birthday-picker-title" className="mt-0.5 truncate text-[20px] font-semibold">
              {title}
            </h2>
          </div>
          <span />
        </div>

        {step === "year" ? (
          <div
            ref={decadeRowRef}
            className="mt-3 flex w-full shrink-0 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
              paddingRight: "max(1.25rem, env(safe-area-inset-right))",
            }}
          >
            {decades.map((decade) => (
              <button
                key={decade}
                ref={decade === activeDecade ? decadeChipRef : undefined}
                type="button"
                onClick={() => setScrollYear(yearInDecade(decade, today))}
                aria-pressed={decade === activeDecade}
                aria-label={`Годы ${decade}-х`}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[14px] ${
                  decade === activeDecade
                    ? "bg-cream font-semibold text-cream-fg"
                    : "bg-chip text-muted"
                }`}
              >
                {decade}-е
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={scrollerRef}
          className="mt-3 min-h-0 overflow-y-auto overscroll-contain px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maxHeight: "min(48dvh, 420px)",
            paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
            paddingRight: "max(1.25rem, env(safe-area-inset-right))",
          }}
        >
          {step === "year" ? (
            <div className="grid grid-cols-4 gap-2">
              {years.map((item) => (
                <button
                  key={item}
                  ref={item === scrollYear ? anchorRef : undefined}
                  type="button"
                  onClick={() => chooseYear(item)}
                  aria-pressed={item === year}
                  className={`h-12 rounded-2xl text-[16px] tabular-nums ${
                    item === year ? "bg-cream font-semibold text-cream-fg" : "bg-raised text-fg"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {step === "month" && year != null ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, index) => {
                const item = index + 1;
                const disabled = !isSelectableMonth(year, item, today);
                const selected = item === month;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={disabled}
                    onClick={() => chooseMonth(item)}
                    aria-pressed={selected}
                    className={`h-14 rounded-2xl text-[16px] capitalize ${
                      selected
                        ? "bg-cream font-semibold text-cream-fg"
                        : disabled
                          ? "bg-raised/50 text-muted/35"
                          : "bg-raised text-fg"
                    }`}
                  >
                    {monthName(item)}
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "day" && year != null && month != null ? (
            <div>
              <div className="grid grid-cols-7 text-center text-[12px] text-muted">
                {WEEKDAYS.map((label) => (
                  <span key={label} className="py-1">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7">
                {Array.from({ length: mondayOffset(year, month) }, (_, index) => (
                  <span key={`pad-${index}`} />
                ))}
                {Array.from({ length: daysInMonth(year, month) }, (_, index) => {
                  const day = index + 1;
                  const iso = birthdayIso(year, month, day);
                  const disabled = !isSelectableBirthday(iso, today);
                  const selected = iso === value;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => chooseDay(iso)}
                      aria-pressed={selected}
                      aria-label={format(new Date(year, month - 1, day), "d MMMM yyyy", {
                        locale: ru,
                      })}
                      className={`grid h-11 w-full place-items-center rounded-full text-[16px] ${
                        selected
                          ? "bg-cream font-semibold text-cream-fg"
                          : disabled
                            ? "text-muted/30"
                            : "text-fg"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full shrink-0 border-t border-line py-3.5 text-[16px] text-muted"
        >
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  );
}
