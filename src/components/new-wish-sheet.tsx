import { useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Search } from "lucide-react";
import { compressPhotoFile } from "@/lib/compress-photo";
import { useCouple, viewedWishOwner, type Wish, type WishPriority } from "@/lib/couple-store";
import { packWish, savePairWish } from "@/lib/pair-wishes";

const POPULAR = [
  { code: "RUB", name: "Российский рубль", symbol: "₽" },
  { code: "USD", name: "Доллар США", symbol: "$" },
  { code: "EUR", name: "Евро", symbol: "€" },
  { code: "KZT", name: "Казахстанский тенге", symbol: "₸" },
];

const ALL = [
  ...POPULAR,
  { code: "AFN", name: "Афганский афгани", symbol: "؋" },
  { code: "ALL", name: "Албанский лек", symbol: "L" },
  { code: "DZD", name: "Алжирский динар", symbol: "د.ج" },
  { code: "AOA", name: "Ангольская кванза", symbol: "Kz" },
  { code: "ARS", name: "Аргентинское песо", symbol: "$" },
  { code: "AMD", name: "Армянский драм", symbol: "֏" },
  { code: "AWG", name: "Арубанский флорин", symbol: "ƒ" },
  { code: "AUD", name: "Австралийский доллар", symbol: "A$" },
  { code: "AZN", name: "Азербайджанский манат", symbol: "₼" },
  { code: "BYN", name: "Белорусский рубль", symbol: "Br" },
  { code: "BRL", name: "Бразильский реал", symbol: "R$" },
  { code: "GBP", name: "Фунт стерлингов", symbol: "£" },
  { code: "BGN", name: "Болгарский лев", symbol: "лв" },
  { code: "CAD", name: "Канадский доллар", symbol: "C$" },
  { code: "CNY", name: "Китайский юань", symbol: "¥" },
  { code: "CZK", name: "Чешская крона", symbol: "Kč" },
  { code: "DKK", name: "Датская крона", symbol: "kr" },
  { code: "GEL", name: "Грузинский лари", symbol: "₾" },
  { code: "HKD", name: "Гонконгский доллар", symbol: "HK$" },
  { code: "HUF", name: "Венгерский форинт", symbol: "Ft" },
  { code: "INR", name: "Индийская рупия", symbol: "₹" },
  { code: "IDR", name: "Индонезийская рупия", symbol: "Rp" },
  { code: "ILS", name: "Израильский шекель", symbol: "₪" },
  { code: "JPY", name: "Японская иена", symbol: "¥" },
  { code: "KRW", name: "Южнокорейская вона", symbol: "₩" },
  { code: "KGS", name: "Киргизский сом", symbol: "сом" },
  { code: "MDL", name: "Молдавский лей", symbol: "L" },
  { code: "MXN", name: "Мексиканское песо", symbol: "MX$" },
  { code: "NOK", name: "Норвежская крона", symbol: "kr" },
  { code: "PLN", name: "Польский злотый", symbol: "zł" },
  { code: "RON", name: "Румынский лей", symbol: "lei" },
  { code: "SAR", name: "Саудовский риял", symbol: "﷼" },
  { code: "SGD", name: "Сингапурский доллар", symbol: "S$" },
  { code: "SEK", name: "Шведская крона", symbol: "kr" },
  { code: "CHF", name: "Швейцарский франк", symbol: "Fr" },
  { code: "THB", name: "Тайский бат", symbol: "฿" },
  { code: "TRY", name: "Турецкая лира", symbol: "₺" },
  { code: "UAH", name: "Украинская гривна", symbol: "₴" },
  { code: "AED", name: "Дирхам ОАЭ", symbol: "د.إ" },
  { code: "UZS", name: "Узбекский сум", symbol: "soʻm" },
  { code: "VND", name: "Вьетнамский донг", symbol: "₫" },
];

function currencyOf(code: string) {
  return ALL.find((c) => c.code === code) ?? POPULAR[0];
}

async function readPhoto(file: File) {
  return compressPhotoFile(file);
}

export function NewWishSheet({ wish, onClose }: { wish?: Wish; onClose: () => void }) {
  const addWish = useCouple((s) => s.addWish);
  const updateWish = useCouple((s) => s.updateWish);
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const photoRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState(wish?.link ?? "");
  const [photo, setPhoto] = useState(wish?.photo ?? "");
  const [title, setTitle] = useState(wish?.title ?? "");
  const [price, setPrice] = useState(wish?.price ?? "");
  const [currency, setCurrency] = useState(wish?.currency ?? "RUB");
  const [priority, setPriority] = useState<WishPriority>(wish?.priority ?? "want");
  const [note, setNote] = useState(wish?.note ?? "");
  const [forMe, setForMe] = useState(wish ? viewedWishOwner(wish, myUserId) === "me" : true);
  const [pickCurrency, setPickCurrency] = useState(false);
  const [pickPriority, setPickPriority] = useState(false);

  const save = () => {
    const name = title.trim() || link.trim() || "Хотелка";
    const payload = {
      title: name,
      link: link.trim(),
      photo,
      price: price.trim(),
      currency,
      priority,
      note: note.trim(),
      owner: forMe ? ("me" as const) : ("partner" as const),
    };
    if (wish) updateWish(wish.id, payload);
    else addWish(payload);
    const latest = useCouple.getState().wishes[0];
    const stored = wish ? useCouple.getState().wishes.find((w) => w.id === wish.id) : latest;
    if (stored) void savePairWish({ data: packWish(stored) }).catch(() => undefined);
    onClose();
  };

  const cur = currencyOf(currency);

  if (pickCurrency) {
    return (
      <CurrencyPicker
        value={currency}
        onPick={(code) => {
          setCurrency(code);
          setPickCurrency(false);
        }}
        onClose={() => setPickCurrency(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-5 pb-3">
          <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-muted">
            Отмена
          </button>
          <h2 className="whitespace-nowrap text-center text-[17px] font-semibold">
            {wish ? "Изменить" : "Новая хотелка"}
          </h2>
          <button type="button" onClick={save} className="justify-self-end text-[17px]">
            Готово
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">ССЫЛКА</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>

          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-2xl bg-raised px-4 py-3 text-left"
          >
            {photo ? (
              <img src={photo} alt="" className="size-14 rounded-xl object-cover" />
            ) : (
              <span className="size-14 rounded-xl bg-[repeating-linear-gradient(-45deg,#2a2a2e,#2a2a2e_6px,#1e1e20_6px,#1e1e20_12px)]" />
            )}
            <span className="text-[15px] leading-snug text-muted">
              Фото вещи — нажмите, чтобы выбрать из галереи
            </span>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhoto(await readPhoto(file));
              }}
            />
          </button>

          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">НАЗВАНИЕ</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что это"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="rounded-2xl bg-raised px-4 py-3">
              <span className="text-[11px] tracking-wider text-muted">ЦЕНА</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="—"
                inputMode="decimal"
                className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
              />
            </label>
            <button
              type="button"
              onClick={() => setPickCurrency(true)}
              className="min-w-[118px] rounded-2xl bg-raised px-4 py-3 text-left"
            >
              <span className="text-[11px] tracking-wider text-muted">ВАЛЮТА</span>
              <p className="mt-1 text-[17px] font-semibold">
                {cur.code} <span className="font-normal text-muted">{cur.symbol}</span>
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPickPriority(true)}
            className="block w-full rounded-2xl bg-raised px-4 py-3 text-left"
          >
            <span className="text-[11px] tracking-wider text-muted">ПРИОРИТЕТ</span>
            <p className="mt-1 text-[17px] font-semibold">
              {priority === "really" ? "Очень хочу" : "Хочу"}
            </p>
          </button>

          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">ЗАМЕТКА</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Размер, цвет, где видели…"
              rows={3}
              className="mt-1 w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-muted"
            />
          </label>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-raised px-4 py-4">
            <div>
              <p className="text-[16px] font-medium">Это хотелка для меня</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                выключите, если добавляете для {partnerName}
              </p>
            </div>
            <Switch on={forMe} onChange={setForMe} />
          </div>
        </div>
      </div>

      {pickPriority ? (
        <button
          type="button"
          className="absolute inset-0 z-10 bg-black/40"
          onClick={() => setPickPriority(false)}
        >
          <div className="absolute top-1/2 left-1/2 w-56 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-chip py-2 text-left shadow-2xl">
            {(
              [
                ["want", "Хочу"],
                ["really", "Очень хочу"],
              ] as const
            ).map(([id, label]) => (
              <span
                key={id}
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPriority(id);
                  setPickPriority(false);
                }}
                className="block w-full px-5 py-3 text-[17px]"
              >
                {label}
              </span>
            ))}
          </div>
        </button>
      ) : null}
    </div>
  );
}

function CurrencyPicker({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      ALL.filter(
        (c) =>
          !query ||
          c.code.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          c.symbol.toLowerCase().includes(query),
      ),
    [query],
  );
  const popular = POPULAR.filter(
    (c) =>
      !query ||
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query),
  );

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col px-5">
        <button
          type="button"
          onClick={onClose}
          className="mt-5 grid size-11 place-items-center rounded-full bg-raised"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="mt-6 flex items-end justify-between">
          <h2 className="text-[32px] font-semibold">Валюта</h2>
          <button type="button" onClick={onClose} className="pb-1 text-[17px] text-blue">
            Готово
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-2xl bg-raised px-4 py-3">
          <Search className="size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Название или код"
            className="w-full bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <div className="mt-5 flex-1 overflow-y-auto pb-10">
          {popular.length ? (
            <>
              <p className="mb-2 text-[11px] tracking-widest text-muted">ПОПУЛЯРНЫЕ</p>
              {popular.map((c) => (
                <CurrencyRow key={c.code} item={c} active={c.code === value} onPick={onPick} />
              ))}
            </>
          ) : null}
          <p className="mt-6 mb-2 text-[11px] tracking-widest text-muted">ВСЕ ВАЛЮТЫ</p>
          {filtered.map((c) => (
            <CurrencyRow key={`all-${c.code}`} item={c} active={c.code === value} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrencyRow({
  item,
  active,
  onPick,
}: {
  item: (typeof ALL)[number];
  active: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.code)}
      className="flex w-full items-center gap-4 py-3 text-left"
    >
      <span className="w-8 text-[18px] text-muted">{item.symbol}</span>
      <span className="flex-1 text-[16px]">{item.name}</span>
      <span className="text-[14px] text-muted">{item.code}</span>
      {active ? <Check className="size-4 text-blue" /> : <span className="w-4" />}
    </button>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full ${on ? "bg-blue" : "bg-chip"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-fg ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}
