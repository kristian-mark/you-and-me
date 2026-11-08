import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Eye, Lock, Shield, Sparkles, X } from "lucide-react";
import { useCouple, viewedWishOwner, type Person } from "@/lib/couple-store";
import { leaveSharedPair } from "@/lib/leave-pair";

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function dayLabel(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

function personDay(iso: string, noYear?: boolean) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  if (noYear) return `${d} ${MONTHS_SHORT[m - 1]}`;
  return `${d} ${MONTHS_SHORT[m - 1]} · ${y}`;
}

export function UsScreen({ onClose }: { onClose: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const anniversary = useCouple((s) => s.anniversaryDate || "2021-03-24");
  const wishes = useCouple((s) => s.wishes);
  const cards = useCouple((s) => s.cards);
  const tasks = useCouple((s) => s.tasks);
  const notes = useCouple((s) => s.notes);
  const [page, setPage] = useState<"hub" | "settings" | "year">("hub");
  const year = new Date().getFullYear();

  const stats = useMemo(() => {
    const start = new Date(anniversary);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
    let next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, start.getMonth(), start.getDate());
    const until = Math.round((next.getTime() - now.getTime()) / 86400000);
    const n = now.getFullYear() - start.getFullYear() + (next.getFullYear() > now.getFullYear() ? 0 : 1);
    return { days, until, ordinal: n <= 0 ? 1 : n };
  }, [anniversary]);

  const fulfilled = wishes.filter((w) => w.fulfilled && (w.fulfilledAt ?? "").startsWith(String(year))).length;
  const closed = tasks.filter((t) => t.done && (t.dueDate ?? t.createdAt).startsWith(String(year))).length;

  if (page === "settings") {
    return <CoupleSettings onBack={() => setPage("hub")} />;
  }
  if (page === "year") {
    return <YearScreen year={year} onBack={() => setPage("hub")} />;
  }

  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg px-5 pb-16 pt-6">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">
        {myName} и {partnerName}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[34px] font-semibold tracking-tight">Мы</h1>
        <div className="flex items-center gap-2">
          <span className="relative h-5 w-8">
            <span className="absolute left-0 top-0.5 size-4 rounded-full bg-blue" />
            <span className="absolute right-0 top-0.5 size-4 rounded-full bg-pink" />
          </span>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-raised" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <button type="button" className="mt-6 w-full rounded-[24px] bg-raised px-4 py-4 text-left">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Camera className="size-5" />
            <span className="font-medium">Фото на главном экране</span>
          </span>
          <Lock className="size-4 text-muted" />
        </div>
        <p className="mt-2 text-[14px] leading-5 text-muted">
          Партнёр выбирает фото — оно появляется у тебя на главном экране. Меняется в течение часа, без уведомлений и переписок.
        </p>
        <p className="mt-3 flex items-center justify-between text-[14px] text-muted">
          <span>Доступно в Premium</span>
          <span>›</span>
        </p>
      </button>

      <div className="mt-3 grid grid-cols-2 rounded-[24px] bg-raised px-4 py-5">
        <div>
          <p className="text-[40px] font-semibold leading-none">{stats.days}</p>
          <p className="mt-2 text-[13px] text-muted">дней вместе</p>
        </div>
        <div className="border-l border-line pl-4">
          <p className="text-[40px] font-semibold leading-none text-[#f07167]">{stats.until}</p>
          <p className="mt-2 text-[13px] text-muted">до {stats.ordinal}-й годовщины</p>
        </div>
      </div>

      <button type="button" onClick={() => setPage("year")} className="mt-3 w-full rounded-[24px] bg-raised px-4 py-4 text-left">
        <div className="flex items-center justify-between">
          <p className="text-[12px] tracking-[0.14em] text-muted uppercase">наш {year}</p>
          <span className="text-[14px] text-blue">Смотреть ›</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat n={fulfilled} label={"хотелок\nисполнено"} />
          <Stat n={0} label={"поездок\nвместе"} />
          <Stat n={closed} label={"планов\nзакрыто"} />
          <Stat n={notes.length} label={"файлов\nдобавлено"} />
        </div>
      </button>

      <div className="mt-3 grid grid-cols-3 rounded-[24px] bg-raised px-4 py-4 text-center">
        <Stat n={wishes.length} label={"хотелок\nв списках"} />
        <Stat n={0} label={"файлов\noffline"} />
        <Stat n={cards.length} label={"карт\nлояльности"} />
      </div>

      <button type="button" className="mt-3 flex w-full items-center justify-between rounded-[24px] bg-raised px-4 py-4">
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-blue" />
          Premium
        </span>
        <span className="text-muted">›</span>
      </button>

      <button type="button" onClick={() => setPage("settings")} className="mt-3 flex w-full items-center justify-between rounded-[24px] bg-raised px-4 py-4">
        <span>Настройки пары</span>
        <span className="text-muted">›</span>
      </button>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-[28px] font-semibold leading-none">{n}</p>
      <p className="mt-2 whitespace-pre-line text-[12px] leading-4 text-muted">{label}</p>
    </div>
  );
}

const MONTH_FULL = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];

function YearScreen({ year, onBack }: { year: number; onBack: () => void }) {
  const anniversary = useCouple((s) => s.anniversaryDate || "2021-03-24");
  const wishes = useCouple((s) => s.wishes);
  const tasks = useCouple((s) => s.tasks);
  const notes = useCouple((s) => s.notes);
  const myUserId = useCouple((s) => s.myUserId);
  const prefix = String(year);
  const doneWishes = wishes.filter((w) => w.fulfilled && (w.fulfilledAt ?? w.createdAt).startsWith(prefix));
  const mine = doneWishes.filter((w) => viewedWishOwner(w, myUserId) === "me").length;
  const latest = [...doneWishes].sort((a, b) => (b.fulfilledAt ?? b.createdAt).localeCompare(a.fulfilledAt ?? a.createdAt))[0];
  const latestMonth = latest ? MONTH_FULL[Number((latest.fulfilledAt ?? latest.createdAt).slice(5, 7)) - 1] : "";
  const closed = tasks.filter((t) => t.done && (t.dueDate ?? t.createdAt).startsWith(prefix)).length;
  const files = notes.filter((n) => n.createdAt.startsWith(prefix)).length;
  const start = new Date(anniversary);
  const end = new Date(year, 11, 31);
  const daysEnd = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  const counts = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return (
      wishes.filter((w) => (w.fulfilledAt ?? w.createdAt).startsWith(key)).length +
      tasks.filter((t) => (t.dueDate ?? t.createdAt).startsWith(key)).length +
      notes.filter((n) => n.createdAt.startsWith(key)).length
    );
  });
  const max = Math.max(1, ...counts);
  const busy = counts.reduce((best, n, i) => (n >= counts[best] ? i : best), 0);
  const share = async () => {
    const text = `Наш ${year}: ${doneWishes.length} хотелок исполнилось, ${daysEnd.toLocaleString("en-US")} дней вместе к концу года.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };
  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg px-5 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-[17px] text-muted">
          ‹ Мы
        </button>
        <button type="button" onClick={share} className="text-[17px] text-blue">
          Поделиться
        </button>
      </div>
      <h1 className="mt-5 text-[34px] font-semibold tracking-tight">Наш {year}</h1>
      <p className="mt-2 text-[16px] leading-6 text-muted">
        Считаем только то, что вы сами добавили. Ничего не выдумываем.
      </p>

      <div className="mt-5 rounded-[24px] bg-[#e07a72] px-5 py-5 text-black">
        <div className="flex items-start justify-between">
          <p className="text-[52px] font-semibold leading-none">{doneWishes.length}</p>
          <div className="pt-2 text-right">
            <p className="text-[28px] font-semibold leading-none">{daysEnd.toLocaleString("en-US")}</p>
            <p className="mt-1 max-w-[140px] text-[12px] leading-4 text-black/55">дней вместе к концу года</p>
          </div>
        </div>
        <p className="mt-4 text-[22px] font-semibold leading-6">хотелок сбылось</p>
        <p className="mt-1 text-[14px] leading-5 text-black/70">
          {mine} твоих
          {latest ? ` · последнее — ${latest.title} в ${latestMonth}` : ""}
        </p>
      </div>

      <div className="mt-3 overflow-hidden rounded-[24px] bg-raised">
        <Row label="Закрытых поездок" value="0" />
        <Row label="Закрытых планов" value={String(closed)} />
        <Row label="Сбылось из планов" value="—" />
        <Row label="Добавлено файлов" value={String(files)} last />
      </div>

      <div className="mt-3 rounded-[24px] bg-raised px-4 py-4">
        <p className="text-[12px] tracking-[0.14em] text-muted uppercase">самый плотный месяц</p>
        <div className="mt-6 flex h-16 items-end gap-1.5">
          {counts.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end">
              {n > 0 ? (
                <div className="w-4 rounded-sm bg-[#e07a72]" style={{ height: `${Math.max(18, (n / max) * 48)}px` }} />
              ) : (
                <div className="h-0.5 w-full rounded-full bg-[#3a3d46]" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
          <span>янв</span>
          <span className="text-[#e07a72]">
            {MONTHS_SHORT[busy]} — {counts[busy]} запис
            {counts[busy] === 1 ? "ь" : counts[busy] > 1 && counts[busy] < 5 ? "и" : "ей"}
          </span>
          <span>дек</span>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-4 ${last ? "" : "border-b border-line"}`}>
      <span className="text-[16px]">{label}</span>
      <span className="text-[16px] text-muted">{value}</span>
    </div>
  );
}

function CoupleSettings({ onBack }: { onBack: () => void }) {
  const pairCode = useCouple((s) => s.pairCode);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const people = useCouple((s) => s.people);
  const anniversary = useCouple((s) => s.anniversaryDate || "2021-03-24");
  const [page, setPage] = useState<"hub" | "people" | "dates" | "leave" | "name">("hub");
  if (page === "people") return <PeopleScreen onBack={() => setPage("hub")} />;
  if (page === "dates") return <DatesScreen onBack={() => setPage("hub")} />;
  if (page === "leave") return <LeaveScreen onBack={() => setPage("hub")} />;
  if (page === "name") return <NameScreen onBack={() => setPage("hub")} />;
  const bits = myName.trim().split(/\s+/);
  const first = bits[0] ?? myName;
  const rest = bits.slice(1).join(" ");
  const since = anniversary;
  const pretty = `${since.slice(5, 7)}/${since.slice(8, 10)}/${since.slice(0, 4)}`;
  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg px-5 pb-16 pt-6">
      <button type="button" onClick={onBack} className="text-muted">
        ‹ Мы
      </button>
      <h1 className="mt-4 text-[34px] font-semibold tracking-tight">Настройки пары</h1>

      <div className="mt-5 overflow-hidden rounded-[24px] bg-raised px-4">
        <div className="flex items-center gap-3 py-4">
          <span className="size-14 shrink-0 rounded-full bg-blue" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] leading-5">{first}</p>
            {rest ? <p className="text-[17px] leading-5">{rest}</p> : null}
            <p className="mt-1 text-[13px] leading-4 text-muted">создал общее пространство</p>
          </div>
          <button type="button" onClick={() => setPage("name")} className="shrink-0 text-[15px] text-blue">
            изменить ›
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-line py-4">
          <span className="size-14 shrink-0 rounded-full bg-pink" />
          <div>
            <p className="text-[17px]">{partnerName}</p>
            <p className="mt-1 text-[13px] text-muted">в приложении с 05/11/2026</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">наши даты</p>
      <button
        type="button"
        onClick={() => setPage("dates")}
        className="mt-2 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Вместе с</span>
        <span className="text-muted">{pretty} ›</span>
      </button>

      <button
        type="button"
        onClick={() => setPage("people")}
        className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Люди</span>
        <span className="flex items-center gap-2 text-muted">
          {people.length ? people.length : ""}
          ›
        </span>
      </button>

      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <p className="text-[13px] text-muted">Код пары</p>
        <p className="mt-2 text-[28px] font-semibold tracking-[0.18em] text-pink">
          {(pairCode ?? "").split("").join(" ")}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setPage("leave")}
        className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Выйти из пары</span>
        <span className="text-muted">›</span>
      </button>
    </section>
  );
}

function NameScreen({ onBack }: { onBack: () => void }) {
  const myName = useCouple((s) => s.myName);
  const [value, setValue] = useState(myName);
  return (
    <section className="fixed inset-0 z-[80] bg-bg px-5 pt-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-muted">
          Отмена
        </button>
        <p className="text-[17px] font-semibold">Имя</p>
        <button
          type="button"
          onClick={() => {
            useCouple.getState().setMyName(value);
            onBack();
          }}
          className="text-blue"
        >
          Готово
        </button>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-8 w-full rounded-[22px] bg-raised px-4 py-4 text-[17px] outline-none"
      />
    </section>
  );
}

function PeopleScreen({ onBack }: { onBack: () => void }) {
  const people = useCouple((s) => s.people);
  const anniversary = useCouple((s) => s.anniversaryDate || "2021-03-24");
  const [edit, setEdit] = useState<(typeof people)[number] | "new" | null>(null);
  return (
    <section className="fixed inset-0 z-[80] flex flex-col bg-bg px-5 pb-10 pt-4">
      <div className="flex h-11 items-center justify-between">
        <button type="button" onClick={onBack} className="text-[17px] text-muted">
          ‹ Назад
        </button>
        <button type="button" onClick={() => setEdit("new")} className="grid size-11 place-items-center text-[28px] leading-none">
          +
        </button>
      </div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-tight">Люди</h1>
      <p className="mt-3 text-[16px] leading-[22px] text-muted">
        Их дни рождения сами появляются в календаре. Храним только имя, дату и кем приходится.
      </p>

      {people.length ? (
        <ul className="mt-5 space-y-2">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setEdit(p)}
                className="flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-[14px] text-left"
              >
                <span>
                  <span className="block text-[16px]">{p.name}</span>
                  {p.relation ? <span className="text-[13px] text-muted">{p.relation}</span> : null}
                </span>
                <span className="text-[15px] text-muted">{personDay(p.date, p.noYear)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-16 px-2 text-center text-[16px] leading-[22px] text-muted">
          Пока никого. Добавь тех, чьи дни рождения не хочется забыть.
        </p>
      )}

      <p className={`${people.length ? "mt-8" : "mt-16"} text-[12px] tracking-[0.16em] text-muted uppercase`}>из профилей</p>
      <div className="mt-2 flex items-center justify-between rounded-[22px] bg-raised px-4 py-[14px]">
        <span className="flex items-center gap-2.5 text-[16px]">
          <span className="text-[15px] text-[#f07167]">♥</span>
          Годовщина пары
        </span>
        <span className="text-[15px] text-muted">{dayLabel(anniversary)}</span>
      </div>

      {edit ? (
        <PersonForm
          initial={edit === "new" ? null : edit}
          onCancel={() => setEdit(null)}
          onSave={(row) => {
            if (edit === "new") useCouple.getState().addPerson(row);
            else useCouple.getState().updatePerson(edit.id, row);
            setEdit(null);
          }}
        />
      ) : null}
    </section>
  );
}

function prettyDate(iso: string, noYear: boolean) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return noYear ? `${d} ${months[m - 1]}` : `${d} ${months[m - 1]} ${y}`;
}

function PersonForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Person | null;
  onCancel: () => void;
  onSave: (row: { name: string; date: string; relation: string; note: string; noYear: boolean }) => void;
}) {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [name, setName] = useState(initial?.name ?? "");
  const [relation, setRelation] = useState(initial?.relation ?? "");
  const [date, setDate] = useState(initial?.date ?? iso);
  const [noYear, setNoYear] = useState(initial?.noYear ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [cal, setCal] = useState(false);
  const ready = name.trim().length > 0;
  return (
    <section className="fixed inset-0 z-[90] overflow-y-auto bg-bg px-5 pb-10 pt-4">
      <button type="button" onClick={onCancel} className="grid size-11 place-items-center rounded-full bg-raised text-[20px]">
        ‹
      </button>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={onCancel} className="text-[17px] text-muted">
          Отмена
        </button>
        <p className="text-[17px] font-semibold">Человек</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSave({ name: name.trim(), date, relation: relation.trim(), note: note.trim(), noYear })}
          className={`text-[17px] ${ready ? "text-blue" : "text-muted"}`}
        >
          Готово
        </button>
      </div>

      <label className="mt-5 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">имя</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как зовут"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      <label className="mt-3 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">кем приходится</span>
        <input
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder="мама Софии, друг…"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      <button
        type="button"
        onClick={() => setCal(true)}
        className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span className="text-[16px]">Дата рождения</span>
        <span className="text-[16px] text-blue">{prettyDate(date, noYear)}</span>
      </button>

      <div className="mt-3 flex items-center justify-between rounded-[22px] bg-raised px-4 py-4">
        <span>
          <span className="block text-[16px]">Не знаю год</span>
          <span className="text-[13px] text-muted">тогда без «68 лет», только дата</span>
        </span>
        <button
          type="button"
          onClick={() => setNoYear(!noYear)}
          className={`h-7 w-12 shrink-0 rounded-full ${noYear ? "bg-green" : "bg-[#3a3d46]"}`}
        >
          <span className={`block size-6 rounded-full bg-white transition ${noYear ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <label className="mt-3 block min-h-[110px] rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">заметка</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Что дарить, что не любят"
          rows={3}
          className="mt-1 w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      <p className="mt-3 flex items-start gap-3 rounded-[22px] bg-raised px-4 py-4 text-[14px] leading-5 text-muted">
        <Shield className="mt-0.5 size-5 shrink-0" />
        Это чужие данные — храним минимум. Никаких телефонов и адресов, и не будет.
      </p>
      {cal ? (
        <DarkCal
          value={date}
          onPick={(day) => {
            setDate(day);
            setCal(false);
          }}
          onClose={() => setCal(false)}
        />
      ) : null}
    </section>
  );
}

const MONTHS_FULL = [
  "январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь",
];

function DarkCal({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (day: string) => void;
  onClose: () => void;
}) {
  const [y, m] = value.split("-").map(Number);
  const [cursor, setCursor] = useState({ y: y || new Date().getFullYear(), m: m || new Date().getMonth() + 1 });
  const first = new Date(cursor.y, cursor.m - 1, 1);
  const start = (first.getDay() + 6) % 7;
  const count = new Date(cursor.y, cursor.m, 0).getDate();
  const cells = Array.from({ length: start + count }, (_, i) => {
    if (i < start) return "";
    const d = i - start + 1;
    return `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const prev = () =>
    setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }));
  const next = () =>
    setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }));
  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-[28px] bg-[#1c1e24] px-5 pb-8 pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={prev} className="grid size-10 place-items-center rounded-full bg-raised">
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-[17px] font-semibold capitalize">
            {MONTHS_FULL[cursor.m - 1]} {cursor.y}
          </p>
          <button type="button" onClick={next} className="grid size-10 place-items-center rounded-full bg-raised">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted">
          {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {cells.map((key, i) =>
            key ? (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                className={`mx-auto grid size-10 place-items-center rounded-full text-[16px] ${
                  key === value ? "bg-blue text-white" : "text-fg"
                }`}
              >
                {Number(key.slice(8))}
              </button>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const n = new Date();
            onPick(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
          }}
          className="mt-4 w-full py-3 text-[16px] text-blue"
        >
          Сегодня
        </button>
      </div>
    </div>
  );
}

function DatesScreen({ onBack }: { onBack: () => void }) {
  const anniversary = useCouple((s) => s.anniversaryDate);
  const gettingMarried = useCouple((s) => s.gettingMarried);
  const partnerName = useCouple((s) => s.partnerName);
  const [date, setDate] = useState(anniversary);
  const [marry, setMarry] = useState(gettingMarried);
  const [cal, setCal] = useState(false);
  const pretty = date
    ? `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`
    : "не указана";
  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg px-5 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-muted">
          Отмена
        </button>
        <p className="text-[17px] font-semibold">Наши даты</p>
        <button
          type="button"
          onClick={() => {
            useCouple.getState().setAnniversaryDate(date);
            useCouple.getState().setGettingMarried(marry);
            onBack();
          }}
          className="text-blue"
        >
          Готово
        </button>
      </div>
      <button
        type="button"
        onClick={() => setCal(true)}
        className="mt-6 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4 text-left"
      >
        <span>
          <span className="block">Вместе с</span>
          <span className="text-[13px] text-muted">когда всё началось</span>
        </span>
        <span className="text-blue">{pretty}</span>
      </button>
      <p className="mt-3 rounded-[22px] bg-raised px-4 py-4 text-[15px] text-muted">
        Оставь пустым — считаем со дня, когда связались в приложении
      </p>
      <div className="mt-3 flex items-center justify-between rounded-[22px] bg-[#e07a72] px-4 py-4 text-black">
        <span>
          <span className="block font-semibold">Мы женимся!</span>
          <span className="text-[13px] opacity-80">появится обратный отсчёт, а после — «женаты столько»</span>
        </span>
        <button
          type="button"
          onClick={() => setMarry(!marry)}
          className={`h-7 w-12 shrink-0 rounded-full ${marry ? "bg-white/80" : "bg-white/35"}`}
        >
          <span className={`block size-6 rounded-full bg-white transition ${marry ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-[22px] bg-raised px-4 py-4 text-[14px] text-muted">
        <Eye className="mt-0.5 size-4 shrink-0" />
        Даты общие: {partnerName} видит их сразу и может менять.
      </p>
      {cal ? (
        <DarkCal
          value={date || "2021-03-24"}
          onPick={(day) => {
            setDate(day);
            setCal(false);
          }}
          onClose={() => setCal(false)}
        />
      ) : null}
    </section>
  );
}

function LeaveScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="fixed inset-0 z-[80] flex flex-col bg-bg px-5 pb-8 pt-6">
      <button type="button" onClick={onBack} className="text-left text-muted">
        ‹ Настройки пары
      </button>
      <h1 className="mt-5 text-[34px] font-semibold tracking-tight">Выйти из пары</h1>
      <p className="mt-3 text-[16px] leading-6 text-muted">
        У каждого остаётся только своё. Общее удаляется у обоих.
      </p>
      <p className="mt-8 text-[12px] tracking-[0.14em] text-muted uppercase">останется у тебя</p>
      <div className="mt-2 rounded-[22px] bg-raised px-4 py-4">
        <p className="flex gap-2">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-[#7dce7a]" />
          Хотелки, заметки, задачи и файлы, которые добавлял сам
        </p>
      </div>
      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">удалится у обоих</p>
      <div className="mt-2 space-y-3 rounded-[22px] bg-raised px-4 py-4">
        <p className="flex gap-2">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-[#e07a4a]" />
          Календарь пары, планы с тратами, карты, люди, капсулы и общие фото
        </p>
        <p className="flex gap-2">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-[#e07a4a]" />
          Записи партнёра у тебя и твои — у партнёра
        </p>
      </div>
      <p className="mt-4 text-[14px] leading-5 text-muted">
        Удалённое не вернуть. Связаться снова можно когда угодно, но общее начнётся с нуля.
      </p>
      <button
        type="button"
        onClick={() => void leaveSharedPair().then(onBack).catch(() => undefined)}
        className="mt-auto w-full rounded-full bg-[#d45a1f] py-4 text-[17px] font-semibold"
      >
        Выйти из пары
      </button>
    </section>
  );
}
