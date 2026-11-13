import { useEffect, useState } from "react";
import { ChevronRight, Mail } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { questionById } from "@/lib/daily-questions";
import { refreshCoupleDaily, skipSharedDaily } from "@/lib/daily-live";
import { formatRuDay, formatRuShortStamp } from "@/lib/dates";
import { pieceBg, pieceRingSoft, pieceText, pieceWash, type PieceColor } from "@/lib/pair-color";
import { LIST_POLL_MS, useScreenPoll } from "@/lib/screen-poll";

function stamp(iso: string | undefined) {
  return formatRuShortStamp(iso);
}

export function QuestionDayScreen({ onBack }: { onBack: () => void }) {
  const daily = useCouple((s) => s.daily);
  const ensureDaily = useCouple((s) => s.ensureDaily);
  const [past, setPast] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ensureDaily();
  }, [ensureDaily]);

  useScreenPoll("daily", true, LIST_POLL_MS, async () => {
    await refreshCoupleDaily();
    setError("");
  });

  if (past) return <PastList onBack={() => setPast(false)} />;

  const q = questionById(daily.questionId);
  const dateLabel = daily.date ? formatRuDay(daily.date, "dayMonth") : "";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-5 pb-28">
      <button type="button" onClick={onBack} className="min-h-11 pt-5 text-left text-[17px] text-muted">
        ‹ Ещё
      </button>
      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">
        {dateLabel} · тема: {q.topic}
      </p>
      <h1 className="mt-3 text-[28px] font-semibold leading-8 break-words sm:text-[32px] sm:leading-9">{q.text}</h1>

      {daily.myAnswer ? (
        <Waiting onPast={() => setPast(true)} />
      ) : (
        <Compose error={error} onError={setError} onPast={() => setPast(true)} />
      )}
    </section>
  );
}

function Compose({
  error,
  onError,
  onPast,
}: {
  error: string;
  onError: (value: string) => void;
  onPast: () => void;
}) {
  const partnerName = useCouple((s) => s.partnerName);
  const partnerAnswered = useCouple((s) => s.daily.partnerAnswered);
  const answerDaily = useCouple((s) => s.answerDaily);
  const history = useCouple((s) => s.daily.history) ?? [];
  const colors = usePlayerColors();
  const [text, setText] = useState("");
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className={`relative mt-6 rounded-[22px] bg-raised px-4 pb-4 pt-3 ring-1 ${pieceRingSoft(colors.me)}`}>
        <span className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-full ${pieceBg(colors.me)}`} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Своими словами. Хватит пары предложений, но если пошло — пиши сколько идёт."
          className="w-full resize-none bg-transparent pl-2 text-[16px] leading-6 outline-none placeholder:text-muted"
        />
        <p className="mt-2 pl-2 text-[13px] leading-5 break-words text-muted">
          {partnerAnswered
            ? `Ответ ${partnerName} уже есть. Он откроется, когда отправишь свой.`
            : `${partnerName} увидит ответ только когда ответит тоже`}
        </p>
      </div>
      <button
        type="button"
        disabled={!text.trim() || busy}
        onClick={() => {
          setBusy(true);
          onError("");
          answerDaily(text);
          void refreshCoupleDaily()
            .catch((err: unknown) => {
              onError(err instanceof Error ? err.message : "Не вышло отправить");
            })
            .finally(() => setBusy(false));
        }}
        className={`mt-4 min-h-11 w-full rounded-full py-4 text-[17px] font-semibold disabled:opacity-40 ${pieceWash(colors.me)}`}
      >
        Отправить ответ
      </button>
      <p className="mt-3 text-center text-[13px] text-muted">После отправки ответ не переписать</p>
      {error ? <p className="mt-2 text-center text-[13px] text-pink">{error}</p> : null}

      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[16px]">Пропустить вопрос</p>
        <p className="mt-1 text-[14px] leading-5 text-muted">
          убирает вопрос для вас обоих — спросим подтверждение
        </p>
        {confirmSkip ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onError("");
                void skipSharedDaily()
                  .then(() => setConfirmSkip(false))
                  .catch((err: unknown) => {
                    onError(err instanceof Error ? err.message : "Не вышло пропустить");
                  })
                  .finally(() => setBusy(false));
              }}
              className="min-h-11 flex-1 rounded-full bg-raised py-3 text-sm"
            >
              Да, пропустить
            </button>
            <button
              type="button"
              onClick={() => setConfirmSkip(false)}
              className="min-h-11 flex-1 rounded-full bg-raised py-3 text-sm text-muted"
            >
              Оставить
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmSkip(true)} className="mt-3 min-h-11 text-[15px] text-muted">
            Пропустить
          </button>
        )}
      </div>

      <PastButton count={history.length} onPast={onPast} />
    </>
  );
}

function Waiting({ onPast }: { onPast: () => void }) {
  const daily = useCouple((s) => s.daily);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const history = daily.history ?? [];
  const both = Boolean(daily.myAnswer && daily.partnerAnswer);

  return (
    <>
      <AnswerCard
        color={colors.me}
        label="твой ответ"
        at={daily.myAt}
        body={daily.myAnswer ?? ""}
      />

      {both ? (
        <AnswerCard
          color={colors.partner}
          label={`ответ ${partnerName}`}
          at={daily.partnerAt}
          body={daily.partnerAnswer ?? ""}
          className="mt-3"
        />
      ) : (
        <article className="mt-3 rounded-[22px] bg-raised px-5 py-5">
          <p className="flex items-center gap-2 text-[16px] font-medium break-words">
            <Mail className="size-5 shrink-0 text-muted" />
            Ход {partnerName}
          </p>
          <p className="mt-2 text-[14px] leading-5 text-muted">
            {daily.partnerAnswered
              ? `Ответ ${partnerName} уже есть. Откроем оба, как только твой дойдёт.`
              : `Ответы откроются вам обоим, как только ${partnerName} напишет свой. Не торопи — вопрос подождёт.`}
          </p>
        </article>
      )}

      <p className="mt-5 text-[14px] leading-5 text-muted">
        Свой ответ уже не переписать. Новый вопрос придёт, когда закроется этот.
      </p>

      <PastButton count={history.length} onPast={onPast} />
    </>
  );
}

function AnswerCard({
  color,
  label,
  at,
  body,
  className = "mt-6",
}: {
  color: PieceColor;
  label: string;
  at?: string;
  body: string;
  className?: string;
}) {
  return (
    <article className={`relative rounded-[22px] bg-raised px-5 py-4 ${className}`}>
      <span className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-full ${pieceBg(color)}`} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pl-2">
        <p className={`min-w-0 text-[11px] tracking-[0.14em] break-words uppercase ${pieceText(color)}`}>{label}</p>
        <p className="text-[13px] text-muted">{stamp(at)}</p>
      </div>
      <p className="mt-2 pl-2 text-[16px] leading-6 break-words">{body}</p>
    </article>
  );
}

function PastButton({ count, onPast }: { count: number; onPast: () => void }) {
  return (
    <button
      type="button"
      onClick={onPast}
      className="mt-6 flex min-h-11 w-full items-center justify-between gap-3 rounded-[22px] bg-raised px-4 py-4"
    >
      <span className="min-w-0">Прошлые вопросы</span>
      <span className="flex shrink-0 items-center gap-2 text-muted">
        {count}
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

function PastList({ onBack }: { onBack: () => void }) {
  const history = useCouple((s) => s.daily.history) ?? [];
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-5 pb-28">
      <button type="button" onClick={onBack} className="min-h-11 pt-5 text-left text-[17px] text-muted">
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
                {formatRuDay(item.date, "dayMonth")} · {item.topic}
              </p>
              <p className="mt-2 text-[17px] font-medium leading-6 break-words">{item.text}</p>
              {item.myAnswer ? (
                <p className={`mt-3 text-[14px] break-words ${pieceText(colors.me)}`}>Ты: {item.myAnswer}</p>
              ) : null}
              {item.partnerAnswer ? (
                <p className={`mt-1 text-[14px] break-words ${pieceText(colors.partner)}`}>
                  {partnerName}: {item.partnerAnswer}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
