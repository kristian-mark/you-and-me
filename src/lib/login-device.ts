/** Turn a user-agent into a short label such as «iPhone · Safari». */
export function deviceLabel(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const device = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(ua)
            ? "Mac"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Устройство";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /CriOS|Chrome\//i.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari/i.test(ua)
            ? "Safari"
            : "Браузер";
  return `${device} · ${browser}`;
}

/** First address in x-forwarded-for, otherwise x-real-ip. */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

export function clientPlace(headers: Headers) {
  const rawCity = headers.get("x-vercel-ip-city")?.trim() ?? "";
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
    city = city.trim().slice(0, 80) || null;
  }
  const country = headers.get("x-vercel-ip-country")?.trim().slice(0, 8) || null;
  return { city, country };
}

/** «10 ноября в 15:20» in the given timezone, or the viewer's timezone when omitted. */
export function formatLoginWhen(iso: string, timeZone?: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return `${day} в ${time.replace(/\s/g, "")}`;
}

export function loginBannerText(input: {
  device: string;
  city: string | null;
  country: string | null;
  ip: string | null;
  when: string;
}) {
  const place = input.city || input.country || "";
  const parts = [input.device, place, input.ip ? `IP ${input.ip}` : "", input.when].filter(Boolean);
  return `Вход в аккаунт: ${parts.join(", ")}`;
}
