import { useEffect, useState } from "react";
import { Check, Clock, EyeOff, Lock, Users } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, pieceBorder, pieceText } from "@/lib/pair-color";
import { QUIZ, SEE, buildReport } from "@/lib/quiz-data";
import { refreshCoupleQuiz } from "@/lib/quiz-live";
import { remindCoupleQuiz, resetCoupleQuiz, submitCoupleQuiz } from "@/lib/quiz-server";
import { parseQuizAnswers, remindAllowed } from "@/lib/quiz-sync";
import { LIST_POLL_MS, useScreenPoll } from "@/lib/screen-poll";

export function CompatibilityScreen({ onBack }: { onBack: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  useScreenPoll("quiz", true, LIST_POLL_MS, () => refreshCoupleQuiz());
  const [phase, setPhase] = useState<"intro" | "privacy" | "ask" | "wait" | "report">(() => {
    if (quiz.myDoneAt && quiz.partnerDoneAt && quiz.partnerAnswers.length >= 32) return "report";
    if (quiz.myDoneAt) return "wait";
    if (quiz.consented && quiz.myAnswers.length) return "ask";
    return "intro";
  });

  useEffect(() => {
    if (phase === "wait" && quiz.myDoneAt && quiz.partnerDoneAt && quiz.partnerAnswers.length >= 32) {
      setPhase("report");
    }
  }, [phase, quiz.myDoneAt, quiz.partnerDoneAt, quiz.partnerAnswers.length]);

  if (phase === "privacy") {
    return <Privacy onBack={() => setPhase("intro")} onOk={() => setPhase("ask")} />;
  }
  if (phase === "ask") {
    return <Ask onLeave={onBack} onDone={() => setPhase("wait")} />;
  }
  if (phase === "wait") return <Wait onBack={onBack} onReport={() => setPhase("report")} />;
  if (phase === "report") return <Report onBack={onBack} onRestart={() => setPhase("intro")} />;
  return <Intro onBack={onBack} onStart={() => setPhase("privacy")} />;
}

function Intro({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const colors = usePlayerColors();
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-8 flex items-center">
        <span className={`size-20 rounded-full ${pieceBg(colors.me)}`} />
        <span className={`-ml-8 size-20 rounded-full ${pieceBg(colors.partner)}`} />
      </div>
      <h1 className="mt-6 text-[32px] font-semibold leading-9">По тридцать два вопроса</h1>
      <p className="mt-3 text-[16px] leading-6 text-muted">
        В конце один общий отчёт: балл совместимости, архетип пары, зоны роста и то, как вы видите друг
        друга.
      </p>
      <ul className="mt-6 space-y-4 text-[15px] leading-6">
        <li className="flex gap-3">
          <Clock className={`mt-0.5 size-5 shrink-0 ${pieceText(colors.me)}`} />
          Около семи минут. Можно остановиться и вернуться.
        </li>
        <li className="flex gap-3">
          <EyeOff className={`mt-0.5 size-5 shrink-0 ${pieceText(colors.me)}`} />
          Ответы партнёра скрыты, пока тест не закончат оба.
        </li>
        <li className="flex gap-3">
          <Lock className={`mt-0.5 size-5 shrink-0 ${pieceText(colors.me)}`} />
          После отправки ответы не меняются — так и задумано.
        </li>
        <li className="flex gap-3">
          <Users className={`mt-0.5 size-5 shrink-0 ${pieceText(colors.me)}`} />
          Отчёт общий — его видите оба.
        </li>
      </ul>
      <p className="mt-6 rounded-[22px] bg-raised px-4 py-4 text-[14px] leading-5 text-muted">
        Тест бесплатный. Отчёт целиком считается по вашим ответам — без подписки.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 min-h-11 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg"
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
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-left text-[17px] text-muted">
        ‹ Назад
      </button>
      <h1 className="mt-8 text-[32px] font-semibold leading-9">Как считаются ответы</h1>
      <div className="mt-6 space-y-3">
        <p className="rounded-[22px] bg-raised px-4 py-4 text-[15px] leading-6 text-muted">
          Сначала считает алгоритм: проценты, совпадения, насколько вы угадываете друг друга.
        </p>
        <p className="rounded-[22px] bg-raised px-4 py-4 text-[15px] leading-6 text-muted">
          Ответы хранятся у вас двоих. Партнёр не видит их, пока тест не закончат оба — до этого виден только
          факт, что ответы отправлены.
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
        <span>Понимаю, что ответы обработают для общего отчёта.</span>
      </label>
      <button
        type="button"
        disabled={!ok}
        onClick={() => {
          setQuiz({ consented: true });
          onOk();
        }}
        className="mt-6 min-h-11 rounded-full bg-raised py-4 text-[17px] disabled:text-muted"
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
  const colors = usePlayerColors();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const i = Math.min(quiz.index, QUIZ.length - 1);
  const q = QUIZ[i];
  const pick = quiz.myAnswers[i];
  const last = i === QUIZ.length - 1;
  const tone = q.asPartner ? colors.partner : colors.me;

  const choose = (opt: number) => {
    const next = [...quiz.myAnswers];
    next[i] = opt;
    setQuiz({ myAnswers: next });
  };

  const go = () => {
    if (pick === undefined || pending) return;
    if (!last) {
      setQuiz({ index: i + 1 });
      return;
    }
    const answers = [...quiz.myAnswers];
    answers[i] = pick;
    const packed = parseQuizAnswers(answers);
    if (!packed) {
      setNotice("Нужны ответы на все 32 вопроса");
      return;
    }
    setPending(true);
    setNotice("");
    void submitCoupleQuiz({ data: packed })
      .then(async () => {
        await refreshCoupleQuiz();
        onDone();
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Не удалось отправить");
      })
      .finally(() => setPending(false));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-8">
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => (i ? setQuiz({ index: i - 1 }) : onLeave())}
          className="inline-flex min-h-11 items-center text-muted"
        >
          ‹
        </button>
        <p className="text-sm text-muted">
          {i + 1} из {QUIZ.length}
        </p>
        <button type="button" onClick={onLeave} className="inline-flex min-h-11 items-center text-sm text-muted">
          Выйти
        </button>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-chip">
        <div className={`h-full ${pieceBg(tone)}`} style={{ width: `${((i + 1) / QUIZ.length) * 100}%` }} />
      </div>
      <p className={`mt-5 text-[12px] tracking-[0.12em] uppercase ${pieceText(tone)}`}>
        {q.asPartner ? (
          <span className="rounded-full bg-raised px-3 py-1">● отвечаешь как {partnerName}</span>
        ) : (
          "● о себе"
        )}
      </p>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <h2 className="text-[28px] font-semibold leading-8">{q.text}</h2>
        <ul className="mt-6 space-y-3 pb-4">
          {q.options.map((opt, idx) => {
            const on = pick === idx;
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => choose(idx)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[22px] px-4 py-4 text-left text-[16px] ${
                    on ? `border ${pieceBorder(tone)} bg-bg` : "bg-raised"
                  }`}
                >
                  {opt}
                  {on ? (
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full ${pieceBg(tone)} text-bg`}>
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {last ? (
        <p className="mb-3 rounded-[22px] bg-raised px-4 py-3 text-center text-sm text-muted">
          После отправки ответы нельзя изменить
        </p>
      ) : null}
      {notice ? <p className="mb-3 text-center text-sm text-[#e07a72]">{notice}</p> : null}
      <button
        type="button"
        disabled={pick === undefined || pending}
        onClick={go}
        className="min-h-11 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg disabled:bg-raised disabled:text-muted"
      >
        {pending ? "Отправляем…" : last ? "Отправить ответы" : "Дальше"}
      </button>
    </section>
  );
}

function Wait({ onBack, onReport }: { onBack: () => void; onReport: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const when = quiz.myDoneAt ? format(new Date(quiz.myDoneAt), "d MMMM", { locale: ru }) : "";
  const partnerWhen = quiz.partnerDoneAt ? format(new Date(quiz.partnerDoneAt), "d MMMM", { locale: ru }) : "";
  const canRemind = remindAllowed(quiz.remindedAt ?? null, Date.now());

  const remind = () => {
    if (!canRemind || pending) return;
    setPending(true);
    setNotice("");
    void remindCoupleQuiz()
      .then(() => refreshCoupleQuiz())
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Не удалось напомнить");
      })
      .finally(() => setPending(false));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-8 flex items-center">
        <span className={`size-20 rounded-full ${pieceBg(colors.me)}`} />
        <span
          className={`-ml-8 size-20 rounded-full ${
            quiz.partnerDoneAt ? pieceBg(colors.partner) : `border-2 border-dashed ${pieceBorder(colors.partner)}`
          }`}
        />
      </div>
      <h1 className="mt-6 text-center text-[32px] font-semibold">1 из 2 готово</h1>
      <p className="mt-3 text-center text-[16px] leading-6 text-muted">
        Твои ответы отправлены. Отчёт сложится, когда {partnerName} тоже закончит тест.
      </p>
      <div className="mt-6 rounded-[22px] bg-raised px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-3">
            <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
            <span className="truncate">{myName}</span>
          </p>
          <p className="text-right text-sm text-muted">
            Готово
            <br />
            {when}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-[22px] bg-raised px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-3">
            <span
              className={`size-3 shrink-0 rounded-full ${
                quiz.partnerDoneAt ? pieceBg(colors.partner) : `border border-dashed ${pieceBorder(colors.partner)}`
              }`}
            />
            <span className="truncate">{partnerName}</span>
          </p>
          <p className="text-right text-sm text-muted">
            {quiz.partnerDoneAt ? (
              <>
                Готово
                <br />
                {partnerWhen}
              </>
            ) : (
              "ещё проходит тест"
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-[22px] bg-raised px-4 py-4 text-[14px] leading-5 text-muted">
        Ответы не показываются и не меняются, пока тест не закончат оба.
      </p>
      {notice ? <p className="mt-3 text-center text-sm text-[#e07a72]">{notice}</p> : null}
      <button
        type="button"
        disabled={!canRemind || pending}
        onClick={remind}
        className="mt-6 min-h-11 w-full rounded-full border border-line py-4 text-[17px] disabled:text-muted"
      >
        {pending ? "Отправляем…" : `Напомнить ${partnerName}`}
      </button>
      <p className="mt-2 text-center text-sm text-muted">
        {canRemind ? "не чаще раза в день" : "напоминание уже отправлено сегодня"}
      </p>
      <button type="button" onClick={onReport} className="mt-4 min-h-11 text-center text-sm text-muted">
        Посмотреть отчёт по своим ответам
      </button>
    </section>
  );
}

function Report({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
  const quiz = useCouple((s) => s.quiz);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const duoAnswers = quiz.partnerDoneAt && quiz.partnerAnswers.length >= 32 ? quiz.partnerAnswers : undefined;
  const report = buildReport(quiz.myAnswers, duoAnswers);
  const locked = Boolean(quiz.partnerDoneAt);

  const reset = () => {
    if (pending) return;
    setPending(true);
    setNotice("");
    void resetCoupleQuiz()
      .then(async () => {
        useCouple.getState().setQuiz({
          index: 0,
          myAnswers: [],
          myDoneAt: undefined,
          remindedAt: undefined,
          partnerAnswers: [],
        });
        await refreshCoupleQuiz();
        onRestart();
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Сброс не вышел");
      })
      .finally(() => setPending(false));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-28">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <div className="mx-auto mt-6 flex items-center">
        <span className={`size-16 rounded-full ${pieceBg(colors.me)}`} />
        <span
          className={`-ml-6 size-16 rounded-full ${
            report.duo ? pieceBg(colors.partner) : `border-2 border-dashed ${pieceBorder(colors.partner)}`
          }`}
        />
      </div>
      <p className="mt-4 text-center text-sm text-muted">{report.duo ? "общий отчёт" : "пока только твои ответы"}</p>
      <p className="text-center text-[56px] font-semibold leading-none">{report.score}</p>
      <p className="mt-2 text-center text-muted">из 100</p>
      <p className="mt-3 text-center text-[15px] leading-6 text-muted">{report.summary}</p>

      <article className="mt-6 rounded-[22px] bg-raised px-5 py-5">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">1 · Балл</p>
        <p className="mt-2 text-[16px] leading-6">
          Климат по твоим ответам — {report.climate}%.
          {report.duo
            ? ` Совпадение с ${partnerName} — ${report.match}%. Точность взгляда друг на друга — ${report.insight}%.`
            : " Когда партнёр закончит тест, сюда добавятся совпадение и точность взгляда."}
        </p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {report.rings.map((r) => (
            <div key={r.id} className="text-center">
              <div className="mx-auto h-16 w-2 overflow-hidden rounded-full bg-chip">
                <div
                  className={`mt-auto w-full rounded-full ${pieceBg(colors.me)}`}
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
            const miss = report.duo ? (t.match ?? 100) < 67 || (t.iSeeThem ?? 100) < 67 : false;
            const copy = SEE[t.topic];
            return (
              <li key={t.topic} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-sm text-muted">
                    {report.duo ? `${t.match ?? "—"}% · взгляд ${t.iSeeThem ?? "—"}%` : `${t.climate}%`}
                  </p>
                </div>
                <p className="mt-1 text-[14px] leading-5 text-muted">
                  {myName}: {t.myText}
                  {t.guessText ? `. Ты думаешь, что ${partnerName} выберет: ${t.guessText.toLowerCase()}.` : ""}
                  {t.theirText ? ` ${partnerName} о себе: ${t.theirText.toLowerCase()}.` : ""}
                </p>
                <p className="mt-1 text-[14px] leading-5">{miss ? copy.miss : copy.good}</p>
              </li>
            );
          })}
        </ul>
      </article>

      {notice ? <p className="mt-4 text-center text-sm text-[#e07a72]">{notice}</p> : null}
      <button
        type="button"
        disabled={locked || pending}
        onClick={reset}
        className="mt-6 min-h-11 w-full rounded-2xl bg-raised py-4 text-muted disabled:opacity-60"
      >
        {pending ? "Сбрасываем…" : locked ? "Общий результат не сбрасывается в одиночку" : "Сбросить мои ответы"}
      </button>
    </section>
  );
}
