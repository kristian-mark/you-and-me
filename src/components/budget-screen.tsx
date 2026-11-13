import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Baby,
  Banknote,
  Briefcase,
  Building2,
  Bus,
  Car,
  Coins,
  Coffee,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Leaf,
  Minus,
  MoreHorizontal,
  Music,
  PawPrint,
  Plane,
  Plus,
  RefreshCw,
  ScanLine,
  Shirt,
  ShoppingCart,
  Sofa,
  Tag,
  Theater,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wine,
  Dumbbell,
  PartyPopper,
} from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { SheetHeader } from "@/components/sheet-header";
import { UsBadge } from "@/components/ui/shell";
import { useCouple, usePlayerColors, type BudgetAccount, type BudgetCategory, type BudgetTx, type RecurringPayment } from "@/lib/couple-store";
import { formatRuDay, formatRuWeekdayShort, toIsoDate } from "@/lib/dates";
import { pieceBg, pieceRing } from "@/lib/pair-color";

const MONTHS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const MONTHS_EN = ["D","J","F","M","A","M","J","J","A","S","O","N"];

const CURRENCIES = [
  { code: "RUB", symbol: "₽", name: "Российский рубль" },
  { code: "USD", symbol: "$", name: "Доллар США" },
  { code: "EUR", symbol: "€", name: "Евро" },
  { code: "KZT", symbol: "₸", name: "Казахстанский тенге" },
  { code: "GBP", symbol: "£", name: "Фунт стерлингов" },
  { code: "AFN", symbol: "؋", name: "Афганский афгани" },
  { code: "ALL", symbol: "L", name: "Албанский лек" },
  { code: "DZD", symbol: "د.ج", name: "Алжирский динар" },
  { code: "AOA", symbol: "Kz", name: "Ангольская кванза" },
  { code: "ARS", symbol: "$", name: "Аргентинское песо" },
  { code: "AMD", symbol: "֏", name: "Армянский драм" },
  { code: "AWG", symbol: "ƒ", name: "Арубанский флорин" },
  { code: "AUD", symbol: "A$", name: "Австралийский доллар" },
  { code: "AZN", symbol: "₼", name: "Азербайджанский манат" },
  { code: "BYN", symbol: "Br", name: "Белорусский рубль" },
  { code: "BRL", symbol: "R$", name: "Бразильский реал" },
  { code: "BGN", symbol: "лв", name: "Болгарский лев" },
  { code: "CAD", symbol: "C$", name: "Канадский доллар" },
  { code: "CNY", symbol: "¥", name: "Китайский юань" },
  { code: "CZK", symbol: "Kč", name: "Чешская крона" },
  { code: "DKK", symbol: "kr", name: "Датская крона" },
  { code: "GEL", symbol: "₾", name: "Грузинский лари" },
  { code: "HKD", symbol: "HK$", name: "Гонконгский доллар" },
  { code: "HUF", symbol: "Ft", name: "Венгерский форинт" },
  { code: "INR", symbol: "₹", name: "Индийская рупия" },
  { code: "IDR", symbol: "Rp", name: "Индонезийская рупия" },
  { code: "ILS", symbol: "₪", name: "Израильский шекель" },
  { code: "JPY", symbol: "¥", name: "Японская иена" },
  { code: "KRW", symbol: "₩", name: "Южнокорейская вона" },
  { code: "MXN", symbol: "$", name: "Мексиканское песо" },
  { code: "MDL", symbol: "L", name: "Молдавский лей" },
  { code: "NOK", symbol: "kr", name: "Норвежская крона" },
  { code: "PLN", symbol: "zł", name: "Польский злотый" },
  { code: "RON", symbol: "lei", name: "Румынский лей" },
  { code: "SAR", symbol: "﷼", name: "Саудовский риял" },
  { code: "SGD", symbol: "S$", name: "Сингапурский доллар" },
  { code: "SEK", symbol: "kr", name: "Шведская крона" },
  { code: "CHF", symbol: "Fr", name: "Швейцарский франк" },
  { code: "TRY", symbol: "₺", name: "Турецкая лира" },
  { code: "UAH", symbol: "₴", name: "Украинская гривна" },
  { code: "AED", symbol: "د.إ", name: "Дирхам ОАЭ" },
  { code: "UZS", symbol: "so'm", name: "Узбекский сум" },
];

const POPULAR = ["RUB", "USD", "EUR", "KZT"];

const TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  RUB: 608.73 / 50000,
  KZT: 0.0019,
  AUD: 0.65,
  CAD: 0.72,
  CNY: 0.14,
  JPY: 0.0065,
  CHF: 1.12,
  TRY: 0.03,
  UAH: 0.024,
  PLN: 0.25,
  GEL: 0.37,
  BYN: 0.3,
  INR: 0.012,
  AED: 0.27,
  SEK: 0.094,
  NOK: 0.09,
  CZK: 0.043,
  HUF: 0.0027,
  KRW: 0.00072,
  BRL: 0.19,
  MXN: 0.055,
};

const ICONS: Record<string, typeof ShoppingCart> = {
  cart: ShoppingCart,
  utensils: UtensilsCrossed,
  house: Home,
  bus: Bus,
  health: HeartPulse,
  shirt: Shirt,
  theater: Theater,
  gift: Gift,
  wifi: Wifi,
  sofa: Sofa,
  baby: Baby,
  paw: PawPrint,
  more: MoreHorizontal,
  plus: Plus,
  dumbbell: Dumbbell,
  game: Gamepad2,
  grad: GraduationCap,
  plane: Plane,
  fuel: Fuel,
  leaf: Leaf,
  wine: Wine,
  hammer: Hammer,
  party: PartyPopper,
  music: Music,
  coffee: Coffee,
  car: Car,
  banknote: Banknote,
  coins: Coins,
  case: Briefcase,
  landmark: Landmark,
  refresh: RefreshCw,
  tag: Tag,
  heart: Heart,
  building: Building2,
  wallet: Wallet,
};

const EXPENSE_ICONS = ["dumbbell","game","grad","plane","fuel","leaf","wine","hammer","party","music","coffee","car"];
const INCOME_ICONS = ["banknote","coins","case","gift","landmark","refresh","tag","heart","building","grad","more"];
const PALETTE = ["#b5b56a","#6bcf8a","#2dd4c0","#5ba3f5","#9b8cff","#d4a0e8","#f0a0c0","#f0a080","#e8b84a"];

const BUILTIN: BudgetCategory[] = [
  { id: "groceries", title: "Продукты", kind: "expense", icon: "cart", color: "#2f4a33" },
  { id: "cafes", title: "Кафе", kind: "expense", icon: "utensils", color: "#4a3a28" },
  { id: "housing", title: "Жильё", kind: "expense", icon: "house", color: "#3a3358" },
  { id: "transport", title: "Транспорт", kind: "expense", icon: "bus", color: "#1d3f42" },
  { id: "health", title: "Здоровье", kind: "expense", icon: "health", color: "#4a2d40" },
  { id: "clothes", title: "Одежда", kind: "expense", icon: "shirt", color: "#3a2d4a" },
  { id: "fun", title: "Развлечения", kind: "expense", icon: "theater", color: "#4a3328" },
  { id: "gifts", title: "Подарки", kind: "expense", icon: "gift", color: "#3d2a32" },
  { id: "phone", title: "Связь", kind: "expense", icon: "wifi", color: "#16384a" },
  { id: "home", title: "Дом", kind: "expense", icon: "sofa", color: "#3a3a24" },
  { id: "pets", title: "Питомцы", kind: "expense", icon: "paw", color: "#3a2e24" },
  { id: "kids", title: "Дети", kind: "expense", icon: "baby", color: "#1d3d32" },
  { id: "other", title: "Другое", kind: "expense", icon: "more", color: "#2a2d36" },
  { id: "salary", title: "Зарплата", kind: "income", icon: "banknote", color: "#1d3a28" },
  { id: "advance", title: "Аванс", kind: "income", icon: "coins", color: "#3a3a24" },
  { id: "side", title: "Подработка", kind: "income", icon: "case", color: "#1d3d36" },
  { id: "in-gifts", title: "Подарки", kind: "income", icon: "gift", color: "#3d2a32" },
  { id: "in-other", title: "Другое", kind: "income", icon: "more", color: "#2a2d36" },
];

function toMain(amount: number, from: string, main: string) {
  return (amount * (TO_USD[from] ?? 1)) / (TO_USD[main] ?? 1);
}

function money(amount: number, code: string) {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
  const n = Math.abs(amount);
  const body = n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  if (code === "USD") return `$${body}`;
  if (code === "RUB") return `₽ ${body}`;
  return `${symbol}${body}`;
}

const ACCENT: Record<string, string> = {
  groceries: "#7dcc6e",
  cafes: "#e0b15a",
  housing: "#a78bfa",
  transport: "#2dd4c0",
  health: "#f472b6",
  clothes: "#c084fc",
  fun: "#fb923c",
  gifts: "#f9a8d4",
  phone: "#38bdf8",
  home: "#f5d76e",
  pets: "#e8a06a",
  kids: "#34d399",
  other: "#94a3b8",
  salary: "#4ade80",
  advance: "#facc15",
  side: "#2dd4bf",
  "in-gifts": "#f9a8d4",
  "in-other": "#94a3b8",
};

function hexToRgb(hex: string) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return { r: 167, g: 139, b: 250 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function vivid(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const ns = Math.max(0.55, Math.min(0.78, s * 1.8 || 0.62));
  const nl = 0.62;
  const c = (1 - Math.abs(2 * nl - 1)) * ns;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return `rgb(${to(rp)}, ${to(gp)}, ${to(bp)})`;
}

function sliceColor(id: string, hex?: string) {
  return ACCENT[id] ?? vivid(hex ?? "#7c6af5");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(iso: string) {
  if (iso === todayIso()) return "сегодня";
  return formatRuDay(iso, "dayMonthShort");
}

function formatWhen(iso: string) {
  return formatRuDay(iso, "dayMonth");
}

export function BudgetScreen({ onBack }: { onBack: () => void }) {
  const budget = useCouple((s) => s.budget);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const [alert, setAlert] = useState<(typeof budget.alerts)[number][]>([]);
  const [view, setView] = useState<"home" | "tx" | "custom" | "analytics" | "settings" | "all">("home");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [txKind, setTxKind] = useState<"expense" | "income">("expense");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [draft, setDraft] = useState({
    amount: "",
    currency: budget.currency,
    categoryId: "",
    date: todayIso(),
    paidBy: "me" as "me" | "partner",
    note: "",
  });
  const [custom, setCustom] = useState({
    title: "Зал",
    kind: "expense" as "expense" | "income",
    icon: "dumbbell",
    color: PALETTE[0],
    hidden: false,
  });

  useEffect(() => {
    const fresh = (budget.alerts ?? []).filter((a) => Date.now() - new Date(a.at).getTime() < 8000);
    if (!fresh.length) return;
    setAlert(fresh.slice(0, 2));
    const t = window.setTimeout(() => setAlert([]), 6000);
    return () => window.clearTimeout(t);
  }, [budget.alerts]);

  const cats = useMemo(() => {
    const extra = budget.categories;
    const overlay = new Map(extra.map((c) => [c.id, c]));
    return [...BUILTIN.map((c) => overlay.get(c.id) ?? c), ...extra.filter((c) => !BUILTIN.some((b) => b.id === c.id))];
  }, [budget.categories]);

  const monthTx = budget.txs.filter((t) => t.date.startsWith(month));
  const spent = monthTx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + toMain(t.amount, t.currency, budget.currency), 0);

  if (view === "tx") {
    return (
      <TxForm
        kind={txKind}
        draft={draft}
        cats={cats.filter((c) => c.kind === txKind && !c.hidden)}
        main={budget.currency}
        myName={myName}
        partnerName={partnerName}
        onChange={setDraft}
        onCancel={() => setView("home")}
        onCustom={() => setView("custom")}
        onSave={() => {
          const amount = Number(draft.amount.replace(",", "."));
          if (!amount || !draft.categoryId) return;
          useCouple.getState().addBudgetTx({
            kind: txKind,
            amount,
            currency: draft.currency,
            categoryId: draft.categoryId,
            date: draft.date,
            paidBy: draft.paidBy,
            note: draft.note.trim(),
          });
          setView("home");
        }}
      />
    );
  }

  if (view === "custom") {
    return (
      <CustomCategory
        value={custom}
        onChange={setCustom}
        onCancel={() => setView("tx")}
        onSave={() => {
          const id = useCouple.getState().addBudgetCategory(custom);
          setDraft((d) => ({ ...d, categoryId: id }));
          setView("tx");
        }}
      />
    );
  }

  if (view === "all") {
    return (
      <AllTxs
        txs={[...budget.txs].sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.createdAt.localeCompare(a.createdAt);
        })}
        cats={cats}
        main={budget.currency}
        onBack={() => setView("home")}
      />
    );
  }
  if (view === "analytics") {
    return (
      <Analytics
        month={month}
        setMonth={setMonth}
        txs={budget.txs}
        cats={cats}
        main={budget.currency}
        myName={myName}
        partnerName={partnerName}
        onBack={() => setView("home")}
      />
    );
  }

  if (view === "settings") {
    return (
      <Settings
        currency={budget.currency}
        cats={cats}
        txs={budget.txs}
        monthLimit={budget.monthLimit ?? null}
        monthLimitFrom={budget.monthLimitFrom ?? null}
        catLimits={budget.catLimits ?? {}}
        accounts={budget.accounts}
        myName={myName}
        partnerName={partnerName}
        onBack={() => setView("home")}
        onCurrency={(code) => useCouple.getState().setBudgetCurrency(code)}
      />
    );
  }

  if (openCat) {
    const cat = cats.find((c) => c.id === openCat);
    const [y, m] = month.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const items = monthTx.filter((t) => t.kind === "expense" && t.categoryId === openCat);
    const total = items.reduce((s, t) => s + toMain(t.amount, t.currency, budget.currency), 0);
    const prevSum = budget.txs
      .filter((t) => t.kind === "expense" && t.categoryId === openCat && t.date.startsWith(prevKey))
      .reduce((s, t) => s + toMain(t.amount, t.currency, budget.currency), 0);
    return (
      <CategorySpends
        catId={openCat}
        title={cat?.title ?? "Категория"}
        color={cat?.color ?? "#2a2d36"}
        accent={sliceColor(openCat, cat?.color)}
        icon={cat?.icon ?? "more"}
        items={items}
        total={total}
        prevSum={prevSum}
        prevLabel={MONTHS[prev.getMonth()]}
        main={budget.currency}
        monthLabel={MONTHS[m - 1]}
        onBack={() => setOpenCat(null)}
      />
    );
  }

  const empty = budget.txs.length === 0;
  const byCat = new Map<string, number>();
  monthTx
    .filter((t) => t.kind === "expense")
    .forEach((t) => {
      byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + toMain(t.amount, t.currency, budget.currency));
    });

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      {alert.length ? (
        <div className="fixed left-3 right-3 top-3 z-50 space-y-2">
          {alert.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-[22px] bg-[#2a2d36] px-3 py-2.5 shadow-lg">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black text-[10px] font-semibold leading-3">
                <span className="text-blue">You</span>
                <span className="text-pink">&Me</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{row.title}</span>
                <span className="block truncate text-[13px] text-muted">{row.body}</span>
              </span>
              <span className="text-[12px] text-muted">сейчас</span>
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mt-5 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-[30px] font-semibold tracking-tight sm:text-[34px]">Бюджет</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTxKind("expense");
              setDraft({
                amount: "",
                currency: budget.currency,
                categoryId: "",
                date: todayIso(),
                paidBy: "me",
                note: "",
              });
              setView("tx");
            }}
            className="grid size-11 place-items-center rounded-2xl bg-raised"
          >
            <Plus className="size-5" />
          </button>
          <UsBadge />
        </div>
      </div>

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-2 pb-8 text-center">
          <Wallet className="mb-6 size-14 text-muted" strokeWidth={1.4} />
          <h2 className="text-[26px] font-semibold leading-8">Куда уходят деньги каждый месяц?</h2>
          <p className="mt-3 max-w-[300px] text-[15px] leading-5 text-muted">
            Добавь расходы и доходы — итоги за месяц сложатся сами. Счета и лимиты по желанию.
          </p>
          <button
            type="button"
            onClick={() => {
              setTxKind("expense");
              setView("tx");
            }}
            className="mt-8 w-full rounded-full bg-white py-4 text-[17px] font-semibold text-black"
          >
            Добавить первый расход
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              const title = window.prompt("Название счёта");
              if (title) useCouple.getState().addBudgetAccount(title);
            }}
            className="mt-4 flex items-center gap-3 rounded-[22px] border border-dashed border-line px-4 py-3 text-left"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-raised">
              <Plus className="size-4" />
            </span>
            <span>
              <span className="block text-[16px]">Счёт</span>
              <span className="text-[13px] text-muted">карта, нал, вклад — по желанию</span>
            </span>
          </button>
          {budget.accounts.map((a) => (
            <div key={a.id} className="mt-2 rounded-[18px] bg-raised px-4 py-3">
              {a.title}
            </div>
          ))}

          <div className="mt-6 flex justify-between px-2">
            <Action
              icon={<Minus className="size-5" />}
              label="Расход"
              onClick={() => {
                setTxKind("expense");
                setDraft({
                  amount: "",
                  currency: budget.currency,
                  categoryId: "",
                  date: todayIso(),
                  paidBy: "me",
                  note: "",
                });
                setView("tx");
              }}
            />
            <Action
              icon={<Plus className="size-5" />}
              label="Доход"
              onClick={() => {
                setTxKind("income");
                setDraft({
                  amount: "",
                  currency: budget.currency,
                  categoryId: "salary",
                  date: todayIso(),
                  paidBy: "me",
                  note: "",
                });
                setView("tx");
              }}
            />
            <Action
              icon={<ScanLine className="size-5" />}
              label="Чек"
              onClick={() => {
                setTxKind("expense");
                setView("tx");
              }}
            />
          </div>

          {budget.monthLimit ? (
            <div className="mt-8">
              <p className="text-[16px] text-muted">
                Осталось потратить в {MONTHS[Number(month.slice(5)) - 1]}
              </p>
              <p className="mt-1 text-[44px] font-semibold tracking-tight">
                {money(Math.max(0, budget.monthLimit - spent), budget.currency)}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#2a2d36]">
                <div
                  className={`h-full rounded-full ${spent > budget.monthLimit ? "bg-[#f07167]" : "bg-green"}`}
                  style={{ width: `${Math.min(100, Math.round((spent / budget.monthLimit) * 100))}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px] text-muted">
                <span>потрачено {money(spent, budget.currency)}</span>
                <span>из {money(budget.monthLimit, budget.currency)}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-8 text-[16px] text-muted">Потрачено в {MONTHS[Number(month.slice(5)) - 1]}</p>
              <p className="mt-1 text-[44px] font-semibold tracking-tight">{money(spent, budget.currency)}</p>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {[...byCat.entries()].map(([id, sum]) => {
              const cat = cats.find((c) => c.id === id);
              const Icon = ICONS[cat?.icon ?? "more"] ?? MoreHorizontal;
              const cap = budget.catLimits?.[id];
              const over = cap != null && sum > cap;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOpenCat(id)}
                  className="flex items-center gap-2 rounded-2xl bg-raised px-3 py-2 text-left"
                >
                  <span className="grid size-8 place-items-center rounded-lg" style={{ background: cat?.color }}>
                    <Icon className="size-4 text-white" />
                  </span>
                  <span>
                    <span className="block text-[13px]">{cat?.title}</span>
                    <span className={`text-[13px] ${over ? "text-[#e07040]" : "text-muted"}`}>
                      {money(sum, budget.currency)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <RowLabel left="цели" right="все" />
          <RowLabel left="недавние" right="все" onRight={() => setView("all")} />
          <ul className="space-y-2">
            {[...budget.txs]
              .sort((a, b) => {
                if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
                return b.date.localeCompare(a.date);
              })
              .slice(0, 5)
              .map((t) => (
                <TxRow key={t.id} t={t} cats={cats} main={budget.currency} />
              ))}
          </ul>
        </>
      )}

      {!empty ? (
        <>
          <button
            type="button"
            onClick={() => setView("analytics")}
            className="mt-3 flex w-full items-center gap-3 rounded-[22px] bg-raised px-4 py-3.5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[16px]">Аналитика</span>
              <span className="text-[13px] text-muted">траты за 6 месяцев</span>
            </span>
            <span className="flex h-8 items-end gap-0.5">
              {Array.from({ length: 6 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (5 - i));
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const sum = budget.txs
                  .filter((t) => t.kind === "expense" && t.date.startsWith(key))
                  .reduce((s, t) => s + toMain(t.amount, t.currency, budget.currency), 0);
                const peak = Math.max(
                  1,
                  ...Array.from({ length: 6 }, (_, j) => {
                    const x = new Date();
                    x.setMonth(x.getMonth() - (5 - j));
                    const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
                    return budget.txs
                      .filter((t) => t.kind === "expense" && t.date.startsWith(k))
                      .reduce((s, t) => s + toMain(t.amount, t.currency, budget.currency), 0);
                  }),
                );
                return (
                  <span
                    key={key}
                    className="w-1 rounded-full bg-white"
                    style={{ height: `${Math.max(4, Math.round((sum / peak) * 32))}px` }}
                  />
                );
              })}
            </span>
            <span className="text-[18px] text-muted">›</span>
          </button>
          <button
            type="button"
            onClick={() => setView("settings")}
            className="mt-2 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-3.5 text-left"
          >
            <span className="text-[16px]">Настройки бюджета</span>
            <span className="text-[18px] text-muted">›</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setView("settings")}
          className="mt-auto flex items-center justify-between rounded-[22px] bg-raised px-4 py-4"
        >
          <span>
            <span className="block text-[16px]">Основная валюта</span>
            <span className="text-[13px] text-muted">по региону телефона</span>
          </span>
          <span className="text-muted">
            {CURRENCIES.find((c) => c.code === budget.currency)?.symbol} · {budget.currency} ›
          </span>
        </button>
      )}
    </section>
  );
}

function Action({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <span className="grid size-16 place-items-center rounded-full bg-raised">{icon}</span>
      <span className="text-[13px] text-muted">{label}</span>
    </button>
  );
}

function RowLabel({ left, right, onRight }: { left: string; right: string; onRight?: () => void }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between text-[13px] tracking-[0.12em] text-muted uppercase">
      <span>{left}</span>
      <button type="button" onClick={onRight} className="tracking-normal text-blue lowercase">
        {right}
      </button>
    </div>
  );
}

function PayerDot({ who }: { who: "me" | "partner" }) {
  const colors = usePlayerColors();
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ${pieceBg(who === "me" ? colors.me : colors.partner)}`}
    />
  );
}

function TxRow({ t, cats, main }: { t: BudgetTx; cats: BudgetCategory[]; main: string }) {
  const cat = cats.find((c) => c.id === t.categoryId);
  const Icon = ICONS[cat?.icon ?? "more"] ?? MoreHorizontal;
  return (
    <li className="flex items-center gap-3 rounded-[22px] bg-raised px-3 py-3">
      <span className="relative grid size-11 place-items-center rounded-xl" style={{ background: cat?.color }}>
        <Icon className="size-5 text-white" />
        <PayerDot who={t.paidBy} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]">{t.note || cat?.title}</span>
        <span className="text-[13px] text-muted">{formatDay(t.date)}</span>
      </span>
      <span className="text-right">
        <span className={`block text-[15px] ${t.kind === "income" ? "text-green" : ""}`}>
          {t.kind === "income" ? "+" : ""}
          {t.currency} {t.amount.toLocaleString("en-US")}
        </span>
        {t.currency !== main ? (
          <span className="text-[13px] text-muted">{money(toMain(t.amount, t.currency, main), main)}</span>
        ) : null}
      </span>
    </li>
  );
}

function AllTxs({
  txs,
  cats,
  main,
  onBack,
}: {
  txs: BudgetTx[];
  cats: BudgetCategory[];
  main: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"all" | "expense" | "income">("all");
  const filtered = txs.filter((t) => (tab === "all" ? true : t.kind === tab));
  const groups = filtered.reduce<Record<string, BudgetTx[]>>((acc, t) => {
    (acc[t.date] ??= []).push(t);
    return acc;
  }, {});
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const heading = (iso: string) => {
    if (iso === todayIso()) return "сегодня";
    const d = new Date(`${iso}T12:00:00`);
    const y = d.getFullYear();
    const now = new Date().getFullYear();
    const label = `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
    return y === now ? label : `${label} ${y}`;
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-28">
      <div className="relative flex items-center pt-5">
        <button type="button" onClick={onBack} className="relative z-10 -ml-1 px-1 py-2 text-muted">
          ‹ Бюджет
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold">Операции</h1>
      </div>

      <div className="mt-5 flex min-w-0 flex-wrap gap-2">
        {(
          [
            ["all", "Все"],
            ["expense", "Расходы"],
            ["income", "Доход"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-[15px] ${tab === id ? "bg-white text-black" : "bg-raised text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {days.map((day) => {
        const list = groups[day];
        const net = list.reduce((s, t) => {
          const v = toMain(t.amount, t.currency, main);
          return t.kind === "income" ? s + v : s - v;
        }, 0);
        return (
          <div key={day} className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[12px] tracking-[0.12em] text-muted uppercase">
              <span>{heading(day)}</span>
              <span className="tracking-normal">
                {net === 0 ? money(0, main) : `${net > 0 ? "+" : "−"}${money(Math.abs(net), main)}`}
              </span>
            </div>
            <ul className="overflow-hidden rounded-[24px] bg-raised">
              {list.map((t, i) => {
                const cat = cats.find((c) => c.id === t.categoryId);
                const Icon = ICONS[cat?.icon ?? "more"] ?? MoreHorizontal;
                return (
                  <li key={t.id} className={`flex items-center gap-3 px-3 py-3 ${i ? "border-t border-line" : ""}`}>
                    <span className="relative grid size-11 place-items-center rounded-xl" style={{ background: cat?.color }}>
                      <Icon className="size-5 text-white" />
                      <PayerDot who={t.paidBy} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px]">{t.note || cat?.title}</span>
                      <span className="text-[13px] text-muted">{cat?.title}</span>
                    </span>
                    <span className="text-right">
                      {t.kind === "income" && t.currency !== main ? (
                        <>
                          <span className="block text-[15px] text-green">
                            +{t.currency} {t.amount.toLocaleString("en-US")}
                          </span>
                          <span className="text-[13px] text-muted">{money(toMain(t.amount, t.currency, main), main)}</span>
                        </>
                      ) : t.currency !== main ? (
                        <>
                          <span className="block text-[15px]">
                            {t.currency} {t.amount.toLocaleString("en-US")}
                          </span>
                          <span className="text-[13px] text-muted">{money(toMain(t.amount, t.currency, main), main)}</span>
                        </>
                      ) : (
                        <span className={`block text-[16px] ${t.kind === "income" ? "text-green" : ""}`}>
                          {t.kind === "income" ? "+" : ""}
                          {money(t.amount, main)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function TxForm({
  kind,
  draft,
  cats,
  main,
  myName,
  partnerName,
  onChange,
  onCancel,
  onCustom,
  onSave,
}: {
  kind: "expense" | "income";
  draft: { amount: string; currency: string; categoryId: string; date: string; paidBy: "me" | "partner"; note: string };
  cats: BudgetCategory[];
  main: string;
  myName: string;
  partnerName: string;
  onChange: (next: typeof draft) => void;
  onCancel: () => void;
  onCustom: () => void;
  onSave: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const colors = usePlayerColors();
  const amount = Number(draft.amount.replace(",", ".")) || 0;
  const ready = amount > 0 && Boolean(draft.categoryId);
  const preview =
    kind === "income"
      ? cats.filter((c) => ["salary", "advance", "side", "in-gifts"].includes(c.id) || !BUILTIN.some((b) => b.id === c.id)).slice(0, 4)
      : cats.filter((c) => ["groceries","cafes","housing","transport","health","clothes","fun","gifts","phone","home","pets"].includes(c.id) || !BUILTIN.some((b) => b.id === c.id)).slice(0, 11);
  const converted =
    draft.currency !== main && amount
      ? `${money(toMain(amount, draft.currency, main), main)} по курсу ЦБ`
      : "";
  const symbol = CURRENCIES.find((c) => c.code === draft.currency)?.symbol ?? draft.currency;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-28">
      <SheetHeader
        flush
        title={kind === "expense" ? "Расход" : "Доход"}
        onCancel={onCancel}
        onDone={onSave}
        doneDisabled={!ready}
      />

      <div className="relative mt-5 rounded-[24px] bg-raised px-4 py-5 text-center">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">сумма</p>
        <div className="mt-3 flex items-end justify-center gap-2">
          <input
            value={draft.amount}
            onChange={(e) => onChange({ ...draft, amount: e.target.value.replace(/[^\d.,]/g, "") })}
            inputMode="decimal"
            placeholder="0"
            className="min-w-[4rem] max-w-[220px] bg-transparent text-center text-[52px] font-semibold leading-none outline-none"
          />
          <span className="mb-2 text-[28px] text-muted">{symbol}</span>
        </div>
        <button
          type="button"
          onClick={() => setCurrencyOpen(true)}
          className="mt-3 rounded-full bg-[#2a2d36] px-3 py-1 text-[13px]"
        >
          {draft.currency} ▾
        </button>
        <p className="mt-3 text-[13px] text-muted">{converted || "основная валюта"}</p>
      </div>

      {kind === "income" ? (
        <div className="mt-4 rounded-[22px] bg-raised px-3 py-3">
          <p className="px-1 text-[11px] tracking-[0.14em] text-muted uppercase">кто получил</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...draft, paidBy: "me" })}
              className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left ${draft.paidBy === "me" ? `ring-2 ${pieceRing(colors.me)}` : "bg-[#2a2d36]"}`}
            >
              <span className={`size-2.5 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
              <span className="min-w-0 break-words text-[14px] leading-5">{myName}</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...draft, paidBy: "partner" })}
              className={`flex min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left ${draft.paidBy === "partner" ? `ring-2 ${pieceRing(colors.partner)}` : "bg-[#2a2d36]"}`}
            >
              <span className={`size-2.5 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
              <span className="min-w-0 break-words text-[14px] leading-5">{partnerName}</span>
            </button>
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">категория</p>
      <div className="mt-3 grid min-w-0 grid-cols-3 gap-x-1 gap-y-4 sm:grid-cols-4">
        {preview.map((c) => (
          <CatBtn key={c.id} cat={c} active={draft.categoryId === c.id} onClick={() => onChange({ ...draft, categoryId: c.id })} />
        ))}
        {kind === "income" ? (
          <>
            <CatBtn
              cat={cats.find((c) => c.id === "in-other") ?? { id: "in-other", title: "Другое", kind: "income", icon: "more", color: "#2a2d36" }}
              active={draft.categoryId === "in-other"}
              onClick={() => onChange({ ...draft, categoryId: "in-other" })}
            />
            <button type="button" onClick={onCustom} className="flex flex-col items-center gap-1">
              <span className="grid size-14 place-items-center rounded-2xl bg-raised">
                <Plus className="size-5" />
              </span>
              <span className="text-[12px] text-muted">Своя</span>
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1">
            <span className="grid size-14 place-items-center rounded-2xl bg-raised">
              <MoreHorizontal className="size-5" />
            </span>
            <span className="text-[12px] text-muted">Ещё</span>
          </button>
        )}
      </div>

      <div className="mt-5 rounded-[22px] bg-raised px-4">
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="flex w-full items-center justify-between py-4"
        >
          <span>Когда</span>
          <span className="text-blue">{formatWhen(draft.date)}</span>
        </button>
        {kind === "expense" ? (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line py-3">
            <span className="shrink-0">Кто платил</span>
            <div className="flex max-w-full flex-wrap gap-1 rounded-[22px] bg-[#2a2d36] p-1">
              <button
                type="button"
                onClick={() => onChange({ ...draft, paidBy: "me" })}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ${draft.paidBy === "me" ? "bg-raised" : ""}`}
              >
                <span className={`size-2 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
                Я
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...draft, paidBy: "partner" })}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-left text-[13px] ${draft.paidBy === "partner" ? "bg-raised" : ""}`}
              >
                <span className={`size-2 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
                <span className="break-words">{partnerName}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <label className="mt-3 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">за что</span>
        <input
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="Необязательно"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      {dateOpen ? (
        <DatePicker
          mode="any"
          label="Когда"
          value={draft.date}
          onPick={(day) => {
            onChange({ ...draft, date: day });
            setDateOpen(false);
          }}
          onClose={() => setDateOpen(false)}
        />
      ) : null}
      {moreOpen ? (
        <CategorySheet
          cats={cats}
          onPick={(id) => {
            onChange({ ...draft, categoryId: id });
            setMoreOpen(false);
          }}
          onCustom={() => {
            setMoreOpen(false);
            onCustom();
          }}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
      {currencyOpen ? (
        <CurrencyPicker
          value={draft.currency}
          onPick={(code) => {
            onChange({ ...draft, currency: code });
            setCurrencyOpen(false);
          }}
          onClose={() => setCurrencyOpen(false)}
        />
      ) : null}
    </section>
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
  const filtered = CURRENCIES.filter(
    (c) =>
      !query ||
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query),
  );
  const popular = POPULAR.map((code) => CURRENCIES.find((c) => c.code === code)!).filter(Boolean);
  const rest = filtered.filter((c) => !POPULAR.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-5">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-raised">
          ‹
        </button>
        <button type="button" onClick={onClose} className="text-blue">
          Готово
        </button>
      </div>
      <h1 className="mt-6 text-[34px] font-semibold">Валюта</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Название или код"
        className="mt-4 w-full rounded-2xl bg-raised px-4 py-3 outline-none"
      />
      {!query ? (
        <>
          <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">популярные</p>
          <ul className="mt-2">
            {popular.map((c) => (
              <CurrencyRow key={`p-${c.code}`} item={c} active={value === c.code} onPick={onPick} />
            ))}
          </ul>
          <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">все валюты</p>
        </>
      ) : (
        <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">результаты</p>
      )}
      <ul className="mt-2 pb-16">
        {(query ? filtered : rest).map((c) => (
          <CurrencyRow key={c.code} item={c} active={value === c.code} onPick={onPick} />
        ))}
      </ul>
    </div>
  );
}

function CurrencyRow({
  item,
  active,
  onPick,
}: {
  item: { code: string; symbol: string; name: string };
  active: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <button type="button" onClick={() => onPick(item.code)} className="flex w-full items-center gap-3 py-3">
      <span className="w-8 text-left text-[17px] text-muted">{item.symbol}</span>
      <span className="flex-1 text-left text-[16px]">{item.name}</span>
      <span className="text-[14px] text-muted">{item.code}</span>
      <span className="w-5 text-blue">{active ? "✓" : ""}</span>
    </button>
  );
}

function CatBtn({ cat, active, onClick }: { cat: BudgetCategory; active?: boolean; onClick: () => void }) {
  const Icon = ICONS[cat.icon] ?? MoreHorizontal;
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-center gap-1">
      <span
        className={`grid size-14 place-items-center rounded-2xl ${active ? "ring-2 ring-white" : ""}`}
        style={{ background: cat.color }}
      >
        <Icon className="size-5 text-white/90" />
      </span>
      <span className="w-full text-center text-[12px] leading-4 break-words text-muted">{cat.title}</span>
    </button>
  );
}

function CategorySheet({
  cats,
  onPick,
  onCustom,
  onClose,
}: {
  cats: BudgetCategory[];
  onPick: (id: string) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Закрыть" />
      <div className="relative rounded-t-[28px] bg-[#1c1d22] px-5 pb-10 pt-3">
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-line" />
        <div className="grid min-w-0 grid-cols-3 gap-y-5 sm:grid-cols-4">
          {cats.map((c) => (
            <CatBtn key={c.id} cat={c} onClick={() => onPick(c.id)} />
          ))}
          <button type="button" onClick={onCustom} className="flex flex-col items-center gap-1">
            <span className="grid size-14 place-items-center rounded-2xl bg-raised">
              <Plus className="size-5" />
            </span>
            <span className="text-[12px] text-muted">Своя</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomCategory({
  value,
  onChange,
  onCancel,
  onSave,
  builtin,
  txCount,
}: {
  value: { title: string; kind: "expense" | "income"; icon: string; color: string; hidden: boolean };
  onChange: (next: typeof value) => void;
  onCancel: () => void;
  onSave: () => void;
  builtin?: boolean;
  txCount?: number;
}) {
  const icons = value.kind === "income" ? INCOME_ICONS : EXPENSE_ICONS;
  const Icon = ICONS[value.icon] ?? Dumbbell;
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <SheetHeader flush title="Категория" onCancel={onCancel} onDone={onSave} />
      <div className="mx-auto mt-6 grid size-[72px] place-items-center rounded-[22px]" style={{ background: value.color }}>
        <Icon className="size-8" style={{ color: sliceColor("x", value.color) }} />
      </div>
      <label className="mt-6 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">название</span>
        <input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          className="mt-1 w-full bg-transparent text-[17px] outline-none"
        />
        <span className="mt-1 block text-[13px] text-muted">
          {builtin ? "встроенная · можно переименовать" : "своя категория"}
        </span>
      </label>
      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">иконка</p>
        <div className="mt-3 grid grid-cols-6 gap-3">
          {icons.map((id) => {
            const Ico = ICONS[id] ?? MoreHorizontal;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...value, icon: id })}
                className={`grid size-9 place-items-center rounded-full ${value.icon === id ? "ring-1 ring-white" : ""}`}
              >
                <Ico className="size-5 text-muted" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">цвет</p>
        <div className="mt-3 flex gap-2">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, color })}
              className={`size-8 rounded-full ${value.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-raised" : ""}`}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-[22px] bg-raised px-4 py-4">
        <span>
          <span className="block">Операции</span>
          <span className="text-[13px] text-muted">за всё время</span>
        </span>
        <span className="text-muted">{txCount ?? 0}</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-[22px] bg-raised px-4 py-4">
        <span>
          <span className="block">Скрыть</span>
          <span className="text-[13px] text-muted">не будет в форме расхода; старые операции останутся</span>
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...value, hidden: !value.hidden })}
          className={`h-7 w-12 rounded-full ${value.hidden ? "bg-blue" : "bg-[#3a3d46]"}`}
        >
          <span className={`block size-6 rounded-full bg-white transition ${value.hidden ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </section>
  );
}

function Analytics({
  month,
  setMonth,
  txs,
  cats,
  main,
  myName,
  partnerName,
  onBack,
}: {
  month: string;
  setMonth: (v: string) => void;
  txs: BudgetTx[];
  cats: BudgetCategory[];
  main: string;
  myName: string;
  partnerName: string;
  onBack: () => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const colors = usePlayerColors();
  const [y, m] = month.split("-").map(Number);
  const monthTx = txs.filter((t) => t.date.startsWith(month));
  const spent = monthTx.filter((t) => t.kind === "expense").reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
  const byCat = new Map<string, number>();
  monthTx
    .filter((t) => t.kind === "expense")
    .forEach((t) => byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + toMain(t.amount, t.currency, main)));
  const shift = (dir: number) => {
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setFocus(null);
  };
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return {
      key,
      spend: txs.filter((t) => t.kind === "expense" && t.date.startsWith(key)).reduce((s, t) => s + toMain(t.amount, t.currency, main), 0),
      income: txs.filter((t) => t.kind === "income" && t.date.startsWith(key)).reduce((s, t) => s + toMain(t.amount, t.currency, main), 0),
    };
  });
  const maxBar = Math.max(1, ...months.map((x) => x.spend + x.income));
  const meSpend = monthTx.filter((t) => t.kind === "expense" && t.paidBy === "me").reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
  const partnerSpend = monthTx.filter((t) => t.kind === "expense" && t.paidBy === "partner").reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
  const meIncome = monthTx.filter((t) => t.kind === "income" && t.paidBy === "me").reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
  const partnerIncome = monthTx.filter((t) => t.kind === "income" && t.paidBy === "partner").reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
  const slices = [...byCat.entries()]
    .map(([id, sum]) => {
      const cat = cats.find((c) => c.id === id);
      return {
        id,
        sum,
        title: cat?.title ?? "Другое",
        color: sliceColor(id, cat?.color),
        pct: spent ? Math.round((sum / spent) * 100) : 0,
      };
    })
    .sort((a, b) => b.sum - a.sum);
  const ring = 2 * Math.PI * 42;
  const visible = slices.filter((s) => s.sum > 0);
  const gap = visible.length > 1 ? 4 : 0;
  let acc = 0;
  const arcs = visible.map((s) => {
    const len = Math.max(0, (s.sum / spent) * (ring - gap * visible.length));
    const start = acc;
    acc += len + gap;
    return { ...s, len, start };
  });
  const drawn = focus ? [...arcs.filter((a) => a.id !== focus), ...arcs.filter((a) => a.id === focus)] : arcs;
  const shown = focus ? slices.filter((s) => s.id === focus) : slices;
  const focusSlice = slices.find((s) => s.id === focus);

  if (openCat) {
    const slice = slices.find((s) => s.id === openCat);
    const cat = cats.find((c) => c.id === openCat);
    const prev = new Date(y, m - 2, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const prevSum = txs
      .filter((t) => t.kind === "expense" && t.categoryId === openCat && t.date.startsWith(prevKey))
      .reduce((s, t) => s + toMain(t.amount, t.currency, main), 0);
    return (
      <CategorySpends
        catId={openCat}
        title={slice?.title ?? cat?.title ?? "Категория"}
        color={cat?.color ?? "#3a3358"}
        accent={slice?.color ?? sliceColor(openCat, cat?.color)}
        icon={cat?.icon ?? "more"}
        items={monthTx.filter((t) => t.kind === "expense" && t.categoryId === openCat)}
        total={slice?.sum ?? 0}
        prevSum={prevSum}
        prevLabel={MONTHS[prev.getMonth()]}
        main={main}
        monthLabel={MONTHS[m - 1]}
        onBack={() => setOpenCat(null)}
      />
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-muted">
        ‹ Бюджет
      </button>
      <h1 className="text-[34px] font-semibold tracking-tight">Аналитика</h1>

      <div className="mt-5 rounded-[24px] bg-raised px-4 py-5">
        <div className="flex items-center justify-between text-[16px] font-semibold">
          <button type="button" onClick={() => shift(-1)} className="text-muted">
            ‹
          </button>
          {MONTHS[m - 1]} {y}
          <button type="button" onClick={() => shift(1)} className="text-muted">
            ›
          </button>
        </div>
        <div className="relative mx-auto mt-6 grid size-44 place-items-center">
          <svg viewBox="0 0 120 120" className="size-44">
            <circle cx="60" cy="60" r="42" fill="none" stroke="#2a2d36" strokeWidth="14" />
            {drawn.map((s) => {
              const on = !focus || s.id === focus;
              return (
                <circle
                  key={s.id}
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.id === focus ? 20 : 14}
                  strokeDasharray={`${s.len} ${ring - s.len}`}
                  strokeDashoffset={-s.start}
                  strokeLinecap="butt"
                  opacity={on ? 1 : 0.22}
                  transform="rotate(-90 60 60)"
                  className="cursor-pointer"
                  style={{ pointerEvents: "stroke" }}
                  onClick={() => setFocus((cur) => (cur === s.id ? null : s.id))}
                />
              );
            })}
          </svg>
          <button
            type="button"
            className="absolute text-center"
            onClick={() => setFocus(null)}
          >
            <p className="text-[11px] tracking-[0.14em] text-muted uppercase">
              {focusSlice ? focusSlice.title : "расход"}
            </p>
            <p className="text-[22px] font-semibold">{money(focusSlice ? focusSlice.sum : spent, main)}</p>
          </button>
        </div>
      </div>

      <ul className="mt-3 overflow-hidden rounded-[22px] bg-raised">
        {shown.map((s, i) => (
          <li key={s.id} className={i ? "border-t border-line" : ""}>
            <button
              type="button"
              onClick={() => setOpenCat(s.id)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="size-3 rounded-sm" style={{ background: s.color }} />
                <span>
                  <span className="block">{s.title}</span>
                  <span className="text-[13px] text-muted">{s.pct} % · к пред. —</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                {money(s.sum, main)}
                <span className="text-muted">›</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] tracking-[0.12em] text-muted uppercase">доходы и траты · 12 мес.</p>
          <span className="flex items-center gap-3 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-green" /> доход
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-[#f07167]" /> расход
            </span>
          </span>
        </div>
        <div className="mt-4 flex h-28 items-end justify-between gap-1">
          {months.map((item) => (
            <div key={item.key} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
              {item.income ? (
                <div
                  className="w-full max-w-[10px] rounded-full bg-green"
                  style={{ height: `${Math.max(6, (item.income / maxBar) * 100)}%` }}
                />
              ) : null}
              <div
                className={`w-full max-w-[10px] rounded-full ${item.spend ? "bg-[#f07167]" : "bg-line"}`}
                style={{ height: `${item.spend ? Math.max(6, (item.spend / maxBar) * 100) : 2}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          {MONTHS_EN.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <p className="text-[11px] tracking-[0.12em] text-muted uppercase">кто внёс · {MONTHS[m - 1]}</p>
        <PersonBar name={myName} spend={meSpend} income={meIncome} total={spent} main={main} color={pieceBg(colors.me)} />
        <PersonBar name={partnerName} spend={partnerSpend} income={partnerIncome} total={spent} main={main} color={pieceBg(colors.partner)} />
      </div>
    </section>
  );
}

function CategorySpends({
  catId,
  title,
  color,
  accent,
  icon,
  items,
  total,
  prevSum,
  prevLabel,
  main,
  monthLabel,
  onBack,
}: {
  catId: string;
  title: string;
  color: string;
  accent: string;
  icon: string;
  items: BudgetTx[];
  total: number;
  prevSum: number;
  prevLabel: string;
  main: string;
  monthLabel: string;
  onBack: () => void;
}) {
  const limit = useCouple((s) => s.budget.catLimits?.[catId] ?? null);
  const [sheet, setSheet] = useState(false);
  const Icon = ICONS[icon] ?? MoreHorizontal;
  const vs = prevSum ? `${total >= prevSum ? "+" : ""}${money(total - prevSum, main)}` : "—";
  const over = limit != null && total > limit;
  const warn = "#e07040";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Бюджет
        </button>
        <button type="button" className="text-blue" onClick={() => setSheet(true)}>
          Лимит
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-2xl" style={{ background: color }}>
          <Icon className="size-6" style={{ color: accent }} />
        </span>
        <div>
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">
            расходы · {monthLabel}
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] bg-raised px-5 py-5">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">потрачено</p>
        <p className="mt-2 text-[40px] font-semibold tracking-tight" style={{ color: over ? warn : undefined }}>
          {money(total, main)}
        </p>
        {limit ? (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#3a2418]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((total / limit) * 100))}%`,
                  background: over ? warn : accent,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span style={{ color: over ? warn : "#8b8e97" }}>
                {over ? `+${money(total - limit, main)} сверх лимита` : money(total, main)}
              </span>
              <span className="text-muted">из {money(limit, main)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[15px]">
              <span>Лимит</span>
              <span>{money(limit, main)}</span>
            </div>
          </>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[15px] text-muted">
          <span>к {prevLabel}</span>
          <span>{vs}</span>
        </div>
      </div>

      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">
        операции · {items.length}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-[22px] bg-raised px-3 py-3">
            <span className="relative grid size-11 place-items-center rounded-xl" style={{ background: color }}>
              <Icon className="size-5" style={{ color: accent }} />
              <PayerDot who={t.paidBy} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px]">{t.note || title}</span>
              <span className="text-[13px] text-muted">{formatDay(t.date)}</span>
            </span>
            <span className="text-right text-[16px]">{money(toMain(t.amount, t.currency, main), main)}</span>
          </li>
        ))}
      </ul>

      {sheet ? (
        <LimitSheet
          title={title}
          color={color}
          icon={icon}
          id={catId}
          spent={total}
          value={limit}
          currency={main}
          onClose={() => setSheet(false)}
        />
      ) : null}
    </section>
  );
}

function PersonBar({
  name,
  spend,
  income,
  total,
  main,
  color,
}: {
  name: string;
  spend: number;
  income: number;
  total: number;
  main: string;
  color: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[14px]">
        <span className="flex items-center gap-2">
          <span className={`size-3 rounded-full ${color}`} />
          <span className="max-w-[160px] truncate">{name}</span>
        </span>
        <span className="text-muted">
          доход {money(income, main)} <span className="ml-2 text-fg">{money(spend, main)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2a2d36]">
        <div className={`h-full ${color}`} style={{ width: `${total ? Math.round((spend / total) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

function Settings({
  currency,
  cats,
  txs,
  monthLimit,
  monthLimitFrom,
  catLimits,
  accounts,
  myName,
  partnerName,
  onBack,
  onCurrency,
}: {
  currency: string;
  cats: BudgetCategory[];
  txs: BudgetTx[];
  monthLimit: number | null;
  monthLimitFrom: string | null;
  catLimits: Record<string, number>;
  accounts: BudgetAccount[];
  myName: string;
  partnerName: string;
  onBack: () => void;
  onCurrency: (code: string) => void;
}) {
  const [page, setPage] = useState<"hub" | "currency" | "cats" | "recur">("hub");
  const cur = CURRENCIES.find((c) => c.code === currency);

  if (page === "currency") {
    return <CurrencyPicker value={currency} onPick={onCurrency} onClose={() => setPage("hub")} />;
  }

  if (page === "cats") {
    return (
      <CategoriesLimits
        cats={cats}
        txs={txs}
        currency={currency}
        monthLimit={monthLimit}
        monthLimitFrom={monthLimitFrom}
        catLimits={catLimits}
        myName={myName}
        partnerName={partnerName}
        onBack={() => setPage("hub")}
      />
    );
  }

  if (page === "recur") {
    return (
      <RecurringHub
        cats={cats}
        accounts={accounts}
        currency={currency}
        myName={myName}
        partnerName={partnerName}
        onBack={() => setPage("hub")}
      />
    );
  }

  return (
    <section className="px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-muted">
        ‹ Бюджет
      </button>
      <h1 className="mt-3 text-[34px] font-semibold tracking-tight">Настройки бюджета</h1>
      <div className="mt-5 overflow-hidden rounded-[24px] bg-raised">
        <button
          type="button"
          onClick={() => setPage("currency")}
          className="flex w-full items-center justify-between px-4 py-4 text-left"
        >
          <span>Основная валюта</span>
          <span className="text-muted">
            {cur?.symbol} · {currency} ›
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPage("cats")}
          className="flex w-full items-center justify-between border-t border-line px-4 py-4 text-left"
        >
          <span>Категории и лимиты</span>
          <span className="text-muted">›</span>
        </button>
        <button
          type="button"
          onClick={() => setPage("recur")}
          className="flex w-full items-center justify-between border-t border-line px-4 py-4 text-left"
        >
          <span>Регулярные платежи</span>
          <span className="text-muted">›</span>
        </button>
      </div>
    </section>
  );
}

function CategoriesLimits({
  cats,
  txs,
  currency,
  monthLimit,
  monthLimitFrom,
  catLimits,
  myName,
  partnerName,
  onBack,
}: {
  cats: BudgetCategory[];
  txs: BudgetTx[];
  currency: string;
  monthLimit: number | null;
  monthLimitFrom: string | null;
  catLimits: Record<string, number>;
  myName: string;
  partnerName: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const colors = usePlayerColors();
  const [limitFor, setLimitFor] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<BudgetCategory | null>(null);
  const [custom, setCustom] = useState<null | { title: string; kind: "expense" | "income"; icon: string; color: string; hidden: boolean }>(null);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const list = cats.filter((c) => c.kind === tab && !c.hidden);
  const target = limitFor === "__month__" ? null : cats.find((c) => c.id === limitFor);
  const spentNow = (id?: string) =>
    txs
      .filter((t) => t.kind === "expense" && t.date.startsWith(monthKey) && (!id || t.categoryId === id))
      .reduce((s, t) => s + toMain(t.amount, t.currency, currency), 0);

  if (editCat) {
    return (
      <CustomCategory
        value={{
          title: editCat.title,
          kind: editCat.kind,
          icon: editCat.icon,
          color: editCat.color,
          hidden: !!editCat.hidden,
        }}
        builtin={BUILTIN.some((b) => b.id === editCat.id)}
        txCount={txs.filter((t) => t.categoryId === editCat.id).length}
        onChange={(next) => setEditCat({ ...editCat, ...next })}
        onCancel={() => setEditCat(null)}
        onSave={() => {
          useCouple.getState().updateBudgetCategory(editCat.id, {
            title: editCat.title,
            kind: editCat.kind,
            icon: editCat.icon,
            color: editCat.color,
            hidden: editCat.hidden,
          });
          setEditCat(null);
        }}
      />
    );
  }

  if (custom) {
    return (
      <CustomCategory
        value={custom}
        onChange={setCustom}
        onCancel={() => setCustom(null)}
        onSave={() => {
          useCouple.getState().addBudgetCategory(custom);
          setCustom(null);
        }}
      />
    );
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <div className="relative flex items-center pt-5">
        <button type="button" onClick={onBack} className="relative z-10 text-muted">
          ‹ Настройки
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold">Категории</h1>
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-full bg-raised p-1">
        <button
          type="button"
          onClick={() => setTab("expense")}
          className={`rounded-full py-2.5 text-[15px] ${tab === "expense" ? "bg-[#2a2d36]" : "text-muted"}`}
        >
          Расходы
        </button>
        <button
          type="button"
          onClick={() => setTab("income")}
          className={`rounded-full py-2.5 text-[15px] ${tab === "income" ? "bg-[#2a2d36]" : "text-muted"}`}
        >
          Доход
        </button>
      </div>

      {tab === "expense" ? (
        <>
          <button
            type="button"
            onClick={() => setLimitFor("__month__")}
            className="mt-4 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4 text-left"
          >
            <span>
              <span className="block">Общий лимит на месяц</span>
              {monthLimit && monthLimitFrom ? (
                <span className="text-[13px] text-muted">
                  с {MONTHS[Number(monthLimitFrom.slice(5)) - 1].toLowerCase()} {monthLimitFrom.slice(0, 4)}
                </span>
              ) : null}
            </span>
            <span className="text-muted">
              {monthLimit ? money(monthLimit, currency) : "без лимита"} ›
            </span>
          </button>
          <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">лимиты категорий</p>
        </>
      ) : (
        <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">
          получено в {MONTHS[now.getMonth()].toLowerCase()}
        </p>
      )}

      <ul className="mt-2 overflow-hidden rounded-[24px] bg-raised">
        {list.map((c, i) => {
          const Icon = ICONS[c.icon] ?? MoreHorizontal;
          const limit = catLimits[c.id];
          const monthSum = txs
            .filter((t) => t.kind === tab && t.categoryId === c.id && t.date.startsWith(monthKey))
            .reduce((s, t) => s + toMain(t.amount, t.currency, currency), 0);
          const meSum = txs
            .filter((t) => t.kind === "income" && t.categoryId === c.id && t.date.startsWith(monthKey) && t.paidBy === "me")
            .reduce((s, t) => s + toMain(t.amount, t.currency, currency), 0);
          const partnerSum = txs
            .filter((t) => t.kind === "income" && t.categoryId === c.id && t.date.startsWith(monthKey) && t.paidBy === "partner")
            .reduce((s, t) => s + toMain(t.amount, t.currency, currency), 0);
          return (
            <li key={c.id} className={i ? "border-t border-line" : ""}>
              <button
                type="button"
                onClick={() => (tab === "expense" ? setLimitFor(c.id) : setEditCat(c))}
                className="flex w-full items-start gap-3 px-3 py-3 text-left"
              >
                <span className="grid size-11 place-items-center rounded-xl" style={{ background: c.color }}>
                  <Icon className="size-5" style={{ color: sliceColor(c.id, c.color) }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between">
                    <span className="text-[16px]">{c.title}</span>
                    <span className="text-[15px] text-muted">
                      {tab === "expense"
                        ? limit
                          ? money(limit, currency)
                          : "без лимита"
                        : monthSum
                          ? money(monthSum, currency)
                          : ""}{" "}
                      ›
                    </span>
                  </span>
                  {tab === "income" && (meSum || partnerSum) ? (
                    <span className="mt-1 block text-[13px] text-muted">
                      {meSum ? (
                        <span className="mr-3">
                          <span className={`mr-1 inline-block size-2 rounded-full ${pieceBg(colors.me)}`} />
                          {myName} · {money(meSum, currency)}
                        </span>
                      ) : null}
                      {partnerSum ? (
                        <span>
                          <span className={`mr-1 inline-block size-2 rounded-full ${pieceBg(colors.partner)}`} />
                          {partnerName} · {money(partnerSum, currency)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() =>
          setCustom({
            title: tab === "income" ? "Доход" : "Зал",
            kind: tab,
            icon: tab === "income" ? "banknote" : "dumbbell",
            color: PALETTE[0],
            hidden: false,
          })
        }
        className="mt-3 w-full rounded-[22px] bg-raised py-4 text-center text-blue"
      >
        + Своя категория
      </button>

      {limitFor ? (
        <LimitSheet
          title={target?.title ?? "Общий лимит на месяц"}
          color={target?.color ?? "#2a2d36"}
          icon={target?.icon ?? "wallet"}
          id={limitFor}
          spent={spentNow(limitFor === "__month__" ? undefined : limitFor)}
          value={limitFor === "__month__" ? monthLimit : catLimits[limitFor] ?? null}
          currency={currency}
          onClose={() => setLimitFor(null)}
          onSettings={
            target
              ? () => {
                  setLimitFor(null);
                  setEditCat(target);
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}

function LimitSheet({
  title,
  color,
  icon,
  id,
  spent,
  value,
  currency,
  onClose,
  onSettings,
}: {
  title: string;
  color: string;
  icon: string;
  id: string;
  spent: number;
  value: number | null;
  currency: string;
  onClose: () => void;
  onSettings?: () => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : "0");
  const Icon = ICONS[icon] ?? MoreHorizontal;
  const n = Number(draft.replace(",", ".")) || 0;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  const now = new Date();
  const log = useCouple((s) => s.budget.limitLog ?? []).filter((row) =>
    id === "__month__" ? true : row.key === id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="w-full rounded-t-[28px] bg-[#1c1e24] px-5 pb-10 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl" style={{ background: color }}>
            <Icon className="size-5" style={{ color: sliceColor(id, color) }} />
          </span>
          <div>
            <p className="text-[17px] font-semibold">{id === "__month__" ? title : `Лимит · ${title}`}</p>
            <p className="text-[13px] text-muted">
              в {MONTHS[now.getMonth()].toLowerCase()} {money(spent, currency)}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-[24px] bg-[#14161b] px-4 py-6 text-center">
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">в месяц</p>
          <label className="mt-2 flex w-full items-end justify-center gap-2 overflow-hidden px-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 12))}
              inputMode="decimal"
              className="min-w-0 max-w-full bg-transparent text-center font-semibold outline-none"
              style={{ fontSize: draft.length > 8 ? 28 : draft.length > 6 ? 34 : 44, width: `${Math.max(2, draft.length + 1)}ch` }}
            />
            <span className="pb-1 text-[28px] text-muted">{symbol}</span>
          </label>
          <p className="mt-3 text-[13px] text-muted">
            с {MONTHS[now.getMonth()].toLowerCase()} {now.getFullYear()} и дальше · прошлые месяцы свои
          </p>
        </div>
        <button
          type="button"
          disabled={n <= 0 && !value}
          onClick={() => {
            useCouple.getState().setBudgetLimit(id, n > 0 ? n : null, title);
            onClose();
          }}
          className="mt-4 w-full rounded-full bg-white py-4 text-[17px] font-semibold text-black disabled:bg-[#3a3d46] disabled:text-muted"
        >
          Сохранить
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => {
              useCouple.getState().setBudgetLimit(id, null, title);
              onClose();
            }}
            className="mt-3 w-full py-3 text-center text-[#f07167]"
          >
            Убрать лимит
          </button>
        ) : null}
        {onSettings && !value ? (
          <button
            type="button"
            onClick={onSettings}
            className="mt-2 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
          >
            <span>Настройки категории</span>
            <span className="text-muted">›</span>
          </button>
        ) : onSettings && value ? (
          <button
            type="button"
            onClick={onSettings}
            className="mt-1 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
          >
            <span>Настройки категории</span>
            <span className="text-muted">›</span>
          </button>
        ) : null}
        {log.length ? (
          <div className="mt-5">
            <p className="mb-2 text-[12px] tracking-[0.14em] text-muted uppercase">история лимитов</p>
            <ul className="overflow-hidden rounded-[22px] bg-[#14161b]">
              {log.map((row, i) => {
                const d = new Date(row.at);
                return (
                  <li
                    key={row.id}
                    className={`flex items-center justify-between px-4 py-3 text-[14px] ${i ? "border-t border-line" : ""}`}
                  >
                    <span>
                      <span className="block">{row.title}</span>
                      <span className="text-[12px] text-muted">
                        {d.getDate()} {MONTHS[d.getMonth()].toLowerCase().slice(0, 3)} {d.getFullYear()}
                      </span>
                    </span>
                    <span className={row.amount ? "" : "text-[#f07167]"}>
                      {row.amount ? money(row.amount, currency) : "убран"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const FREQ: { id: RecurringPayment["freq"]; label: string }[] = [
  { id: "month", label: "Каждый месяц" },
  { id: "week", label: "Каждую неделю" },
  { id: "biweek", label: "Каждые две недели" },
  { id: "year", label: "Каждый год" },
];

function nextRecurringDates(freq: RecurringPayment["freq"], day: number, count = 3) {
  const out: Date[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (freq === "month" || freq === "year") {
    let y = now.getFullYear();
    let m = now.getMonth();
    const make = (yy: number, mm: number) => {
      const last = new Date(yy, mm + 1, 0).getDate();
      return new Date(yy, mm, Math.min(day, last));
    };
    let d = make(y, m);
    if (d < now) {
      if (freq === "year") d = make(y + 1, m);
      else {
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
        d = make(y, m);
      }
    }
    for (let i = 0; i < count; i++) {
      out.push(new Date(d));
      if (freq === "year") d = make(d.getFullYear() + 1, d.getMonth());
      else {
        const nm = d.getMonth() + 1;
        d = make(d.getFullYear() + (nm > 11 ? 1 : 0), nm % 12);
      }
    }
    return out;
  }
  const want = ((day - 1) % 7) + 1;
  const iso = (dt: Date) => (dt.getDay() === 0 ? 7 : dt.getDay());
  let cur = new Date(now);
  while (iso(cur) !== want) cur.setDate(cur.getDate() + 1);
  const step = freq === "biweek" ? 14 : 7;
  for (let i = 0; i < count; i++) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + step);
  }
  return out;
}

function periodKey(freq: RecurringPayment["freq"], at = new Date()) {
  if (freq === "year") return String(at.getFullYear());
  if (freq === "week" || freq === "biweek") {
    const t = new Date(at);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return t.toISOString().slice(0, 10);
  }
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

function RecurringHub({
  cats,
  accounts,
  currency,
  myName,
  partnerName,
  onBack,
}: {
  cats: BudgetCategory[];
  accounts: BudgetAccount[];
  currency: string;
  myName: string;
  partnerName: string;
  onBack: () => void;
}) {
  const list = useCouple((s) => s.budget.recurring ?? []);
  const [edit, setEdit] = useState<RecurringPayment | "new" | null>(null);

  useEffect(() => {
    const st = useCouple.getState();
    (st.budget.recurring ?? []).forEach((r) => {
      if (r.mode !== "auto" || r.amount <= 0) return;
      const due = nextRecurringDates(r.freq, r.day, 1)[0];
      if (!due) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due.getTime() !== today.getTime()) return;
      const key = periodKey(r.freq, today);
      if (r.lastPosted === key) return;
      st.addBudgetTx({
        kind: r.kind,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.categoryId,
        date: today.toISOString().slice(0, 10),
        paidBy: r.paidBy,
        note: r.title,
      });
      st.markRecurringPosted(r.id, key);
    });
  }, []);

  if (edit) {
    const seed =
      edit === "new"
        ? {
            kind: "expense" as const,
            title: "",
            amount: 0,
            currency,
            categoryId: "",
            accountId: "",
            paidBy: "me" as const,
            freq: "month" as const,
            day: new Date().getDate(),
            mode: "confirm" as const,
            remindAt: "10:00",
          }
        : edit;
    return (
      <RecurringForm
        initial={seed}
        cats={cats}
        accounts={accounts}
        myName={myName}
        partnerName={partnerName}
        onCancel={() => setEdit(null)}
        onSave={(input) => {
          if (edit === "new") useCouple.getState().addRecurring(input);
          else useCouple.getState().updateRecurring(edit.id, input);
          setEdit(null);
        }}
        onDelete={
          edit === "new"
            ? undefined
            : () => {
                useCouple.getState().deleteRecurring(edit.id);
                setEdit(null);
              }
        }
      />
    );
  }

  return (
    <section className="px-5 pb-28">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Настройки
        </button>
        <button
          type="button"
          onClick={() => setEdit("new")}
          className="grid size-10 place-items-center rounded-2xl bg-raised"
        >
          <Plus className="size-5" />
        </button>
      </div>
      <h1 className="mt-4 text-[34px] font-semibold tracking-tight">Регулярные</h1>
      {list.length ? (
        <ul className="mt-5 overflow-hidden rounded-[24px] bg-raised">
          {list.map((r, i) => {
            const next = nextRecurringDates(r.freq, r.day, 1)[0];
            const cat = cats.find((c) => c.id === r.categoryId);
            const Icon = ICONS[cat?.icon ?? "more"] ?? MoreHorizontal;
            const due =
              r.mode === "confirm" &&
              next &&
              next <= new Date(new Date().toDateString()) &&
              r.lastPosted !== periodKey(r.freq);
            return (
              <li key={r.id} className={i ? "border-t border-line" : ""}>
                <button
                  type="button"
                  onClick={() => setEdit(r)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  <span className="grid size-11 place-items-center rounded-xl" style={{ background: cat?.color ?? "#2a2d36" }}>
                    <Icon className="size-5" style={{ color: sliceColor(r.id, cat?.color) }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title || "Платёж"}</span>
                    <span className="text-[13px] text-muted">
                      {FREQ.find((f) => f.id === r.freq)?.label.toLowerCase()}
                      {next ? ` · ${formatRuDay(toIsoDate(next), "dayMonth")}` : ""}
                    </span>
                  </span>
                  <span className={r.kind === "income" ? "text-green" : ""}>
                    {r.kind === "income" ? "+" : ""}
                    {money(r.amount, r.currency)}
                  </span>
                </button>
                {due ? (
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      useCouple.getState().addBudgetTx({
                        kind: r.kind,
                        amount: r.amount,
                        currency: r.currency,
                        categoryId: r.categoryId,
                        date: today,
                        paidBy: r.paidBy,
                        note: r.title,
                      });
                      useCouple.getState().markRecurringPosted(r.id, periodKey(r.freq));
                    }}
                    className="mb-3 ml-14 rounded-full bg-blue px-3 py-1 text-[13px] text-white"
                  >
                    Записать
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setEdit("new")}
        className="mt-4 w-full rounded-[22px] bg-raised px-4 py-4 text-left"
      >
        <span className="block text-blue">+ Регулярный платёж</span>
        <span className="text-[13px] text-muted">подписка, коммуналка, зарплата</span>
      </button>
    </section>
  );
}

function RecurringForm({
  initial,
  cats,
  accounts,
  myName,
  partnerName,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: Omit<RecurringPayment, "id" | "lastPosted">;
  cats: BudgetCategory[];
  accounts: BudgetAccount[];
  myName: string;
  partnerName: string;
  onCancel: () => void;
  onSave: (input: Omit<RecurringPayment, "id" | "lastPosted">) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [sheet, setSheet] = useState<"cat" | "acc" | "repeat" | "ccy" | "time" | null>(null);
  const colors = usePlayerColors();
  const cat = cats.find((c) => c.id === draft.categoryId);
  const acc = accounts.find((a) => a.id === draft.accountId);
  const symbol = CURRENCIES.find((c) => c.code === draft.currency)?.symbol ?? draft.currency;
  const canSave = draft.title.trim().length > 0;

  if (sheet === "ccy") {
    return (
      <CurrencyPicker
        value={draft.currency}
        onPick={(code) => {
          setDraft({ ...draft, currency: code });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    );
  }
  if (sheet === "repeat") {
    return (
      <RepeatPicker
        freq={draft.freq}
        day={draft.day}
        onChange={(freq, day) => setDraft({ ...draft, freq, day })}
        onDone={() => setSheet(null)}
      />
    );
  }

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-28">
      <SheetHeader
        flush
        title="Платёж"
        onCancel={onCancel}
        onDone={() => onSave(draft)}
        doneDisabled={!canSave}
      />

      <div className="mt-5 grid grid-cols-2 rounded-full bg-raised p-1">
        <button
          type="button"
          onClick={() => setDraft({ ...draft, kind: "expense", categoryId: "" })}
          className={`rounded-full py-2.5 ${draft.kind === "expense" ? "bg-[#2a2d36]" : "text-muted"}`}
        >
          Расход
        </button>
        <button
          type="button"
          onClick={() => setDraft({ ...draft, kind: "income", categoryId: "" })}
          className={`rounded-full py-2.5 ${draft.kind === "income" ? "bg-[#2a2d36]" : "text-muted"}`}
        >
          Доход
        </button>
      </div>

      <label className="mt-3 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">название</span>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Коммуналка"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <label className="flex-1 rounded-[22px] bg-raised px-4 py-3">
          <span className="text-[11px] tracking-[0.14em] text-muted uppercase">сумма</span>
          <input
            value={draft.amount || ""}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value.replace(",", ".")) || 0 })}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full bg-transparent text-[22px] outline-none"
          />
        </label>
        <button type="button" onClick={() => setSheet("ccy")} className="w-28 rounded-[22px] bg-raised px-3 py-3 text-left">
          <span className="text-[11px] tracking-[0.14em] text-muted uppercase">валюта</span>
          <span className="mt-1 block text-[17px] font-semibold">
            {draft.currency} {symbol}
          </span>
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-[24px] bg-raised">
        <button type="button" onClick={() => setSheet("cat")} className="flex w-full items-center justify-between px-4 py-4">
          <span>Категория</span>
          <span className="text-blue">{cat?.title ?? "Выбрать"}</span>
        </button>
        <button type="button" onClick={() => setSheet("acc")} className="flex w-full items-center justify-between border-t border-line px-4 py-4">
          <span>Счёт</span>
          <span className="text-muted">{acc?.title ?? "Без счёта"} ›</span>
        </button>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-4 py-3">
          <span className="shrink-0">{draft.kind === "income" ? "Получает" : "Платит"}</span>
          <div className="flex max-w-full flex-wrap gap-1 rounded-[22px] bg-[#14161b] p-1">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, paidBy: "me" })}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ${draft.paidBy === "me" ? "bg-[#2a2d36]" : "text-muted"}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
              <span className="break-words">{myName}</span>
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, paidBy: "partner" })}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-left text-[13px] ${draft.paidBy === "partner" ? "bg-[#2a2d36]" : "text-muted"}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
              <span className="break-words">{partnerName}</span>
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setSheet("repeat")} className="flex w-full items-center justify-between border-t border-line px-4 py-4">
          <span>Повтор</span>
          <span className="text-blue">
            {draft.freq === "month" || draft.freq === "year" ? `в день ${draft.day}` : FREQ.find((f) => f.id === draft.freq)?.label.toLowerCase()} ›
          </span>
        </button>
      </div>

      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">как записывать</p>
      <div className="mt-2 overflow-hidden rounded-[24px] bg-raised">
        <button type="button" onClick={() => setDraft({ ...draft, mode: "auto" })} className="flex w-full items-start gap-3 px-4 py-4 text-left">
          <span className={`mt-0.5 grid size-5 place-items-center rounded-full border ${draft.mode === "auto" ? "border-blue bg-blue" : "border-muted"}`}>
            {draft.mode === "auto" ? <span className="size-2 rounded-full bg-white" /> : null}
          </span>
          <span>
            <span className="block">Автоматически</span>
            <span className="text-[13px] text-muted">запись появится сама в день платежа</span>
          </span>
        </button>
        <button type="button" onClick={() => setDraft({ ...draft, mode: "confirm" })} className="flex w-full items-start gap-3 border-t border-line px-4 py-4 text-left">
          <span className={`mt-0.5 grid size-5 place-items-center rounded-full border ${draft.mode === "confirm" ? "border-blue bg-blue" : "border-muted"}`}>
            {draft.mode === "confirm" ? <span className="size-2 rounded-full bg-white" /> : null}
          </span>
          <span>
            <span className="block">Напомнить и подтвердить</span>
            <span className="text-[13px] text-muted">строка «к оплате» в месяце, одно нажатие</span>
          </span>
        </button>
      </div>

      {draft.mode === "confirm" ? (
        <button type="button" onClick={() => setSheet("time")} className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4">
          <span>Напоминание</span>
          <span className="text-blue">в {draft.remindAt}</span>
        </button>
      ) : null}

      {onDelete ? (
        <button type="button" onClick={onDelete} className="mt-6 w-full py-3 text-center text-[#f07167]">
          Удалить платёж
        </button>
      ) : null}

      {sheet === "cat" ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSheet(null)}>
          <div className="w-full rounded-t-[28px] bg-[#1c1e24] px-5 pb-10 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <div className="mt-5 grid min-w-0 grid-cols-3 gap-4 sm:grid-cols-4">
              {cats
                .filter((c) => c.kind === draft.kind && !c.hidden)
                .map((c) => (
                  <CatBtn
                    key={c.id}
                    cat={c}
                    active={draft.categoryId === c.id}
                    onClick={() => {
                      setDraft({ ...draft, categoryId: c.id, title: draft.title || c.title });
                      setSheet(null);
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {sheet === "acc" ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSheet(null)}>
          <div className="w-full rounded-t-[28px] bg-[#1c1e24] px-5 pb-10 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <button
              type="button"
              onClick={() => {
                setDraft({ ...draft, accountId: "" });
                setSheet(null);
              }}
              className="mt-4 w-full rounded-[22px] bg-raised px-4 py-4 text-left"
            >
              Без счёта
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setDraft({ ...draft, accountId: a.id });
                  setSheet(null);
                }}
                className="mt-2 w-full rounded-[22px] bg-raised px-4 py-4 text-left"
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sheet === "time" ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSheet(null)}>
          <div className="w-full rounded-t-[28px] bg-[#1c1e24] px-5 pb-10 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            {["08:00", "09:00", "10:00", "12:00", "18:00", "20:00"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setDraft({ ...draft, remindAt: t });
                  setSheet(null);
                }}
                className="mt-2 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
              >
                <span>{t}</span>
                {draft.remindAt === t ? <span className="text-blue">✓</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RepeatPicker({
  freq,
  day,
  onChange,
  onDone,
}: {
  freq: RecurringPayment["freq"];
  day: number;
  onChange: (freq: RecurringPayment["freq"], day: number) => void;
  onDone: () => void;
}) {
  const upcoming = nextRecurringDates(freq, day, 3);
  const days = freq === "week" || freq === "biweek" ? [1, 2, 3, 4, 5, 6, 7] : Array.from({ length: 31 }, (_, i) => i + 1);
  const weekNames = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  return (
    <section className="px-5 pb-28">
      <div className="relative flex items-center pt-5">
        <button type="button" onClick={onDone} className="relative z-10 text-muted">
          ‹ Платёж
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold">Повтор</h1>
        <button type="button" onClick={onDone} className="relative z-10 ml-auto text-blue">
          Готово
        </button>
      </div>
      <ul className="mt-5 overflow-hidden rounded-[24px] bg-raised">
        {FREQ.map((f, i) => (
          <li key={f.id} className={i ? "border-t border-line" : ""}>
            <button
              type="button"
              onClick={() => onChange(f.id, f.id === "week" || f.id === "biweek" ? Math.min(day, 7) : day)}
              className="flex w-full items-center justify-between px-4 py-4"
            >
              <span>{f.label}</span>
              {freq === f.id ? <span className="text-blue">✓</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-[24px] bg-raised px-4 py-4">
        <p className="text-[12px] tracking-[0.14em] text-muted uppercase">
          {freq === "week" || freq === "biweek" ? "день недели" : "день месяца"}
        </p>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {days.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(freq, n)}
              className={`h-10 rounded-full text-[15px] ${day === n ? "bg-blue text-white" : "bg-[#14161b]"}`}
            >
              {freq === "week" || freq === "biweek" ? weekNames[n - 1] : n}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-[24px] bg-raised px-4 py-4">
        <p className="text-[12px] tracking-[0.14em] text-muted uppercase">ближайшие</p>
        <ul className="mt-2 space-y-2 text-[16px]">
          {upcoming.map((d, i) => (
            <li key={d.toISOString()} className={i ? "text-muted" : ""}>
              {formatRuWeekdayShort(d)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
