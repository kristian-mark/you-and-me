import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  RU_MONTHS,
  RU_WEEKDAYS,
  capitalRu,
  clampYear,
  dateBounds,
  decadeStarts,
  formatRuMonthTitle,
  isSelectableDate,
  isSelectableSpanMonth,
  parseIsoDate,
  toIsoDate,
  type DateSpan,
} from "@/lib/dates";

type Step = "year" | "month" | "day";
type Mode = "birthday" | DateSpan;

function monthName(month: number): string {
  return RU_MONTHS[month - 1] ?? "";
}

/**
 * The one date sheet. Birthdays keep the year → month → day walk.
 * Every other date opens on the month, and the title jumps to month and year.
 * Portaled to the body so iOS Safari does not clip it inside a transformed sheet.
 */
export function DatePicker({
  value,
  onPick,
  onClose,
  mode = "any",
  label = "Дата",
  anchor,
  allowClear = false,
}: {
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
  mode?: Mode;
  label?: string;
  anchor?: string;
  allowClear?: boolean;
}) {
  const [today] = useState(() => new Date());
  const birthday = mode === "birthday";
  const bounds = birthday ? null : dateBounds(mode, today);
  const range = birthday ? birthdayYearRange(today) : null;
  const minYear = birthday ? range!.minYear : bounds!.minYear;
  const maxYear = birthday ? range!.maxYear : bounds!.maxYear;
  const parsedBirthday = birthday ? parseBirthday(value, today) : null;
  const parsed = !birthday ? parseIsoDate(value) : null;
  const anchorDate = !birthday ? parseIsoDate(anchor) : null;
  const start = parsed ?? anchorDate ?? today;
  const [step, setStep] = useState<Step>(birthday ? (parsedBirthday ? "day" : "year") : "day");
  const [year, setYear] = useState<number | null>(
    birthday ? (parsedBirthday?.year ?? null) : (parsed?.getFullYear() ?? start.getFullYear()),
  );
  const [month, setMonth] = useState<number | null>(
    birthday ? (parsedBirthday?.month ?? null) : (parsed ? parsed.getMonth() + 1 : start.getMonth() + 1),
  );
  const [scrollYear, setScrollYear] = useState(
    birthday ? (parsedBirthday?.year ?? range!.anchorYear) : (parsed?.getFullYear() ?? start.getFullYear()),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const decadeRowRef = useRef<HTMLDivElement>(null);
  const decadeChipRef = useRef<HTMLButtonElement>(null);
  const decades = birthday ? birthdayDecades(today) : decadeStarts(minYear, maxYear);
  const years: number[] = [];
  for (let item = minYear; item <= maxYear; item += 1) years.push(item);

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
      const anchorButton = anchorRef.current;
      if (scroller && anchorButton) {
        const scrollerBox = scroller.getBoundingClientRect();
        const anchorBox = anchorButton.getBoundingClientRect();
        const delta = anchorBox.top - scrollerBox.top - scroller.clientHeight / 2 + anchorBox.height / 2;
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

  const shownYear = year ?? start.getFullYear();
  const shownMonth = month ?? start.getMonth() + 1;
  const monthLabel = monthName(birthday ? (month ?? 0) : shownMonth);
  const title = birthday
    ? step === "month" && year != null
      ? String(year)
      : step === "day" && year != null && monthLabel
        ? `${capitalRu(monthLabel)} ${year}`
        : "Выбери год"
    : step === "year"
      ? "Год"
      : step === "month"
        ? String(shownYear)
        : formatRuMonthTitle(shownYear, shownMonth);

  const goBack = () => {
    if (step === "day") setStep(birthday ? "month" : "month");
    else if (step === "month") setStep("year");
    else setStep(birthday ? "year" : "month");
  };

  const chooseYear = (next: number) => {
    const safe = clampYear(next, minYear, maxYear);
    setYear(safe);
    setScrollYear(safe);
    if (birthday && month != null && !isSelectableMonth(safe, month, today)) setMonth(null);
    if (!birthday && month != null && !isSelectableSpanMonth(safe, month, mode, today)) {
      setMonth(null);
    }
    setStep("month");
  };

  const chooseMonth = (next: number) => {
    if (birthday) {
      if (year == null || !isSelectableMonth(year, next, today)) return;
      setMonth(next);
      setStep("day");
      return;
    }
    if (!isSelectableSpanMonth(shownYear, next, mode, today)) return;
    setYear(shownYear);
    setMonth(next);
    setStep("day");
  };

  const chooseDay = (iso: string) => {
    if (birthday) {
      if (!isSelectableBirthday(iso, today)) return;
    } else if (!isSelectableDate(iso, mode, today)) {
      return;
    }
    onPick(iso);
    onClose();
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(shownYear, shownMonth - 1 + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    if (!isSelectableSpanMonth(nextYear, nextMonth, mode as DateSpan, today)) return;
    setYear(nextYear);
    setMonth(nextMonth);
  };

  const canShift = (delta: number) => {
    if (birthday) return false;
    const next = new Date(shownYear, shownMonth - 1 + delta, 1);
    return isSelectableSpanMonth(next.getFullYear(), next.getMonth() + 1, mode, today);
  };

  const activeDecade = Math.floor(scrollYear / 10) * 10;
  const dayCount = daysInMonth(shownYear, shownMonth);
  const pad = mondayOffset(shownYear, shownMonth);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[120] flex h-dvh max-h-dvh w-full max-w-full items-end justify-center overflow-hidden sm:items-center">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-picker-title"
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
          className="grid shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 px-3 pt-3"
          style={{
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          }}
        >
          {step === "year" || (step === "day" && !birthday) ? (
            step === "day" && !birthday ? (
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                disabled={!canShift(-1)}
                aria-label="Предыдущий месяц"
                className="grid size-11 place-items-center rounded-full bg-raised disabled:opacity-30"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <span />
            )
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
          <button
            type="button"
            onClick={() => {
              if (step === "day") setStep("month");
              else if (step === "month") setStep("year");
            }}
            className="min-w-0 text-center"
          >
            <p className="text-[12px] tracking-[0.16em] text-muted uppercase">{label}</p>
            <h2 id="date-picker-title" className="mt-0.5 truncate text-[20px] font-semibold">
              {title}
            </h2>
          </button>
          {step === "day" && !birthday ? (
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canShift(1)}
              aria-label="Следующий месяц"
              className="grid size-11 place-items-center rounded-full bg-raised disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : (
            <span />
          )}
        </div>

        {step === "year" ? (
          <div
            ref={decadeRowRef}
            className="mt-3 flex w-full min-w-0 flex-wrap gap-2 px-4 pb-1"
            style={{
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            {decades.map((decade) => (
              <button
                key={decade}
                ref={decade === activeDecade ? decadeChipRef : undefined}
                type="button"
                onClick={() =>
                  setScrollYear(birthday ? yearInDecade(decade, today) : clampYear(decade, minYear, maxYear))
                }
                aria-pressed={decade === activeDecade}
                aria-label={`Годы ${decade}-х`}
                className={`rounded-full px-3.5 py-2 text-[14px] ${
                  decade === activeDecade ? "bg-cream font-semibold text-cream-fg" : "bg-chip text-muted"
                }`}
              >
                {decade}-е
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={scrollerRef}
          className="mt-3 min-h-0 overflow-y-auto overscroll-contain px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maxHeight: "min(48dvh, 420px)",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
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

          {step === "month" ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, index) => {
                const item = index + 1;
                const disabled = birthday
                  ? year == null || !isSelectableMonth(year, item, today)
                  : !isSelectableSpanMonth(shownYear, item, mode, today);
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

          {step === "day" && (birthday ? year != null && month != null : true) ? (
            <div>
              <div className="grid grid-cols-7 text-center text-[12px] text-muted">
                {RU_WEEKDAYS.map((name) => (
                  <span key={name} className="py-1">
                    {name}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7">
                {Array.from({ length: pad }, (_, index) => (
                  <span key={`pad-${index}`} />
                ))}
                {Array.from({ length: dayCount }, (_, index) => {
                  const day = index + 1;
                  const iso = birthday
                    ? birthdayIso(year!, month!, day)
                    : birthdayIso(shownYear, shownMonth, day);
                  const disabled = birthday
                    ? !isSelectableBirthday(iso, today)
                    : !isSelectableDate(iso, mode, today);
                  const selected = iso === value.slice(0, 10);
                  const isToday = iso === toIsoDate(today);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => chooseDay(iso)}
                      aria-pressed={selected}
                      aria-label={formatRuMonthTitle(birthday ? year! : shownYear, birthday ? month! : shownMonth) + ` ${day}`}
                      className={`grid h-11 w-full place-items-center rounded-full text-[16px] ${
                        selected
                          ? "bg-cream font-semibold text-cream-fg"
                          : disabled
                            ? "text-muted/30"
                            : isToday
                              ? "text-fg ring-1 ring-cream/80"
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

        {!birthday ? (
          <button
            type="button"
            onClick={() => chooseDay(toIsoDate(today))}
            disabled={!isSelectableDate(toIsoDate(today), mode, today)}
            className="w-full shrink-0 py-3 text-[16px] text-fg disabled:text-muted"
          >
            Сегодня
          </button>
        ) : null}
        {allowClear ? (
          <button
            type="button"
            onClick={() => {
              onPick("");
              onClose();
            }}
            className="w-full shrink-0 py-2 text-[16px] text-muted"
          >
            Не указывать
          </button>
        ) : null}
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

export function BirthdayPicker({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  return <DatePicker mode="birthday" label="День рождения" value={value} onPick={onPick} onClose={onClose} />;
}
