import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useCouple } from "@/lib/couple-store";
import { loadTttMatch, openNewTttMatch, playTttMove } from "@/lib/turn/server";
import { tttBanner, type TttMatchView } from "@/lib/turn/ttt";

function textOf(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return "Не вышло связаться с партией";
}

function Cross() {
  return (
    <svg viewBox="0 0 48 48" className="size-11 text-mark" aria-hidden="true">
      <path
        d="M14 14 L34 34 M34 14 L14 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Nought() {
  return <span className="size-10 rounded-full border-[3px] border-blue" />;
}

function Mark({ cross }: { cross: boolean }) {
  return cross ? <Cross /> : <Nought />;
}

export function TicTacToe({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const noteTtt = useCouple((s) => s.noteTtt);
  const [view, setView] = useState<TttMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const [tick, setTick] = useState(0);
  const seenVersion = useRef(-1);
  const busy = useRef(false);

  const take = (next: TttMatchView) => {
    setView((prev) => (!prev || next.version >= prev.version ? next : prev));
  };

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void loadTttMatch()
        .then((next) => {
          if (!stop) take(next);
        })
        .catch((error: unknown) => {
          if (!stop) setNotice(textOf(error));
        });
    };
    pull();
    const onFocus = () => {
      if (document.visibilityState === "visible") pull();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 5000);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [tick]);

  useEffect(() => {
    if (!view) return;
    if (seenVersion.current >= 0 && view.version > seenVersion.current) setNotice("");
    seenVersion.current = view.version;
  }, [view]);

  useEffect(() => {
    if (!view || view.status !== "finished" || !view.winner) return;
    noteTtt(view.winner, `ttt:${view.version}`);
  }, [view, noteTtt]);

  const onCell = (cell: number) => {
    if (busy.current || !view || !view.myTurn || view.board[cell]) return;
    busy.current = true;
    setPending(true);
    setNotice("");
    void playTttMove({ data: { cell, version: view.version } })
      .then((next) => {
        take(next);
      })
      .catch((error: unknown) => {
        setNotice(textOf(error));
        return loadTttMatch()
          .then(take)
          .catch(() => undefined);
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const onNew = () => {
    if (busy.current || !view || view.status !== "finished") return;
    busy.current = true;
    setPending(true);
    setNotice("");
    void openNewTttMatch({ data: { version: view.version } })
      .then((next) => {
        take(next);
      })
      .catch((error: unknown) => {
        setNotice(textOf(error));
        return loadTttMatch()
          .then(take)
          .catch(() => undefined);
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const banner = view ? tttBanner(view) : null;
  const markLabel = (mine: boolean) => {
    if (!view || view.youAreCrosses === null) return "первый — крестики";
    const crosses = mine ? view.youAreCrosses : !view.youAreCrosses;
    return crosses ? "крестики" : "нолики";
  };

  return (
    <section
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-5 pb-8"
      data-status={view?.status ?? "loading"}
    >
      <header className="grid grid-cols-[1fr_auto_1fr] items-center">
        <button type="button" onClick={onBack} className="w-fit text-[17px] text-muted">
          ‹ Игры
        </button>
        <h1 className="text-[17px] font-semibold">Крестики-нолики</h1>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setHelp(true)}
            className="grid size-10 place-items-center text-muted"
            aria-label="Правила"
          >
            <CircleHelp className="size-5" />
          </button>
        </div>
      </header>

      {!view || !banner ? (
        <div className="grid flex-1 place-items-center px-4 text-center">
          <div>
            <p className="text-[17px] text-muted">{notice || "Открываем партию…"}</p>
            {notice ? (
              <button
                type="button"
                onClick={() => setTick((value) => value + 1)}
                className="mt-4 text-[16px] text-cream"
              >
                Ещё раз
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="mt-5 grid grid-cols-2 gap-3">
            <PlayerCard
              name={myName}
              mark={markLabel(true)}
              active={view.myTurn && view.status !== "finished"}
              tone="blue"
            />
            <PlayerCard
              name={partnerName}
              mark={markLabel(false)}
              active={!view.myTurn && view.status === "active"}
              tone="pink"
            />
          </div>

          <div className="mt-5 text-center" aria-live="polite">
            <p className="flex items-center justify-center gap-2 text-[22px] font-semibold">
              <span
                className={`size-3 rounded-full ${view.myTurn && view.status !== "finished" ? "bg-move" : "border border-dashed border-move"}`}
              />
              {banner.title}
            </p>
            <p className="mt-1 text-[15px] text-muted">{banner.hint}</p>
          </div>

          <div className={`mt-4 flex flex-1 items-center ${pending ? "opacity-70" : ""}`}>
            <div className="mx-auto grid w-full max-w-[320px] grid-cols-3 gap-3">
              {view.board.map((cell, index) => {
                const win = view.winningLine?.includes(index);
                const cross =
                  cell === null || view.youAreCrosses === null
                    ? false
                    : cell === "me"
                      ? view.youAreCrosses
                      : !view.youAreCrosses;
                const label =
                  cell === null
                    ? `Клетка ${index + 1}, пусто`
                    : cell === "me"
                      ? `Клетка ${index + 1}, твоя`
                      : `Клетка ${index + 1}, партнёра`;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={label}
                    disabled={
                      pending || view.status === "finished" || !view.myTurn || cell !== null
                    }
                    onClick={() => onCell(index)}
                    className={`grid aspect-square place-items-center rounded-[22px] bg-raised disabled:opacity-100 ${
                      win ? "border border-cream" : "border border-transparent"
                    }`}
                  >
                    {cell ? <Mark cross={cross} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-raised px-4 py-3">
            <span className="size-3 shrink-0 rounded-full bg-blue" />
            <span className="min-w-0 flex-1 truncate text-[15px]">{myName}</span>
            <span className="text-[22px] font-semibold tracking-wide">
              {view.wins.me}
              <span className="px-2 text-muted">:</span>
              {view.wins.partner}
            </span>
            <span className="min-w-0 flex-1 truncate text-right text-[15px]">{partnerName}</span>
            <span className="size-3 shrink-0 rounded-full bg-pink" />
          </div>
          {view.draws > 0 ? (
            <p className="mt-2 text-center text-[13px] text-muted">Ничьих: {view.draws}</p>
          ) : null}
          {notice ? <p className="mt-3 text-center text-[14px] text-pink">{notice}</p> : null}

          {view.status === "finished" ? (
            <button
              type="button"
              onClick={onNew}
              disabled={pending}
              className="mt-4 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg disabled:opacity-60"
            >
              Новая игра
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="mt-3 w-full rounded-full border border-line py-4 text-[17px] font-semibold"
          >
            К играм
          </button>
        </div>
      )}

      {help ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/60"
          onClick={() => setHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ttt-help-title"
            className="w-full rounded-t-[28px] bg-raised px-5 pt-5 pb-8"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="ttt-help-title" className="text-[20px] font-semibold">
              Как играть
            </p>
            <p className="mt-3 text-[16px] leading-6 text-muted">
              Если партии нет, любой из вас нажимает клетку и ходит первым — крестиками. Дальше
              только по очереди: свой ход нельзя повторить, пока не сходит партнёр. Быть онлайн
              одновременно не нужно — партия хранится у вас двоих. После победы, поражения или
              ничьей нажмите «Новая игра»: снова кто первый нажмёт клетку, тот и начинает.
            </p>
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="mt-5 w-full rounded-full bg-cream py-3.5 font-semibold text-cream-fg"
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PlayerCard({
  name,
  mark,
  active,
  tone,
}: {
  name: string;
  mark: string;
  active: boolean;
  tone: "blue" | "pink";
}) {
  return (
    <div
      className={`min-w-0 rounded-[22px] border-2 bg-raised px-3 py-3 ${active ? (tone === "blue" ? "border-blue" : "border-pink") : "border-transparent"}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-8 shrink-0 rounded-full ${tone === "blue" ? "bg-blue" : "bg-pink"}`}
        />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{name}</p>
          <p className="text-[13px] text-muted">{mark}</p>
        </div>
      </div>
    </div>
  );
}
