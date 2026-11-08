export const DEMO_MY_NAME = "Кристианс";
export const DEMO_PARTNER_NAME = "Алиночка";
export const DEMO_ANNIVERSARY = "2021-03-24";
export const DEMO_PARTNER_BIRTHDAY = "2000-03-29";
export const FALLBACK_MY_NAME = "Ты";
export const FALLBACK_PARTNER_NAME = "Партнёр";

const DEMO_NAMES = new Set([DEMO_MY_NAME, DEMO_PARTNER_NAME]);

export function emailLocal(email: string | null | undefined) {
  const local = email?.split("@")[0]?.trim();
  return local || null;
}

/** Server display name, otherwise the mailbox name, otherwise a neutral fallback. */
export function profileName(
  displayName: string | null | undefined,
  email: string | null | undefined,
  fallback: string,
) {
  const name = displayName?.trim();
  if (name) return name;
  return emailLocal(email) ?? fallback;
}

export function isoDay(value: string | null | undefined) {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * A date the couple actually chose, otherwise the day they connected.
 * An empty choice does not invent 2021.
 */
export function togetherDay(chosen: string | null | undefined, pairedAt: string | null | undefined) {
  return isoDay(chosen) ?? isoDay(pairedAt);
}

export function scrubStoredCouple(raw: {
  myName?: string;
  partnerName?: string;
  anniversaryDate?: string;
  partnerBirthday?: string;
  partnerBirthdayEdits?: number;
}) {
  return {
    myName: raw.myName && !DEMO_NAMES.has(raw.myName) ? raw.myName : FALLBACK_MY_NAME,
    partnerName: raw.partnerName && !DEMO_NAMES.has(raw.partnerName) ? raw.partnerName : FALLBACK_PARTNER_NAME,
    anniversaryDate: raw.anniversaryDate === DEMO_ANNIVERSARY ? "" : (raw.anniversaryDate ?? ""),
    partnerBirthday:
      raw.partnerBirthday === DEMO_PARTNER_BIRTHDAY && !raw.partnerBirthdayEdits
        ? ""
        : (raw.partnerBirthday ?? ""),
  };
}
