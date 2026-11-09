import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, type PieceColor } from "@/lib/pair-color";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { C4_COLS, C4_ROWS, c4Banner, c4Index, type C4MatchView } from "@/lib/turn/c4";
import { loadC4Match, openNewC4Match, playC4Move } from "@/lib/turn/server";

function textOf(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Не вышло связаться с партией";
}

export function ConnectFourMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteC4 = useCouple((s) => s.noteC4);
  const [view, setView] = useState<C4MatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: C4MatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("c4", true, GAME_POLL_MS, async () => {
    try {
      take(await loadC4Match());
      pollMisses.current = 0;
      if (noticeFromPoll.current) {
        noticeFromPoll.current = false;
        setNotice("");
      }
    } catch (error) {
      pollMisses.current += 1;
      const text = pollFailureNotice(pollMisses.current, textOf(error));
      if (text) {
        noticeFromPoll.current = true;
        setNotice(text);
      }
      throw error;
    }
  });

  useEffect(() => {
    if (!view) return;
    if (seenVersion.current >= 0 && view.version > seenVersion.current) {
      noticeFromPoll.current = false;
      setNotice("");
    }
    seenVersion.current = view.version;
  }, [view]);

  useEffect(() => {
    if (!view || view.status !== "finished" || !view.winner) return;
    noteC4(view.winner, `c4:${view.version}`);
  }, [view, noteC4]);

  const reconcile = () =>
    loadC4Match()
      .then((next) => setView(next))
      .catch(() => undefined);

  const onColumn = (column: number) => {
    if (busy.current || !view || !view.myTurn || view.board[column]) return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void playC4Move({ data: { column, version: view.version } })
      .then((next) => take(next))
      .catch((error: unknown) => {
        noticeFromPoll.current = false;
        setNotice(textOf(error));
        return reconcile();
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const onNew = () => {
    if (busy.current || !view || view.status === "active") return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void openNewC4Match({ data: { version: view.version } })
      .then((next) => setView(next))
      .catch((error: unknown) => {
        noticeFromPoll.current = false;
        setNotice(textOf(error));
        return reconcile();
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const banner = view ? c4Banner(view, partnerName) : null;
  const winning = new Set(view?.winningLine ?? []);

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-5 pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Четыре в ряд</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view || !banner ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("c4")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className={`mt-2 rounded-[28px] bg-[#16181e] p-3 sm:p-4 ${pending ? "opacity-70" : ""}`}>
              <div className="mx-auto grid max-w-[28rem] grid-cols-7 gap-1.5 sm:gap-2">
                {Array.from({ length: C4_COLS }, (_, column) => {
                  const full = Boolean(view.board[column]);
                  const locked = !view.myTurn || view.status !== "active" || full || pending;
                  return (
                    <button
                      key={column}
                      type="button"
                      aria-label={full ? `Столбец ${column + 1}, полный` : `Столбец ${column + 1}`}
                      disabled={locked}
                      onClick={() => onColumn(column)}
                      className="grid gap-1.5 disabled:opacity-100 sm:gap-2"
                    >
                      {Array.from({ length: C4_ROWS }, (_, row) => {
                        const index = c4Index(row, column);
                        const cell = view.board[index];
                        const tone: PieceColor | null = cell === null ? null : cell === "me" ? colors.me : colors.partner;
                        const marked = winning.has(index);
                        return (
                          <span
                            key={row}
                            className={`aspect-square rounded-full ${
                              tone ? pieceBg(tone) : "bg-bg"
                            } ${marked ? "ring-2 ring-cream" : ""}`}
                          />
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            </div>

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">Четыре в ряд</h1>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">{banner.hint}</p>
            <p className="mt-1 text-[15px] text-muted" aria-live="polite">
              {banner.title}
            </p>

            <div className="mt-4 rounded-[22px] bg-raised px-4 py-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Счёт</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
                <span className="min-w-0 flex-1 truncate text-[16px]">{myName}</span>
                <span className="shrink-0 text-[22px] font-semibold tracking-wide">
                  {view.wins.me}
                  <span className="px-2 text-[#e6e1d6]">:</span>
                  {view.wins.partner}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-[16px]">{partnerName}</span>
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
              </div>
            </div>

            {view.draws > 0 ? <p className="mt-2 text-center text-[13px] text-[#e6e1d6]">Ничьих: {view.draws}</p> : null}
            {notice ? <p className="mt-2 text-center text-[14px] text-pink">{notice}</p> : null}

            {view.status !== "active" ? (
              <button
                type="button"
                onClick={onNew}
                disabled={pending}
                className="mt-5 min-h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg disabled:opacity-60"
              >
                Новая игра
              </button>
            ) : null}
          </>
        )}
      </div>

      {help ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setHelp(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="c4-help-title"
            className="app-frame w-full rounded-t-[28px] bg-raised px-5 pt-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="c4-help-title" className="text-[20px] font-semibold">Как играть</p>
            <p className="mt-3 text-[16px] leading-6 text-[#e6e1d6]">
              Кто нажимает «Новая игра», тот ходит первым. Фишка падает в самый нижний свободный круг столбца.
              Четыре своих подряд — по горизонтали, вертикали или диагонали — победа. Полный столбец нажать нельзя.
              Быть онлайн одновременно не нужно: партия хранится у вас двоих. Цвет фишки — ваш, один и тот же на обоих телефонах.
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
