import { useMemo, useState } from "react";
import { Camera, Eye, Lock, Shield, Sparkles, X } from "lucide-react";
import { AccountLogoutButton } from "@/components/account-logout";
import { DatePicker } from "@/components/date-picker";
import { PairCode } from "@/components/pair-code";
import { SheetHeader } from "@/components/sheet-header";
import { formatRuDay, RU_MONTHS, RU_MONTHS_SHORT, togetherChoiceLabel, toIsoDate } from "@/lib/dates";
import { useCouple, usePlayerColors, viewedWishOwner, type Person } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";
import { leaveSharedPair } from "@/lib/leave-pair";
import { refreshPairTasks, refreshPairWishes } from "@/lib/pair-live";
import { LIST_POLL_MS, useScreenPoll } from "@/lib/screen-poll";
import { anniversaryCountdown, FALLBACK_MY_NAME, isoDay, togetherDay } from "@/lib/pair-identity";
import { saveMyProfile, saveTogetherSince } from "@/lib/pair-server";

export function UsScreen({ onClose }: { onClose: () => void }) {
  useScreenPoll("tasks", true, LIST_POLL_MS, refreshPairTasks);
  useScreenPoll("wishes", true, LIST_POLL_MS, refreshPairWishes);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const anniversary = useCouple((s) => s.anniversaryDate);
  const pairedAt = useCouple((s) => s.pairedAt);
  const together = togetherDay(anniversary, pairedAt);
  const wishes = useCouple((s) => s.wishes);
  const cards = useCouple((s) => s.cards);
  const tasks = useCouple((s) => s.tasks);
  const notes = useCouple((s) => s.notes);
  const [page, setPage] = useState<"hub" | "settings" | "year">("hub");
  const colors = usePlayerColors();
  const year = new Date().getFullYear();

  const stats = useMemo(() => (together ? anniversaryCountdown(together) : null), [together]);

  const fulfilled = wishes.filter((w) => w.fulfilled && (w.fulfilledAt ?? "").startsWith(String(year))).length;
  const closed = tasks.filter((t) => t.done && (t.dueDate ?? t.createdAt).startsWith(String(year))).length;

  if (page === "settings") {
    return <CoupleSettings onBack={() => setPage("hub")} />;
  }
  if (page === "year") {
    return <YearScreen year={year} onBack={() => setPage("hub")} />;
  }

  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg">
      <div className="app-sheet px-5 pb-8">
      <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 pt-6 pb-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">
        {myName} и {partnerName}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[34px] font-semibold tracking-tight">Мы</h1>
        <div className="flex items-center gap-2">
          <span className="relative h-5 w-8">
            <span className={`absolute left-0 top-0.5 size-4 rounded-full ${pieceBg(colors.me)}`} />
            <span className={`absolute right-0 top-0.5 size-4 rounded-full ${pieceBg(colors.partner)}`} />
          </span>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-raised" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
      </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-3">
      <button type="button" className="mt-3 w-full rounded-[24px] bg-raised px-4 py-4 text-left md:mt-0">
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

      <div className="mt-3 grid grid-cols-2 rounded-[24px] bg-raised px-4 py-5 md:col-span-2">
        <div>
          <p className="text-[40px] font-semibold leading-none">{stats ? stats.daysTogether : "—"}</p>
          <p className="mt-2 text-[13px] text-[#e6e1d6]">{stats ? "дней вместе" : "дата не указана"}</p>
        </div>
        <div className="border-l border-line pl-4">
          {stats?.celebrating ? (
            <>
              <p className="text-[28px] font-semibold leading-none text-cream">Сегодня</p>
              <p className="mt-2 text-[13px] text-[#e6e1d6]">{stats.ordinal}-я годовщина</p>
            </>
          ) : (
            <>
              <p className="text-[40px] font-semibold leading-none text-[#f07167]">{stats?.daysUntil ?? "—"}</p>
              <p className="mt-2 text-[13px] text-[#e6e1d6]">
                {stats ? `до ${stats.ordinal}-й годовщины` : "укажите в настройках"}
              </p>
            </>
          )}
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

      <button type="button" onClick={() => setPage("settings")} className="mt-3 flex w-full items-center justify-between rounded-[24px] bg-raised px-4 py-4 md:col-span-2">
        <span>Настройки пары</span>
        <span className="text-muted">›</span>
      </button>
      </div>
      </div>
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

function YearScreen({ year, onBack }: { year: number; onBack: () => void }) {
  const anniversary = useCouple((s) => s.anniversaryDate);
  const pairedAt = useCouple((s) => s.pairedAt);
  const together = togetherDay(anniversary, pairedAt) ?? `${year}-01-01`;
  const wishes = useCouple((s) => s.wishes);
  const tasks = useCouple((s) => s.tasks);
  const notes = useCouple((s) => s.notes);
  const myUserId = useCouple((s) => s.myUserId);
  const prefix = String(year);
  const doneWishes = wishes.filter((w) => w.fulfilled && (w.fulfilledAt ?? w.createdAt).startsWith(prefix));
  const mine = doneWishes.filter((w) => viewedWishOwner(w, myUserId) === "me").length;
  const latest = [...doneWishes].sort((a, b) => (b.fulfilledAt ?? b.createdAt).localeCompare(a.fulfilledAt ?? a.createdAt))[0];
  const latestMonth = latest ? RU_MONTHS[Number((latest.fulfilledAt ?? latest.createdAt).slice(5, 7)) - 1] : "";
  const closed = tasks.filter((t) => t.done && (t.dueDate ?? t.createdAt).startsWith(prefix)).length;
  const files = notes.filter((n) => n.createdAt.startsWith(prefix)).length;
  const start = new Date(`${together}T12:00:00`);
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
            {RU_MONTHS_SHORT[busy]} — {counts[busy]} запис
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
  const inviteCode = useCouple((s) => s.inviteCode);
  const joined = useCouple((s) => s.joined);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const pairedAt = useCouple((s) => s.pairedAt);
  const people = useCouple((s) => s.people);
  const anniversary = useCouple((s) => s.anniversaryDate);
  const gettingMarried = useCouple((s) => s.gettingMarried);
  const weddingDate = useCouple((s) => s.weddingDate);
  const choice = togetherChoiceLabel(anniversary, pairedAt);
  const colors = usePlayerColors();
  const [page, setPage] = useState<"hub" | "people" | "dates" | "leave" | "name">("hub");
  if (page === "people") return <PeopleScreen onBack={() => setPage("hub")} />;
  if (page === "dates") return <DatesScreen onBack={() => setPage("hub")} />;
  if (page === "leave") return <LeaveScreen onBack={() => setPage("hub")} />;
  if (page === "name") return <NameScreen onBack={() => setPage("hub")} />;
  const bits = myName.trim().split(/\s+/);
  const first = bits[0] ?? myName;
  const rest = bits.slice(1).join(" ");
  const connected = togetherDay(null, pairedAt);
  const joinedLabel = connected ? `в приложении с ${formatRuDay(connected, "numeric")}` : "в паре";
  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg">
      <div className="app-sheet px-5 pb-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-muted">
        ‹ Мы
      </button>
      <h1 className="mt-4 text-[34px] font-semibold tracking-tight">Настройки пары</h1>
      <AccountLogoutButton />

      <div className="mt-5 overflow-hidden rounded-[24px] bg-raised px-4">
        <div className="flex items-center gap-3 py-4">
          <span className={`size-14 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
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
          <span className={`size-14 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
          <div>
            <p className="text-[17px]">{partnerName}</p>
            <p className="mt-1 text-[13px] text-[#e6e1d6]">{joinedLabel}</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">наши даты</p>
      <button
        type="button"
        onClick={() => setPage("dates")}
        className="mt-2 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span className="min-w-0 text-left">
          <span className="block">Вместе с</span>
          {choice.hint ? <span className="block text-[13px] text-muted">{choice.hint}</span> : null}
        </span>
        <span className="shrink-0 text-muted">{choice.value} ›</span>
      </button>
      {gettingMarried ? (
        <button
          type="button"
          onClick={() => setPage("dates")}
          className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
        >
          <span>Свадьба</span>
          <span className="text-muted">{weddingDate ? formatRuDay(weddingDate, "long") : "не указана"} ›</span>
        </button>
      ) : null}

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

      <div className="mt-3">
        <PairCode
          code={inviteCode}
          label="Твой код"
          hint={
            joined
              ? "Пара уже собрана. Этим кодом партнёр вошёл. Новый человек по нему не подключится."
              : "Партнёр вводит этот код у себя. В паре только двое."
          }
        />
      </div>

      <button
        type="button"
        onClick={() => setPage("leave")}
        className="mt-3 flex min-h-11 w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Выйти из пары</span>
        <span className="text-muted">›</span>
      </button>
      </div>
    </section>
  );
}

function NameScreen({ onBack }: { onBack: () => void }) {
  const myName = useCouple((s) => s.myName);
  const [value, setValue] = useState(myName === FALLBACK_MY_NAME ? "" : myName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const next = value.trim();
    if (!next || saving) return;
    setSaving(true);
    setError("");
    useCouple.getState().setMyName(next);
    try {
      const saved = await saveMyProfile({ data: { displayName: next } });
      if (saved.displayName) useCouple.getState().setMyName(saved.displayName);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Имя не сохранилось");
      setSaving(false);
    }
  };
  return (
    <section className="fixed inset-0 z-[80] bg-bg px-5">
      <SheetHeader flush title="Имя" onCancel={onBack} onDone={() => void save()} doneDisabled={!value.trim() || saving} />
      <label className="mt-4 block rounded-[22px] bg-raised px-4 py-3">
        <span className="text-[11px] tracking-[0.14em] text-muted uppercase">как тебя видит партнёр</span>
        <input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="Имя"
          className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>
      {error ? <p className="mt-3 text-[14px] text-[#e07a72]">{error}</p> : null}
    </section>
  );
}

function PeopleScreen({ onBack }: { onBack: () => void }) {
  const people = useCouple((s) => s.people);
  const anniversaryDate = useCouple((s) => s.anniversaryDate);
  const anniversary = isoDay(anniversaryDate);
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
                <span className="text-[15px] text-muted">
                  {formatRuDay(p.date, p.noYear ? "dayMonth" : "long")}
                </span>
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
        <span className="text-[15px] text-muted">{anniversary ? formatRuDay(anniversary, "dayMonth") : "не указана"}</span>
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

function PersonForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Person | null;
  onCancel: () => void;
  onSave: (row: { name: string; date: string; relation: string; note: string; noYear: boolean }) => void;
}) {
  const iso = toIsoDate(new Date());
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
      <SheetHeader
        flush
        pad={false}
        title="Человек"
        onCancel={onCancel}
        doneDisabled={!ready}
        onDone={() => onSave({ name: name.trim(), date, relation: relation.trim(), note: note.trim(), noYear })}
      />

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
        <span className="text-[16px] text-blue">{formatRuDay(date, noYear ? "dayMonth" : "long")}</span>
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
        <DatePicker
          mode="birthday"
          label="Дата рождения"
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

function DatesScreen({ onBack }: { onBack: () => void }) {
  const anniversary = useCouple((s) => s.anniversaryDate);
  const pairedAt = useCouple((s) => s.pairedAt);
  const gettingMarried = useCouple((s) => s.gettingMarried);
  const storedWedding = useCouple((s) => s.weddingDate);
  const partnerName = useCouple((s) => s.partnerName);
  const [date, setDate] = useState(anniversary);
  const [marry, setMarry] = useState(gettingMarried);
  const [wedding, setWedding] = useState(storedWedding);
  const [pick, setPick] = useState<"together" | "wedding" | null>(null);
  const anchor = togetherDay(null, pairedAt) ?? toIsoDate(new Date());
  return (
    <section className="fixed inset-0 z-[80] overflow-y-auto bg-bg px-5 pb-16">
      <SheetHeader
        flush
        title="Наши даты"
        onCancel={onBack}
        onDone={() => {
          useCouple.getState().setAnniversaryDate(date);
          useCouple.getState().setGettingMarried(marry, wedding);
          void saveTogetherSince({ data: date || null }).catch(() => undefined);
          onBack();
        }}
      />
      <button
        type="button"
        onClick={() => setPick("together")}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-[22px] bg-raised px-4 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block">Вместе с</span>
          <span className="text-[13px] text-muted">когда всё началось</span>
        </span>
        <span className="shrink-0 text-blue">{date ? formatRuDay(date, "long") : "не указана"}</span>
      </button>
      <p className="mt-3 rounded-[22px] bg-raised px-4 py-4 text-[15px] text-muted">
        Оставь пустым — считаем со дня, когда связались в приложении
        {anchor ? ` (${formatRuDay(anchor, "numeric")})` : ""}.
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[22px] bg-[#e07a72] px-4 py-4 text-black">
        <span className="min-w-0">
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
      {marry ? (
        <button
          type="button"
          onClick={() => setPick("wedding")}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-[22px] bg-raised px-4 py-4 text-left"
        >
          <span>Дата свадьбы</span>
          <span className="shrink-0 text-blue">{wedding ? formatRuDay(wedding, "long") : "не указана"}</span>
        </button>
      ) : null}
      <p className="mt-3 flex items-start gap-2 rounded-[22px] bg-raised px-4 py-4 text-[14px] text-muted">
        <Eye className="mt-0.5 size-4 shrink-0" />
        Даты общие: {partnerName} видит их сразу и может менять.
      </p>
      {pick === "together" ? (
        <DatePicker
          mode="untilToday"
          label="Вместе с"
          value={date}
          anchor={anchor}
          allowClear
          onPick={(day) => {
            setDate(day);
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      ) : null}
      {pick === "wedding" ? (
        <DatePicker
          mode="any"
          label="Свадьба"
          value={wedding}
          allowClear
          onPick={(day) => {
            setWedding(day);
            setPick(null);
          }}
          onClose={() => setPick(null)}
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
