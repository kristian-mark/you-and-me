import { useState } from "react";
import { Check, Clock, EyeOff, Lock, Users } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useCouple } from "@/lib/couple-store";
import { QUIZ, SEE, buildReport } from "@/lib/quiz-data";

export function CompatibilityScreen({ onBack }: { onBack: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const setQuiz = useCouple((s) => s.setQuiz);
  const [phase, setPhase] = useState<"intro" | "privacy" | "ask" | "wait" | "report">(() => {
    if (quiz.myDoneAt && quiz.partnerDoneAt) return "report";
    if (quiz.myDoneAt) return "wait";
    if (quiz.consented && quiz.myAnswers.length) return "ask";
    return "intro";
  });

  if (phase === "privacy") {
    return <Privacy onBack={() => setPhase("intro")} onOk={() => setPhase("ask")} />;
  }
  if (phase === "ask") {
    return (
      <Ask
        onLeave={onBack}
        onDone={() => setPhase(quiz.partnerDoneAt ? "report" : "wait")}
      />
    );
  }
  if (phase === "wait") return <Wait onBack={onBack} onReport={() => setPhase("report")} />;
  if (phase === "report") return <Report onBack={onBack} />;
  return <Intro onBack={onBack} onStart={() => setPhase("privacy")} />;
}

function Intro({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-8 flex items-center">
        <span className="size-20 rounded-full bg-blue" />
        <span className="-ml-8 size-20 rounded-full bg-[#e07a7a]" />
      </div>
      <h1 className="mt-6 text-[32px] font-semibold leading-9">По тридцать два вопроса</h1>
      <p className="mt-3 text-[16px] leading-6 text-muted">
        В конце один общий отчёт: балл совместимости, архетип пары, зоны роста и то, как вы видите друг
        друга.
      </p>
      <ul className="mt-6 space-y-4 text-[15px] leading-6">
        <li className="flex gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-blue" />
          Около семи минут. Можно остановиться и вернуться.
        </li>
        <li className="flex gap-3">
          <EyeOff className="mt-0.5 size-5 shrink-0 text-blue" />
          Ответы {partnerName} скрыты, пока не закончите оба.
        </li>
        <li className="flex gap-3">
          <Lock className="mt-0.5 size-5 shrink-0 text-blue" />
          Потом ответы не меняются — так и задумано.
        </li>
        <li className="flex gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-blue" />
          Отчёт общий — его видите оба.
        </li>
      </ul>
      <p className="mt-6 rounded-[22px] bg-raised px-4 py-4 text-[14px] leading-5 text-muted">
        Тест бесплатный. Отчёт целиком считается по вашим ответам — без подписки.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg"
      >
        Начать
      </button>
      <p className="mt-3 text-center text-sm text-muted">32 вопроса · ≈ 7 мин</p>
    </section>
  );
}

function Privacy({ onBack, onOk }: { onBack: () => void; onOk: () => void }) {
  const setQuiz = useCouple((s) => s.setQuiz);
  const [ok, setOk] = useState(false);
  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Назад
      </button>
      <h1 className="mt-8 text-[32px] font-semibold leading-9">Как считаются ответы</h1>
      <div className="mt-6 space-y-3">
        <p className="rounded-[22px] bg-raised px-4 py-4 text-[15px] leading-6 text-muted">
          Сначала считает алгоритм: проценты, совпадения, насколько вы угадываете друг друга.
        </p>
        <p className="rounded-[22px] bg-raised px-4 py-4 text-[15px] leading-6 text-muted">
          Тексты отчёта собираются здесь, на устройстве. Имена, фото и заметки никуда не уходят.
        </p>
        <p className="rounded-[22px] bg-raised px-4 py-4 text-[15px] leading-6 text-muted">
          Формула опирается на оси Готтмана и привязанности: разговор, ремонт после ссоры, быт, тепло,
          пространство.
        </p>
      </div>
      <label className="mt-6 flex items-start gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={ok}
          onChange={(e) => setOk(e.target.checked)}
          className="mt-1 size-5 accent-blue"
        />
        <span>
          Согласен, что ответы обработают для отчёта.{" "}
          <span className="text-blue">Политика</span>
        </span>
      </label>
      <button
        type="button"
        disabled={!ok}
        onClick={() => {
          setQuiz({ consented: true });
          onOk();
        }}
        className="mt-auto rounded-full bg-raised py-4 text-[17px] disabled:text-muted"
      >
        К первому вопросу
      </button>
    </section>
  );
}

function Ask({ onLeave, onDone }: { onLeave: () => void; onDone: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const setQuiz = useCouple((s) => s.setQuiz);
  const partnerName = useCouple((s) => s.partnerName);
  const i = Math.min(quiz.index, QUIZ.length - 1);
  const q = QUIZ[i];
  const pick = quiz.myAnswers[i];
  const last = i === QUIZ.length - 1;
  const pink = q.asPartner;

  const choose = (opt: number) => {
    const next = [...quiz.myAnswers];
    next[i] = opt;
    setQuiz({ myAnswers: next });
  };

  const go = () => {
    if (pick === undefined) return;
    if (last) {
      setQuiz({ myDoneAt: new Date().toISOString() });
      onDone();
      return;
    }
    setQuiz({ index: i + 1 });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-8">
      <div className="flex items-center justify-between pt-5">
        <button
          type="button"
          onClick={() => (i ? setQuiz({ index: i - 1 }) : onLeave())}
          className="text-muted"
        >
          ‹
        </button>
        <p className="text-sm text-muted">
          {i + 1} из {QUIZ.length}
        </p>
        <button type="button" onClick={onLeave} className="text-sm text-muted">
          Выйти
        </button>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-chip">
        <div
          className={`h-full ${pink ? "bg-[#e07a7a]" : "bg-blue"}`}
          style={{ width: `${((i + 1) / QUIZ.length) * 100}%` }}
        />
      </div>
      <p className={`mt-5 text-[12px] tracking-[0.12em] uppercase ${pink ? "text-[#e07a7a]" : "text-blue"}`}>
        {pink ? (
          <span className="rounded-full bg-[#3a2228] px-3 py-1">
            ● отвечаешь как {partnerName}
          </span>
        ) : (
          "● о себе"
        )}
      </p>
      <h2 className="mt-4 text-[28px] font-semibold leading-8">{q.text}</h2>
      <ul className="mt-6 space-y-3">
        {q.options.map((opt, idx) => {
          const on = pick === idx;
          return (
            <li key={opt}>
              <button
                type="button"
                onClick={() => choose(idx)}
                className={`flex w-full items-center justify-between rounded-[22px] px-4 py-4 text-left text-[16px] ${
                  on
                    ? pink
                      ? "border border-[#e07a7a] bg-[#2a181c]"
                      : "border border-blue bg-[#152033]"
                    : "bg-raised"
                }`}
              >
                {opt}
                {on ? (
                  <span
                    className={`grid size-6 place-items-center rounded-full ${
                      pink ? "bg-[#e07a7a]" : "bg-blue"
                    } text-bg`}
                  >
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {last ? (
        <p className="mt-auto mb-3 rounded-[22px] bg-raised px-4 py-3 text-center text-sm text-muted">
          После отправки ответы нельзя изменить
        </p>
      ) : (
        <div className="mt-auto" />
      )}
      <button
        type="button"
        disabled={pick === undefined}
        onClick={go}
        className="w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg disabled:bg-raised disabled:text-muted"
      >
        {last ? "Отправить ответы" : "Дальше"}
      </button>
    </section>
  );
}

function Wait({ onBack, onReport }: { onBack: () => void; onReport: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const setQuiz = useCouple((s) => s.setQuiz);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const when = quiz.myDoneAt ? format(new Date(quiz.myDoneAt), "d MMMM", { locale: ru }) : "";
  const canRemind = !quiz.remindedAt || Date.now() - new Date(quiz.remindedAt).getTime() > 86_400_000;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-8 flex items-center">
        <span className="size-20 rounded-full bg-blue" />
        <span className="-ml-8 size-20 rounded-full border-2 border-dashed border-[#e07a7a] bg-transparent" />
      </div>
      <h1 className="mt-6 text-center text-[32px] font-semibold">1 из 2 готово</h1>
      <p className="mt-3 text-center text-[16px] leading-6 text-muted">
        Ты закончил. Отчёт сложится, когда {partnerName} тоже пройдёт — торопить не нужно.
      </p>
      <div className="mt-6 rounded-[22px] bg-raised px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-3">
            <span className="size-3 rounded-full bg-blue" />
            {myName}
          </p>
          <p className="text-right text-sm text-muted">
            прошёл
            <br />
            {when}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-3">
            <span className="size-3 rounded-full border border-dashed border-[#e07a7a]" />
            {partnerName}
          </p>
          <p className="text-right text-sm text-muted">ещё не проходила</p>
        </div>
      </div>
      <p className="mt-3 rounded-[22px] bg-raised px-4 py-4 text-[14px] leading-5 text-muted">
        Мы не показываем ответы назад и не даём их менять — так отчёт честный для вас обоих.
      </p>
      <button
        type="button"
        disabled={!canRemind}
        onClick={() => setQuiz({ remindedAt: new Date().toISOString() })}
        className="mt-6 w-full rounded-full border border-line py-4 text-[17px]"
      >
        Напомнить {partnerName}
      </button>
      <p className="mt-2 text-center text-sm text-muted">не чаще раза в день</p>
      <button
        type="button"
        onClick={onReport}
        className="mt-4 text-center text-sm text-muted"
      >
        Посмотреть отчёт по моим ответам
      </button>
    </section>
  );
}

function Report({ onBack }: { onBack: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const resetQuiz = useCouple((s) => s.resetQuiz);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const report = buildReport(
    quiz.myAnswers,
    quiz.partnerDoneAt && quiz.partnerAnswers.length >= 16 ? quiz.partnerAnswers : undefined,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-6 flex items-center">
        <span className="size-16 rounded-full bg-blue" />
        <span className={`-ml-6 size-16 rounded-full ${report.duo ? "bg-[#e07a7a]" : "border-2 border-dashed border-[#e07a7a]"}`} />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {report.duo ? "общий отчёт" : "пока только твои ответы"}
      </p>
      <p className="text-center text-[56px] font-semibold leading-none">{report.score}</p>
      <p className="mt-2 text-center text-muted">из 100</p>
      <p className="mt-3 text-center text-[15px] leading-6 text-muted">{report.summary}</p>

      <article className="mt-6 rounded-[22px] bg-raised px-5 py-5">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">1 · Балл</p>
        <p className="mt-2 text-[16px] leading-6">
          Климат по твоим ответам — {report.climate}%.
          {report.duo
            ? ` Совпадение с ${partnerName} — ${report.match}%. Точность взгляда друг на друга — ${report.insight}%.`
            : " Когда она пройдёт тест, сюда добавятся совпадение и точность взгляда."}
        </p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {report.rings.map((r) => (
            <div key={r.id} className="text-center">
              <div className="mx-auto h-16 w-2 overflow-hidden rounded-full bg-chip">
                <div
                  className="mt-auto w-full rounded-full bg-blue"
                  style={{ height: `${r.value}%`, marginTop: `${100 - r.value}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] leading-3 text-muted">{r.label}</p>
              <p className="text-[11px]">{r.value}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="mt-3 rounded-[22px] bg-raised px-5 py-5">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">2 · Архетип</p>
        <p className="mt-2 text-[20px] font-semibold">{report.archetype.name}</p>
        <p className="mt-2 text-[15px] leading-6 text-muted">{report.archetype.text}</p>
      </article>

      <article className="mt-3 rounded-[22px] bg-raised px-5 py-5">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">3 · Зоны роста</p>
        <ul className="mt-3 space-y-4">
          {report.weak.map((t) => (
            <li key={t.topic}>
              <p className="font-medium">{t.label}</p>
              <p className="mt-1 text-[14px] leading-5 text-muted">
                Ты: {t.myText}
                {t.theirText ? `. ${partnerName}: ${t.theirText}.` : "."}
              </p>
              <p className="mt-1 text-[14px] leading-5">{t.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted">
          Крепче всего сейчас: {report.strong.map((t) => t.label.toLowerCase()).join(", ")}.
        </p>
      </article>

      <article className="mt-3 rounded-[22px] bg-raised px-5 py-5">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">4 · Как вы видите друг друга</p>
        <ul className="mt-3 space-y-4">
          {report.topics.map((t) => {
            const miss = report.duo
              ? (t.match ?? 100) < 67 || (t.iSeeThem ?? 100) < 67
              : false;
            const copy = SEE[t.topic];
            return (
              <li key={t.topic} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-sm text-muted">
                    {report.duo
                      ? `${t.match ?? "—"}% · взгляд ${t.iSeeThem ?? "—"}%`
                      : `${t.climate}%`}
                  </p>
                </div>
                <p className="mt-1 text-[14px] leading-5 text-muted">
                  {myName}: {t.myText}
                  {t.guessText ? `. Ты думаешь, ${partnerName} ответила бы: ${t.guessText.toLowerCase()}.` : ""}
                  {t.theirText ? ` Она о себе: ${t.theirText.toLowerCase()}.` : ""}
                </p>
                <p className="mt-1 text-[14px] leading-5">{miss ? copy.miss : copy.good}</p>
              </li>
            );
          })}
        </ul>
      </article>

      <button
        type="button"
        onClick={resetQuiz}
        className="mt-6 w-full rounded-2xl bg-raised py-4 text-muted"
      >
        Сбросить тест
      </button>
    </section>
  );
}
