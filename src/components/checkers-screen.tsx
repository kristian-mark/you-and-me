import { useEffect, useRef, useState } from "react";
import { CircleHelp, Crown, Flag, MousePointerClick, OctagonAlert, Undo2, X } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, type PieceColor } from "@/lib/pair-color";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { CHECK_SIZE, checkersBanner, type CheckersMatchView } from "@/lib/turn/checkers";
import { loadCheckersMatch, openNewCheckersMatch, playCheckersMove } from "@/lib/turn/server";
import { userMessage } from "@/lib/user-message";

function textOf(error: unknown) {
  return userMessage(error, "Не вышло связаться с партией");
}

function absoluteOf(display: number, flip: boolean) {
  return flip ? 63 - display : display;
}

function CheckersBoard({
  view,
  colors,
  pending,
  selected,
  onSquare,
}: {
  view: CheckersMatchView;
  colors: { me: PieceColor; partner: PieceColor };
  pending: boolean;
  selected: number | null;
  onSquare?: (absolute: number) => void;
}) {
  const lands = new Set(view.moves.filter((move) => move.from === selected).map((move) => move.to));
  const last = new Set(view.last ? [view.last.from, view.last.to] : []);
  return (
    <div className={`rounded-[28px] bg-[#16181e] p-3 sm:p-4 ${pending ? "opacity-70" : ""}`}>
      <div className="mx-auto grid w-full max-w-[28rem] grid-cols-8 overflow-hidden rounded-2xl">
        {Array.from({ length: CHECK_SIZE * CHECK_SIZE }, (_, display) => {
          const index = absoluteOf(display, view.flip);
          const row = Math.floor(index / CHECK_SIZE);
          const column = index % CHECK_SIZE;
          const dark = (row + column) % 2 === 1;
          const owner = view.board[index] ?? null;
          const color: PieceColor | null = owner === "me" ? colors.me : owner === "partner" ? colors.partner : null;
          const chosen = selected === index;
          const marked = last.has(index);
          const square = !dark ? "bg-[#121318]" : marked ? "bg-[#3a3428]" : "bg-[#22242c]";
          return (
            <div key={display} className="sq">
              <button
                type="button"
                aria-label={lands.has(index) ? `Клетка ${display + 1}, можно ходить` : `Клетка ${display + 1}`}
                disabled={!onSquare || pending || !dark}
                onClick={() => onSquare?.(index)}
                className={`sq-fill disabled:opacity-100 ${square}`}
              />
              {color ? (
                <span
                  className={`pointer-events-none absolute grid place-items-center rounded-full ${pieceBg(color)}`}
                  style={{
                    top: "13%",
                    left: "13%",
                    width: "74%",
                    height: "74%",
                    boxShadow: chosen ? "0 0 0 2px #ece8df" : undefined,
                  }}
                >
                  {view.kings[index] ? (
                    <Crown className="text-cream" strokeWidth={2.4} style={{ width: "46%", height: "46%" }} />
                  ) : null}
                </span>
              ) : null}
              {lands.has(index) ? (
                <span className="pointer-events-none absolute rounded-full bg-cream" style={{ top: "42%", left: "42%", width: "16%", height: "16%" }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RULES = [
  { icon: Flag, text: "Забери все фишки партнёра или оставь его без хода." },
  { icon: MousePointerClick, text: "Выбери фишку, потом клетку. Простые шашки ходят вперёд по диагонали на тёмные клетки." },
  { icon: OctagonAlert, text: "Если можешь бить — бей, и несколько фишек за ход тоже." },
  { icon: Undo2, text: "Простые шашки бьют и назад. Дамка ходит и бьёт на одну клетку в любую сторону." },
  { icon: Crown, text: "Дошёл до последней линии — фишка становится дамкой." },
];

export function CheckersMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteCheckers = useCouple((s) => s.noteCheckers);
  const [view, setView] = useState<CheckersMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: CheckersMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("checkers", true, GAME_POLL_MS, async () => {
    try {
      take(await loadCheckersMatch());
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
    if (!view) return;
    if (view.chain != null) {
      setSelected(view.chain);
      return;
    }
    setSelected((current) => (current != null && view.moves.some((move) => move.from === current) ? current : null));
  }, [view]);

  useEffect(() => {
    if (!view || view.status !== "finished" || !view.winner) return;
    noteCheckers(view.winner, `checkers:${view.version}`);
  }, [view, noteCheckers]);

  const reconcile = () =>
    loadCheckersMatch()
      .then((next) => setView(next))
      .catch(() => undefined);

  const onSquare = (index: number) => {
    if (busy.current || !view || !view.myTurn) return;
    if (selected != null && view.moves.some((move) => move.from === selected && move.to === index)) {
      busy.current = true;
      setPending(true);
      noticeFromPoll.current = false;
      setNotice("");
      void playCheckersMove({ data: { from: selected, to: index, version: view.version } })
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
      return;
    }
    const mine = view.board[index] === "me" && view.moves.some((move) => move.from === index);
    if (!mine) return;
    if (view.chain != null && index !== view.chain) return;
    setSelected(index);
  };

  const status = view ? checkersBanner(view) : "";

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-5 pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Шашки</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("checkers")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <CheckersBoard view={view} colors={colors} pending={pending} selected={selected} onSquare={onSquare} />
            </div>

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">Шашки</h1>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Бить обязательно — даже когда не хочется.</p>
            <p className="mt-1 text-[15px] text-muted" aria-live="polite">
              {status}
            </p>

            <div className="mt-4 rounded-[22px] bg-raised px-4 py-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Ваш счёт</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
                <span className="min-w-0 flex-1 truncate text-[16px]">{myName}</span>
                <span className="shrink-0 text-[22px] font-semibold tracking-wide">
                  {view.score.me}
                  <span className="px-2 text-[#e6e1d6]">:</span>
                  {view.score.partner}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-[16px]">{partnerName}</span>
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
              </div>
            </div>

            {notice ? <p className="mt-2 text-center text-[14px] text-pink">{notice}</p> : null}

            {view.status !== "active" ? (
              <button
                type="button"
                onClick={() => {
                  if (busy.current || view.status === "active") return;
                  busy.current = true;
                  setPending(true);
                  noticeFromPoll.current = false;
                  setNotice("");
                  void openNewCheckersMatch({ data: { version: view.version } })
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
                }}
                disabled={pending}
                className="mt-5 min-h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg disabled:opacity-60"
              >
                Новая игра
              </button>
            ) : null}
          </>
        )}
      </div>

      {help && view ? (
        <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-bg">
          <div className="app-frame flex w-full flex-col px-5 pb-6" role="dialog" aria-modal="true" aria-labelledby="checkers-rules-title">
            <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center pt-2">
              <button type="button" onClick={() => setHelp(false)} className="grid size-11 place-items-center text-[#e6e1d6]" aria-label="Закрыть">
                <X className="size-5" />
              </button>
              <p id="checkers-rules-title" className="text-center text-[17px] text-muted">
                Правила
              </p>
              <span className="size-11" />
            </header>
            <CheckersBoard view={view} colors={colors} pending={false} selected={selected} />
            <h2 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Шашки</h2>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Бить обязательно — даже когда не хочется.</p>
            <ul className="mt-4 space-y-4">
              {RULES.map((rule) => {
                const Icon = rule.icon;
                return (
                  <li key={rule.text} className="flex gap-3 text-[16px] leading-6 text-[#e6e1d6]">
                    <Icon className="mt-0.5 size-5 shrink-0 text-blue" strokeWidth={1.7} />
                    <span>{rule.text}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="mt-8 min-h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg"
            >
              Понятно, играем
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
