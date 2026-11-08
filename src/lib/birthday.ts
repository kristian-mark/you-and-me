/** How far back a birthday can go. Far enough for a living person, short enough to scan. */
export const BIRTHDAY_SPAN_YEARS = 110;

/** Years before today that the empty picker scrolls to — an adult birthday, not this month. */
export const BIRTHDAY_ANCHOR_AGO = 30;

export type BirthdayParts = { year: number; month: number; day: number };

export function isoFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function birthdayIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function birthdayYearRange(today = new Date()): {
  minYear: number;
  maxYear: number;
  anchorYear: number;
} {
  const maxYear = today.getFullYear();
  const minYear = maxYear - BIRTHDAY_SPAN_YEARS;
  return { minYear, maxYear, anchorYear: maxYear - BIRTHDAY_ANCHOR_AGO };
}

/** Decade chips, including a partial first decade when the oldest year is mid-decade. */
export function birthdayDecades(today = new Date()): number[] {
  const { minYear, maxYear } = birthdayYearRange(today);
  const start = Math.floor(minYear / 10) * 10;
  const end = Math.floor(maxYear / 10) * 10;
  const decades: number[] = [];
  for (let year = start; year <= end; year += 10) decades.push(year);
  return decades;
}

export function yearInDecade(decade: number, today = new Date()): number {
  const { minYear, maxYear } = birthdayYearRange(today);
  return Math.min(maxYear, Math.max(decade, minYear));
}

export function isSelectableBirthday(iso: string, today = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const { minYear, maxYear } = birthdayYearRange(today);
  if (year < minYear || year > maxYear || month < 1 || month > 12) return false;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return false;
  return iso <= isoFromDate(today);
}

export function isSelectableMonth(year: number, month: number, today = new Date()): boolean {
  const { minYear, maxYear } = birthdayYearRange(today);
  if (year < minYear || year > maxYear || month < 1 || month > 12) return false;
  if (year < today.getFullYear()) return true;
  if (year > today.getFullYear()) return false;
  return month <= today.getMonth() + 1;
}

export function parseBirthday(iso: string, today = new Date()): BirthdayParts | null {
  if (!isSelectableBirthday(iso, today)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** Monday-first column of the 1st (0 = Monday). */
export function mondayOffset(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
