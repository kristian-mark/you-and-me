import { useState } from "react";
import { Check, Circle, Hourglass } from "lucide-react";
import { useCouple, type VotePoll } from "@/lib/couple-store";

export function VotingScreen({ onBack }: { onBack: () => void }) {
  const votes = useCouple((s) => s.votes);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = votes.find((v) => v.id === openId);

  if (creating) {
    return <NewVote onClose={() => setCreating(false)} />;
  }
  if (selected) {
    return <VoteDetail vote={selected} onBack={() => setOpenId(null)} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-[17px] text-muted">
          ‹ Ещё
        </button>
        <button type="button" onClick={() => setCreating(true)} className="text-[17px] text-blue">
          Новое
        </button>
      </div>
      <h1 className="mt-5 text-[34px] font-semibold tracking-tight">Голосование</h1>

      {votes.length === 0 ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-6 flex items-center gap-3 rounded-[22px] bg-raised px-4 py-4 text-left"
        >
          <span className="grid size-8 place-items-center rounded-full border border-blue text-blue">
            <Check className="size-4" />
          </span>
          <span>
            <span className="block text-[17px]">Новый опрос</span>
            <span className="mt-0.5 block text-[14px] text-muted">спроси партнёра тайно</span>
          </span>
        </button>
      ) : (
        <ul className="mt-6 space-y-3">
          {votes.map((vote) => (
            <li key={vote.id}>
              <button
                type="button"
                onClick={() => setOpenId(vote.id)}
                className="w-full rounded-[22px] bg-raised px-5 py-4 text-left"
              >
                <p className="text-[13px] text-muted">
                  {vote.myChoice && vote.partnerChoice
                    ? "завершён"
                    : "идёт сейчас"}
                  {" · "}
                  {vote.createdBy === "me" ? "от тебя" : "от партнёра"}
                </p>
                <p className="mt-2 text-[20px] font-semibold leading-6">{vote.question}</p>
                <p className="mt-2 text-[14px] text-muted">
                  {vote.myChoice ? "ты уже проголосовал" : "ты ещё не проголосовал"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewVote({ onClose }: { onClose: () => void }) {
  const addVote = useCouple((s) => s.addVote);
  const partnerName = useCouple((s) => s.partnerName);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const ready = question.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onClose} className="text-[17px] text-muted">
          Отмена
        </button>
        <p className="text-[17px] font-semibold">Голосование</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            addVote(question, options);
            onClose();
          }}
          className={`text-[17px] ${ready ? "text-blue" : "text-muted"}`}
        >
          Спросить
        </button>
      </div>

      <label className="mt-6 block rounded-[22px] bg-raised px-5 py-4">
        <span className="text-[11px] tracking-[0.12em] text-muted uppercase">Вопрос</span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Куда на выходных?"
          className="mt-2 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        />
      </label>

      {options.map((opt, i) => (
        <label key={i} className="mt-3 block rounded-[22px] bg-raised px-5 py-4">
          <span className="text-[11px] tracking-[0.12em] text-muted uppercase">Вариант {i + 1}</span>
          <input
            value={opt}
            onChange={(e) =>
              setOptions((list) => list.map((item, idx) => (idx === i ? e.target.value : item)))
            }
            className="mt-2 w-full bg-transparent text-[17px] outline-none"
          />
        </label>
      ))}

      <button
        type="button"
        onClick={() => setOptions((list) => [...list, ""])}
        className="mt-3 w-full rounded-[22px] bg-raised py-4 text-[16px] text-muted"
      >
        + Ещё вариант
      </button>

      <p className="mt-5 px-1 text-[15px] leading-6 text-muted">
        {partnerName} видит вопрос, но не твой ответ. Оба выбора откроются, когда проголосуете вместе.
      </p>
    </section>
  );
}

function VoteDetail({ vote, onBack }: { vote: VotePoll; onBack: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const castVote = useCouple((s) => s.castVote);
  const [pick, setPick] = useState(vote.myChoice ?? "");
  const revealed = Boolean(vote.myChoice && vote.partnerChoice);
  const myLabel = vote.options.find((o) => o.id === vote.myChoice)?.text;
  const partnerLabel = vote.options.find((o) => o.id === vote.partnerChoice)?.text;

  if (vote.myChoice) {
    return (
      <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
        <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
          ‹ Голосование
        </button>
        <h1 className="mt-6 text-[32px] font-semibold leading-9">{vote.question}</h1>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] bg-raised p-4">
            <div className="h-1 -mx-4 -mt-4 mb-4 rounded-t-[22px] bg-blue" />
            <p className="flex items-center gap-2 text-[14px] text-muted">
              <span className="size-3 rounded-full bg-blue" />
              ты
            </p>
            <p className="mt-3 text-[18px] font-medium">{revealed || vote.myChoice ? myLabel : "· · ·"}</p>
            <p className="mt-4 text-[12px] font-semibold tracking-[0.08em] text-blue uppercase">
              проголосовал
            </p>
          </div>
          <div
            className={`rounded-[22px] p-4 ${
              vote.partnerChoice ? "bg-raised" : "border border-dashed border-line bg-transparent"
            }`}
          >
            {vote.partnerChoice ? (
              <div className="h-1 -mx-4 -mt-4 mb-4 rounded-t-[22px] bg-pink" />
            ) : null}
            <p className="flex items-center gap-2 text-[14px] text-muted">
              <span className="size-3 rounded-full bg-pink" />
              {partnerName}
            </p>
            {vote.partnerChoice ? (
              <>
                <p className="mt-3 text-[18px] font-medium">{revealed ? partnerLabel : "· · ·"}</p>
                <p className="mt-4 text-[12px] font-semibold tracking-[0.08em] text-pink uppercase">
                  проголосовала
                </p>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded-full bg-chip" />
                  <div className="h-2 w-2/3 rounded-full bg-chip" />
                </div>
                <p className="mt-4 text-[12px] tracking-[0.08em] text-muted uppercase">нет голоса</p>
              </>
            )}
          </div>
        </div>

        {revealed ? (
          <div className="mt-4 rounded-[22px] bg-raised px-5 py-6 text-center">
            <p className="text-[18px] font-semibold">
              {vote.myChoice === vote.partnerChoice ? "Вы выбрали одно и то же" : "Вы выбрали разное"}
            </p>
            <p className="mt-2 text-[15px] text-muted">
              ты — {myLabel}. {partnerName} — {partnerLabel}.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] bg-raised px-5 py-8 text-center">
            <Hourglass className="mx-auto size-7 text-muted" />
            <p className="mt-4 text-[18px] font-semibold leading-6">
              Твой выбор скрыт, пока {partnerName} не проголосует
            </p>
            <p className="mt-3 text-[14px] leading-5 text-muted">
              Чтобы никто не подстраивался под ответ другого — в этом весь смысл
            </p>
            <button
              type="button"
              onClick={() => {
                const other = vote.options.find((o) => o.id !== vote.myChoice) ?? vote.options[0];
                if (other) castVote(vote.id, other.id, "partner");
              }}
              className="mt-5 text-sm text-muted underline-offset-2"
            >
              Отметить, что {partnerName} уже ответила
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-[17px] text-muted">
        ‹ Голосование
      </button>
      <p className="mt-6 text-[12px] tracking-[0.14em] text-muted uppercase">
        Давай выберем · от {vote.createdBy === "me" ? myName : partnerName}
      </p>
      <h1 className="mt-3 text-[32px] font-semibold leading-9">{vote.question}</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted">
        Выбери один. Ответы откроются, когда проголосуете оба.
      </p>
      <ul className="mt-6 space-y-3">
        {vote.options.map((opt) => {
          const on = pick === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => setPick(opt.id)}
                className={`flex w-full items-center justify-between rounded-[22px] px-5 py-4 text-left ${
                  on ? "border border-blue bg-raised" : "bg-raised"
                }`}
              >
                <span className="text-[17px]">{opt.text}</span>
                {on ? (
                  <span className="grid size-7 place-items-center rounded-full bg-blue text-bg">
                    <Check className="size-4" />
                  </span>
                ) : (
                  <Circle className="size-7 text-muted" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={!pick}
        onClick={() => castVote(vote.id, pick)}
        className="mt-auto rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg disabled:opacity-40"
      >
        Отдать голос
      </button>
    </section>
  );
}
