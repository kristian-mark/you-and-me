import { useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { Cake, Gift } from "lucide-react";
import { useCouple, type Wish } from "@/lib/couple-store";

function nextBirthday(iso: string, from = new Date()) {
  const src = new Date(iso);
  const month = src.getMonth();
  const day = src.getDate();
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(from.getFullYear(), month, day);
  if (next < start) next = new Date(from.getFullYear() + 1, month, day);
  return next;
}

function daysWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function formatWishPrice(price: string, currency?: string) {
  const num = price.replace(/\s/g, "");
  const pretty = Number.isFinite(Number(num))
    ? Number(num).toLocaleString("ru-RU")
    : price;
  const code = currency || "";
  const symbol =
    code === "RUB" ? "₽" : code === "USD" ? "$" : code === "EUR" ? "€" : code === "KZT" ? "₸" : code;
  return `${pretty} ${symbol}`.trim();
}

export function GiftRadarScreen({ onBack }: { onBack: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  const partnerBirthday = useCouple((s) => s.partnerBirthday);
  const wishes = useCouple((s) => s.wishes);
  const setTab = useCouple((s) => s.setTab);
  const setWishFilter = useCouple((s) => s.setWishFilter);
  const [open, setOpen] = useState<Wish | null>(null);

  const list = wishes.filter((w) => w.owner === "partner" && !w.fulfilled);
  const hasDate = Boolean(partnerBirthday);
  const next = hasDate ? nextBirthday(partnerBirthday) : null;
  const days = next ? differenceInCalendarDays(next, new Date()) : null;

  if (open) {
    return (
      <RadarWishCard
        wish={open}
        partnerName={partnerName}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>

      <div className="mt-5 rounded-[32px] bg-[#f3a0c4] px-5 pb-6 pt-5 text-[#1a1216]">
        <div className="flex items-start justify-between">
          <Cake className="size-10" strokeWidth={1.6} />
          <span className="rounded-full bg-[#7a2048] px-3 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#f7c2d8]">
            ВИДИШЬ ТОЛЬКО ТЫ
          </span>
        </div>
        <p className="mt-8 text-[72px] leading-none font-semibold tracking-tight">
          {days === null ? "—" : days}
        </p>
        <p className="mt-4 text-[28px] leading-8 font-semibold">
          {days === 0
            ? `сегодня день рождения ${partnerName}`
            : `${daysWord(days ?? 0)} до дня рождения ${partnerName}`}
        </p>
        <p className="mt-3 text-[15px] text-[#5c3344]">
          {hasDate && next
            ? `${format(next, "d MMMM", { locale: ru })} · ${
                list.length === 0 ? "список желаний пуст" : `${list.length} в списке`
              }`
            : "дата рождения ещё не указана"}
        </p>
      </div>

      <p className="mt-8 text-[12px] tracking-[0.14em] text-muted uppercase">Что в списке</p>

      {list.length === 0 ? (
        <div className="mt-3 rounded-[22px] bg-raised px-5 py-5 text-[16px] leading-6 text-muted">
          Список {partnerName} пуст. Подарок придётся придумать самому.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((wish) => (
            <li key={wish.id}>
              <button
                type="button"
                onClick={() => setOpen(wish)}
                className="flex w-full items-center gap-3 rounded-[22px] bg-raised p-3 text-left"
              >
                {wish.photo ? (
                  <img src={wish.photo} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-chip text-muted">
                    <Gift className="size-6" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{wish.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {wish.price ? formatWishPrice(wish.price, wish.currency) : "без цены"}
                    {wish.priority === "really" ? " · очень хочет" : " · хочет"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-[22px] bg-[#15202b] px-5 py-5 text-[15px] leading-6 text-[#9aa8b5]">
        Радар виден только тебе. Когда придёт время, {partnerName} получит такой же про твой день
        рождения.
      </div>

      <button
        type="button"
        onClick={() => {
          setWishFilter("partner");
          setTab("wishes");
        }}
        className="mt-4 w-full py-3 text-sm text-muted"
      >
        Открыть хотелки {partnerName}
      </button>
    </section>
  );
}

function RadarWishCard({
  wish,
  partnerName,
  onBack,
}: {
  wish: Wish;
  partnerName: string;
  onBack: () => void;
}) {
  const href = wish.link
    ? wish.link.startsWith("http")
      ? wish.link
      : `https://${wish.link}`
    : "";
  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Радар
      </button>
      <div className="mt-6 overflow-hidden rounded-[28px] bg-raised">
        {wish.photo ? (
          <img src={wish.photo} alt="" className="h-48 w-full object-cover" />
        ) : (
          <div className="grid h-40 place-items-center text-muted">
            <Gift className="size-12" />
          </div>
        )}
        <div className="px-5 py-5">
          <p className="text-xs text-muted">хотелка {partnerName}</p>
          <h2 className="mt-1 text-[28px] font-semibold">{wish.title}</h2>
          {wish.price ? (
            <p className="mt-2 text-muted">{formatWishPrice(wish.price, wish.currency)}</p>
          ) : null}
          {wish.note ? <p className="mt-3 text-[15px] text-muted">{wish.note}</p> : null}
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="mt-4 block text-blue">
              {wish.link}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
