import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const RU_MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

export const RU_MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export const RU_MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

export const RU_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export type RuDayStyle = "long" | "dayMonth" | "dayMonthShort" | "numeric" | "month" | "monthTitle";

export type DateSpan = "any" | "untilToday" | "fromToday";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A real calendar day, read from the first ten characters. Invalid days are null. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  const day = value?.slice(0, 10) ?? "";
  const match = DAY.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(year, month - 1, date);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== date) {
    return null;
  }
  return parsed;
}

export function capitalRu(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function formatRuDay(value: string | null | undefined, style: RuDayStyle): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  switch (style) {
    case "long":
      return `${day} ${RU_MONTHS_GENITIVE[month]} ${year}`;
    case "dayMonth":
      return `${day} ${RU_MONTHS_GENITIVE[month]}`;
    case "dayMonthShort":
      return `${day} ${RU_MONTHS_SHORT[month]}`;
    case "numeric":
      return `${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}.${year}`;
    case "month":
      return RU_MONTHS[month];
    case "monthTitle":
      return capitalRu(RU_MONTHS[month]);
  }
}

/** Local calendar day of a timestamp. Date-only strings stay on that day. */
export function formatRuInstant(value: string | null | undefined, style: "dayMonth" | "long" = "dayMonth"): string {
  if (!value) return "";
  if (value.length === 10) return formatRuDay(value, style);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatRuDay(toIsoDate(date), style);
}

export function formatRuWeekday(date: Date): string {
  return format(date, "EEEE, d MMMM yyyy", { locale: ru });
}

export function formatRuWeekdayShort(date: Date): string {
  return format(date, "EEE, d MMMM", { locale: ru }).toLowerCase();
}

export function formatRuMonthTitle(year: number, month: number): string {
  return `${capitalRu(RU_MONTHS[month - 1] ?? "")} ${year}`;
}

/** «8 ноября, 15:20», or «сегодня, 15:20». */
export function formatRuNoteStamp(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = format(date, "HH:mm");
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `сегодня, ${time}`;
  return `${formatRuDay(toIsoDate(date), "dayMonth")}, ${time}`;
}

/** «8 ноя в 15:20» from an instant. */
export function formatRuShortStamp(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatRuDay(toIsoDate(date), "dayMonthShort")} в ${format(date, "HH:mm")}`;
}

/**
 * What «Вместе с» should say. An empty choice stays «не указана»;
 * the day the pair connected is only a hint, so the editor and the row agree.
 */
function dayKey(value: string | null | undefined) {
  return parseIsoDate(value) ? value!.slice(0, 10) : null;
}

export function togetherChoiceLabel(
  chosen: string | null | undefined,
  pairedAt: string | null | undefined,
): { value: string; hint: string } {
  const explicit = dayKey(chosen);
  if (explicit) return { value: formatRuDay(explicit, "long"), hint: "" };
  const fallback = dayKey(pairedAt);
  if (fallback) return { value: "не указана", hint: `считаем с ${formatRuDay(fallback, "long")}` };
  return { value: "не указана", hint: "" };
}

export function dateBounds(span: DateSpan, today = new Date()) {
  const todayIso = toIsoDate(today);
  const year = today.getFullYear();
  if (span === "fromToday") {
    return {
      minIso: todayIso,
      maxIso: toIsoDate(new Date(year + 30, today.getMonth(), today.getDate())),
      minYear: year,
      maxYear: year + 30,
    };
  }
  const minIso = toIsoDate(new Date(year - 110, 0, 1));
  if (span === "untilToday") {
    return { minIso, maxIso: todayIso, minYear: year - 110, maxYear: year };
  }
  return {
    minIso,
    maxIso: toIsoDate(new Date(year + 30, 11, 31)),
    minYear: year - 110,
    maxYear: year + 30,
  };
}

export function isSelectableDate(iso: string, span: DateSpan, today = new Date()): boolean {
  if (!parseIsoDate(iso)) return false;
  const key = iso.slice(0, 10);
  const { minIso, maxIso } = dateBounds(span, today);
  return key >= minIso && key <= maxIso;
}

export function isSelectableSpanMonth(year: number, month: number, span: DateSpan, today = new Date()): boolean {
  if (month < 1 || month > 12) return false;
  const { minIso, maxIso } = dateBounds(span, today);
  const first = toIsoDate(new Date(year, month - 1, 1));
  const last = toIsoDate(new Date(year, month, 0));
  return last >= minIso && first <= maxIso;
}

export function decadeStarts(minYear: number, maxYear: number): number[] {
  const start = Math.floor(minYear / 10) * 10;
  const end = Math.floor(maxYear / 10) * 10;
  const decades: number[] = [];
  for (let year = start; year <= end; year += 10) decades.push(year);
  return decades;
}

export function clampYear(year: number, minYear: number, maxYear: number): number {
  return Math.min(maxYear, Math.max(minYear, year));
}
