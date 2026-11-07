import { useEffect, useState } from "react";
import { ChevronRight, Mail } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useCouple } from "@/lib/couple-store";
import { questionById } from "@/lib/daily-questions";

export function QuestionDayScreen({ onBack }: { onBack: () => void }) {
  const daily = useCouple((s) => s.daily);
  const ensureDaily = useCouple((s) => s.ensureDaily);
  const [past, setPast] = useState(false);

  useEffect(() => {
    ensureDaily();
  }, [ensureDaily]);

  if (past) return <PastList onBack={() => setPast(false)} />;

  const q = questionById(daily.questionId);
  const dateLabel = daily.date
    ? format(parseISO(daily.date), "d MMMM", { locale: ru })
    : "";

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">
        {dateLabel} · тема: {q.topic}
      </p>
      <h1 className="mt-3 text-[32px] font-semibold leading-9">{q.text}</h1>

      {daily.myAnswer ? (
        <Waiting onPast={() => setPast(true)} />
      ) : (
        <Compose onPast={() => setPast(true)} />
      )}
    </section>
  );
}

function Compose({ onPast }: { onPast: () => void }) {
  const partnerName = useCouple((s) => s.partnerName);
  const answerDaily = useCouple((s) => s.answerDaily);
  const skipDaily = useCouple((s) => s.skipDaily);
  const history = useCouple((s) => s.daily.history);
  const [text, setText] = useState("");
  const [confirmSkip, setConfirmSkip] = useState(false);

  return (
    <>
      <div className="relative mt-6 rounded-[22px] bg-raised px-4 pb-4 pt-3 ring-1 ring-blue/70">
        <span className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full bg-blue" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Своими словами. Хватит пары предложений, но если пошло — пиши сколько идёт."
          className="w-full resize-none bg-transparent pl-2 text-[16px] leading-6 outline-none placeholder:text-muted"
        />
        <p className="mt-2 pl-2 text-[13px] leading-5 text-muted">
          {partnerName} увидит ответ только когда ответит тоже
        </p>
      </div>
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => answerDaily(text)}
        className="mt-4 w-full rounded-full bg-[#1a3a52] py-4 text-[17px] font-semibold text-blue disabled:opacity-40"
      >
        Отправить ответ
      </button>
      <p className="mt-3 text-center text-[13px] text-muted">После отправки ответ не переписать</p>

      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[16px]">Пропустить вопрос</p>
        <p className="mt-1 text-[14px] leading-5 text-muted">
          убирает вопрос для вас обоих — спросим подтверждение
        </p>
        {confirmSkip ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                skipDaily();
                setConfirmSkip(false);
              }}
              className="flex-1 rounded-full bg-raised py-3 text-sm"
            >
              Да, пропустить
            </button>
            <button
              type="button"
              onClick={() => setConfirmSkip(false)}
              className="flex-1 rounded-full bg-raised py-3 text-sm text-muted"
            >
              Оставить
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmSkip(true)}
            className="mt-3 text-[15px] text-muted"
          >
            Пропустить
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onPast}
        className="mt-6 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Прошлые вопросы</span>
        <span className="flex items-center gap-2 text-muted">
          {history.length}
          <ChevronRight className="size-4" />
        </span>
      </button>
    </>
  );
}

function Waiting({ onPast }: { onPast: () => void }) {
  const daily = useCouple((s) => s.daily);
  const partnerName = useCouple((s) => s.partnerName);
  const answerDaily = useCouple((s) => s.answerDaily);
  const history = daily.history ?? [];
  const both = Boolean(daily.myAnswer && daily.partnerAnswer);

  return (
    <>
      <article className="relative mt-6 rounded-[22px] bg-raised px-5 py-4">
        <span className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full bg-blue" />
        <div className="flex items-center justify-between pl-2">
          <p className="text-[11px] tracking-[0.14em] text-blue uppercase">твой ответ</p>
          <p className="text-[13px] text-muted">
            {daily.myAt ? format(parseISO(daily.myAt), "d MMM в HH:mm", { locale: ru }) : ""}
          </p>
        </div>
        <p className="mt-2 pl-2 text-[16px] leading-6">{daily.myAnswer}</p>
      </article>

      {both ? (
        <article className="relative mt-3 rounded-[22px] bg-raised px-5 py-4">
          <span className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full bg-pink" />
          <div className="flex items-center justify-between pl-2">
            <p className="text-[11px] tracking-[0.14em] text-pink uppercase">ответ {partnerName}</p>
            <p className="text-[13px] text-muted">
              {daily.partnerAt ? format(parseISO(daily.partnerAt), "d MMM в HH:mm", { locale: ru }) : ""}
            </p>
          </div>
          <p className="mt-2 pl-2 text-[16px] leading-6">{daily.partnerAnswer}</p>
        </article>
      ) : (
        <article className="mt-3 rounded-[22px] bg-raised px-5 py-5">
          <p className="flex items-center gap-2 text-[16px] font-medium">
            <Mail className="size-5 text-muted" />
            Ход {partnerName}
          </p>
          <p className="mt-2 text-[14px] leading-5 text-muted">
            Ответы откроются вам обоим, как только {partnerName} напишет свой. Не торопи —
            вопрос подождёт.
          </p>
          <button
            type="button"
            onClick={() => answerDaily("Я тоже это помню. Напишу нормально со своего телефона.", "partner")}
            className="mt-3 text-left text-[13px] text-muted"
          >
            Партнёр уже ответил — открыть
          </button>
        </article>
      )}

      <p className="mt-5 text-[14px] leading-5 text-muted">
        Свой ответ уже не переписать. Новый вопрос придёт, когда закроется этот.
      </p>

      <button
        type="button"
        onClick={onPast}
        className="mt-6 flex w-full items-center justify-between rounded-[22px] bg-raised px-4 py-4"
      >
        <span>Прошлые вопросы</span>
        <span className="flex items-center gap-2 text-muted">
          {history.length}
          <ChevronRight className="size-4" />
        </span>
      </button>
    </>
  );
}

function PastList({ onBack }: { onBack: () => void }) {
  const history = useCouple((s) => s.daily.history);
  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Вопрос дня
      </button>
      <h1 className="mt-5 text-[32px] font-semibold">Прошлые вопросы</h1>
      {history.length === 0 ? (
        <p className="mt-8 text-muted">Пока пусто — сегодня первый.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {history.map((item) => (
            <li key={`${item.date}-${item.questionId}`} className="rounded-[22px] bg-raised px-5 py-4">
              <p className="text-[12px] tracking-[0.12em] text-muted uppercase">
                {format(parseISO(item.date), "d MMMM", { locale: ru })} · {item.topic}
              </p>
              <p className="mt-2 text-[17px] font-medium leading-6">{item.text}</p>
              {item.myAnswer ? <p className="mt-3 text-[14px] text-muted">Ты: {item.myAnswer}</p> : null}
              {item.partnerAnswer ? (
                <p className="mt-1 text-[14px] text-muted">Партнёр: {item.partnerAnswer}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
