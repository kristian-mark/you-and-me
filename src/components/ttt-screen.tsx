import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBorder, pieceText, type PieceColor } from "@/lib/pair-color";
import { GAME_POLL_MS, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
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

function Cross({ tone }: { tone: PieceColor }) {
  return (
    <svg viewBox="0 0 48 48" className={`size-[46%] ${pieceText(tone)}`} aria-hidden="true">
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

function Nought({ tone }: { tone: PieceColor }) {
  return <span className={`size-[42%] rounded-full border-[3px] ${pieceBorder(tone)}`} />;
}

function Mark({ cross, tone }: { cross: boolean; tone: PieceColor }) {
  return cross ? <Cross tone={tone} /> : <Nought tone={tone} />;
}

export function TicTacToe({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteTtt = useCouple((s) => s.noteTtt);
  const [view, setView] = useState<TttMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const seenVersion = useRef(-1);
  const busy = useRef(false);

  const take = (next: TttMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("ttt", true, GAME_POLL_MS, async () => {
    try {
      take(await loadTttMatch());
    } catch (error) {
      setNotice(textOf(error));
      throw error;
    }
  });

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
          .then((next) => setView(next))
          .catch(() => undefined);
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const onStart = () => {
    if (busy.current || !view || view.status === "active") return;
    busy.current = true;
    setPending(true);
    setNotice("");
    void openNewTttMatch({ data: { version: view.version } })
      .then((next) => setView(next))
      .catch((error: unknown) => {
        setNotice(textOf(error));
        return loadTttMatch()
          .then((next) => setView(next))
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
          .then((next) => setView(next))
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
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <h1 className="truncate text-center text-[17px] font-semibold">Крестики-нолики</h1>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view || !banner ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("ttt")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
              <PlayerCard name={myName} mark={markLabel(true)} active={view.myTurn && view.status !== "finished"} tone={colors.me} />
              <PlayerCard name={partnerName} mark={markLabel(false)} active={!view.myTurn && view.status === "active"} tone={colors.partner} />
            </div>

            <div className="mt-2 shrink-0 text-center" aria-live="polite">
              <p className="flex items-center justify-center gap-2 text-[20px] font-semibold sm:text-[22px]">
                <span className={`size-3 rounded-full ${view.myTurn && view.status !== "finished" ? "bg-move" : "border border-dashed border-move"}`} />
                {banner.title}
              </p>
              <p className="mt-0.5 text-[15px] text-[#e6e1d6]">{banner.hint}</p>
            </div>

            <div className={`mt-2 flex min-h-0 flex-1 items-center justify-center [container-type:size] ${pending ? "opacity-70" : ""}`}>
              <div className="grid aspect-square grid-cols-3 gap-2 sm:gap-3" style={{ width: "min(100cqw, 100cqh, 34rem)" }}>
                {view.board.map((cell, index) => {
                  const win = view.winningLine?.includes(index);
                  const tone = cell === "partner" ? colors.partner : colors.me;
                  const cross =
                    cell === null || view.youAreCrosses === null ? false : cell === "me" ? view.youAreCrosses : !view.youAreCrosses;
                  const label =
                    cell === null ? `Клетка ${index + 1}, пусто` : cell === "me" ? `Клетка ${index + 1}, твоя` : `Клетка ${index + 1}, партнёра`;
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={label}
                      disabled={pending || view.status === "finished" || !view.myTurn || cell !== null}
                      onClick={() => onCell(index)}
                      className={`grid aspect-square place-items-center rounded-[18px] bg-raised disabled:opacity-100 sm:rounded-[22px] ${win ? "border border-cream" : "border border-transparent"}`}
                    >
                      {cell ? <Mark cross={cross} tone={tone} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex shrink-0 items-center gap-3 rounded-[22px] bg-raised px-4 py-2.5">
              <span className={`size-3 shrink-0 rounded-full ${colors.me === "blue" ? "bg-blue" : "bg-pink"}`} />
              <span className="min-w-0 flex-1 truncate text-[15px]">{myName}</span>
              <span className="text-[20px] font-semibold tracking-wide">
                {view.wins.me}
                <span className="px-2 text-[#e6e1d6]">:</span>
                {view.wins.partner}
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-[15px]">{partnerName}</span>
              <span className={`size-3 shrink-0 rounded-full ${colors.partner === "blue" ? "bg-blue" : "bg-pink"}`} />
            </div>
            {view.draws > 0 ? <p className="mt-1 shrink-0 text-center text-[13px] text-[#e6e1d6]">Ничьих: {view.draws}</p> : null}
            {notice ? <p className="mt-1 shrink-0 text-center text-[14px] text-pink">{notice}</p> : null}

            {view.status === "idle" ? (
              <button type="button" onClick={onStart} disabled={pending} className="mt-2 min-h-11 shrink-0 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                Начать игру
              </button>
            ) : null}
            {view.status === "finished" ? (
              <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
                <button type="button" onClick={onBack} className="min-h-11 rounded-full border border-line text-[16px] font-semibold">
                  К играм
                </button>
                <button type="button" onClick={onNew} disabled={pending} className="min-h-11 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                  Новая игра
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {help ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setHelp(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ttt-help-title"
            className="app-frame w-full rounded-t-[28px] bg-raised px-5 pt-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="ttt-help-title" className="text-[20px] font-semibold">Как играть</p>
            <p className="mt-3 text-[16px] leading-6 text-[#e6e1d6]">
              Кто нажимает «Начать» или «Новая игра», тот ходит первым — крестиками. Второй не может поставить фишку раньше.
              Дальше только по очереди. Быть онлайн одновременно не нужно — партия хранится у вас двоих.
              Цвет фишки — ваш, один и тот же на обоих телефонах.
            </p>
            <button type="button" onClick={() => setHelp(false)} className="mt-5 min-h-11 w-full rounded-full bg-cream font-semibold text-cream-fg">
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
  tone: PieceColor;
}) {
  return (
    <div className={`min-w-0 rounded-[18px] border-2 bg-raised px-3 py-2 ${active ? pieceBorder(tone) : "border-transparent"}`}>
      <div className="flex items-center gap-2">
        <span className={`size-8 shrink-0 rounded-full ${tone === "blue" ? "bg-blue" : "bg-pink"}`} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{name}</p>
          <p className="text-[13px] text-[#e6e1d6]">{mark}</p>
        </div>
      </div>
    </div>
  );
}
