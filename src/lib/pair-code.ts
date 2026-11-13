const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The short code a partner types. Pair ids are UUIDs and are not codes.
 * Returns the uppercase code, or "" when there is nothing to show.
 */
export function formatPairCode(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text || UUID.test(text)) return "";
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 4 || clean.length > 12) return "";
  return clean;
}
