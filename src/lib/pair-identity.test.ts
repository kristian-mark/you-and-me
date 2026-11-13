import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_ANNIVERSARY,
  DEMO_MY_NAME,
  DEMO_PARTNER_BIRTHDAY,
  DEMO_PARTNER_NAME,
  FALLBACK_MY_NAME,
  FALLBACK_PARTNER_NAME,
  profileName,
  scrubStoredCouple,
  togetherDay,
  anniversaryCountdown,
} from "./pair-identity.ts";

test("a missing profile name falls back to the mailbox, then a neutral word", () => {
  assert.equal(profileName(null, "anya@example.com", FALLBACK_MY_NAME), "anya");
  assert.equal(profileName("  ", null, FALLBACK_MY_NAME), FALLBACK_MY_NAME);
  assert.equal(profileName("Аня", "anya@example.com", FALLBACK_MY_NAME), "Аня");
});

test("a saved display name is kept even when it matches the old demo", () => {
  assert.equal(profileName(DEMO_MY_NAME, "k@example.com", FALLBACK_MY_NAME), DEMO_MY_NAME);
});

test("a saved name beats the mailbox handle, which is only the fallback", () => {
  assert.equal(profileName("Алина", "alinagiljardi", FALLBACK_PARTNER_NAME), "Алина");
  assert.equal(profileName(null, "alinagiljardi", FALLBACK_PARTNER_NAME), "alinagiljardi");
  assert.equal(profileName("Кристианс", "zaluckijm@gmail.com", FALLBACK_MY_NAME), "Кристианс");
});

test("stored demo names and the 2021 anniversary are dropped", () => {
  const clean = scrubStoredCouple({
    myName: DEMO_MY_NAME,
    partnerName: DEMO_PARTNER_NAME,
    anniversaryDate: DEMO_ANNIVERSARY,
    partnerBirthday: DEMO_PARTNER_BIRTHDAY,
    partnerBirthdayEdits: 0,
  });
  assert.equal(clean.myName, FALLBACK_MY_NAME);
  assert.equal(clean.partnerName, FALLBACK_PARTNER_NAME);
  assert.equal(clean.anniversaryDate, "");
  assert.equal(clean.partnerBirthday, "");
});

test("a chosen anniversary wins, otherwise the day the pair connected", () => {
  assert.equal(togetherDay("2024-06-01", "2026-11-01T10:00:00.000Z"), "2024-06-01");
  assert.equal(togetherDay("", "2026-11-08T10:00:00.000Z"), "2026-11-08");
  assert.equal(togetherDay(null, null), null);
});

test("an explicit demo anniversary still counts once it is stored as the choice", () => {
  assert.equal(togetherDay(DEMO_ANNIVERSARY, "2026-11-08T00:00:00.000Z"), DEMO_ANNIVERSARY);
});

test("the day a pair connects counts a full year until the first anniversary", () => {
  const first = anniversaryCountdown("2026-11-08", new Date(2026, 10, 8, 18, 0));
  assert.equal(first.daysTogether, 0);
  assert.equal(first.celebrating, false);
  assert.equal(first.ordinal, 1);
  assert.equal(first.daysUntil, 365);

  const leapStart = anniversaryCountdown("2024-01-01", new Date(2024, 0, 1, 12));
  assert.equal(leapStart.daysUntil, 366);
});

test("a later anniversary day is a celebration, and the days before it count down", () => {
  const today = anniversaryCountdown("2025-11-08", new Date(2026, 10, 8, 9));
  assert.equal(today.celebrating, true);
  assert.equal(today.daysUntil, null);
  assert.equal(today.ordinal, 1);
  assert.equal(today.daysTogether, 365);

  const soon = anniversaryCountdown("2025-11-18", new Date(2026, 10, 8, 9));
  assert.equal(soon.celebrating, false);
  assert.equal(soon.daysUntil, 10);
  assert.equal(soon.ordinal, 1);
});
