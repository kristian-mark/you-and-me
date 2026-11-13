import assert from "node:assert/strict";
import test from "node:test";
import {
  dateBounds,
  formatRuDay,
  formatRuNoteStamp,
  isSelectableDate,
  parseIsoDate,
  togetherChoiceLabel,
} from "./dates.ts";

const today = new Date(2026, 10, 13);

test("russian dates stay day-first", () => {
  assert.equal(formatRuDay("2026-11-08", "long"), "8 ноября 2026");
  assert.equal(formatRuDay("2026-11-08", "numeric"), "08.11.2026");
  assert.equal(formatRuDay("2026-05-08", "dayMonth"), "8 мая");
  assert.equal(formatRuDay("2026-11-08", "dayMonthShort"), "8 ноя");
  assert.equal(formatRuDay("2026-02-29", "long"), "");
  assert.equal(formatRuDay("11/08/2026", "long"), "");
  assert.equal(parseIsoDate("2026-11-08T23:00:00Z")?.getDate(), 8);
});

test("an empty together-date stays empty and names the pairing day", () => {
  assert.deepEqual(togetherChoiceLabel("", "2026-11-08T10:00:00.000Z"), {
    value: "не указана",
    hint: "считаем с 8 ноября 2026",
  });
  assert.deepEqual(togetherChoiceLabel("2020-03-01", "2026-11-08"), {
    value: "1 марта 2020",
    hint: "",
  });
  assert.deepEqual(togetherChoiceLabel("", ""), { value: "не указана", hint: "" });
});

test("note stamps use the same month names", () => {
  assert.equal(formatRuNoteStamp("2026-11-13T15:20:00", today), "сегодня, 15:20");
  assert.equal(formatRuNoteStamp("2026-11-08T15:20:00", today), "8 ноября, 15:20");
});

test("future and past spans stop at today", () => {
  assert.equal(isSelectableDate("2026-11-13", "untilToday", today), true);
  assert.equal(isSelectableDate("2026-11-14", "untilToday", today), false);
  assert.equal(isSelectableDate("2026-11-12", "fromToday", today), false);
  assert.equal(isSelectableDate("2026-11-13", "fromToday", today), true);
  assert.equal(isSelectableDate("2056-11-13", "any", today), true);
  assert.equal(dateBounds("untilToday", today).maxIso, "2026-11-13");
  assert.equal(dateBounds("fromToday", today).minIso, "2026-11-13");
});
