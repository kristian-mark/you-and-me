import assert from "node:assert/strict";
import test from "node:test";
import {
  birthdayDecades,
  birthdayYearRange,
  daysInMonth,
  isSelectableBirthday,
  isSelectableMonth,
  mondayOffset,
  parseBirthday,
  yearInDecade,
} from "./birthday.ts";

const today = new Date(2026, 10, 8);

test("empty picker aims at a birthday range, not the current year", () => {
  const range = birthdayYearRange(today);
  assert.equal(range.maxYear, 2026);
  assert.equal(range.minYear, 1916);
  assert.equal(range.anchorYear, 1996);
});

test("future days and impossible dates are not selectable", () => {
  assert.equal(isSelectableBirthday("2026-11-08", today), true);
  assert.equal(isSelectableBirthday("2026-11-09", today), false);
  assert.equal(isSelectableBirthday("2026-12-01", today), false);
  assert.equal(isSelectableBirthday("2027-01-01", today), false);
  assert.equal(isSelectableBirthday("1996-03-14", today), true);
  assert.equal(isSelectableBirthday("2023-02-29", today), false);
  assert.equal(isSelectableBirthday("2024-02-29", today), true);
  assert.equal(isSelectableBirthday("1915-12-31", today), false);
  assert.equal(isSelectableBirthday("1916-01-01", today), true);
  assert.equal(isSelectableBirthday("not-a-date", today), false);
});

test("future months of the current year are closed", () => {
  assert.equal(isSelectableMonth(2026, 11, today), true);
  assert.equal(isSelectableMonth(2026, 12, today), false);
  assert.equal(isSelectableMonth(1996, 12, today), true);
  assert.equal(isSelectableMonth(2027, 1, today), false);
});

test("parseBirthday drops future and invalid values", () => {
  assert.deepEqual(parseBirthday("1996-03-14", today), { year: 1996, month: 3, day: 14 });
  assert.equal(parseBirthday("2026-11-09", today), null);
  assert.equal(parseBirthday("", today), null);
});

test("decades cover the range and snap inside it", () => {
  const decades = birthdayDecades(today);
  assert.equal(decades[0], 1910);
  assert.equal(decades.at(-1), 2020);
  assert.equal(yearInDecade(1910, today), 1916);
  assert.equal(yearInDecade(1990, today), 1990);
  assert.equal(yearInDecade(2020, today), 2020);
});

test("monday offset and month length", () => {
  assert.equal(mondayOffset(1996, 1), 0);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
});
