import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleHelp, Flag, MousePointerClick, Trophy, X } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, pieceBorder, type PieceColor } from "@/lib/pair-color";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { REV, reversiBanner, type RevMark, type RevMatchView } from "@/lib/turn/reversi";
import { loadReversiMatch, openNewReversiMatch, playReversiMove } from "@/lib/turn/server";
import { isConnectionFailure, userMessage } from "@/lib/user-message";

function textOf(error: unknown) {
  return userMessage(error, "Не вышло связаться с партией");
}

function showFailure(error: unknown, setNotice: (value: string) => void) {
  const text = textOf(error);
  if (isConnectionFailure(text)) return;
  setNotice(text);
}

function tone(owner: RevMark, colors: { me: PieceColor; partner: PieceColor }) {
  if (owner === "me") return colors.me;
  if (owner === "partner") return colors.partner;
  return null;
}

function ReversiBoard({
  view,
  colors,
  pending,
  onCell,
}: {
  view: RevMatchView;
  colors: { me: PieceColor; partner: PieceColor };
  pending: boolean;
  onCell?: (index: number) => void;
}) {
  const legal = new Set(view.legal);
  const flipped = new Set(view.flipped);
  return (
    <div className={`rounded-[28px] bg-[#16181e] p-3 sm:p-4 ${pending ? "opacity-70" : ""}`}>
      <div className="mx-auto grid w-full max-w-[28rem] grid-cols-8 gap-px bg-white/15 p-px">
        {Array.from({ length: REV * REV }, (_, index) => {
          const owner = view.board[index] ?? null;
          const color = tone(owner, colors);
          const can = Boolean(onCell) && legal.has(index);
          const marked = view.last === index;
          const spinning = flipped.has(index);
          return (
            <div key={index} className="sq">
              <button
                type="button"
                aria-label={can ? `Клетка ${index + 1}, можно ходить` : `Клетка ${index + 1}`}
                disabled={!can || pending}
                onClick={() => onCell?.(index)}
                className="sq-fill bg-[#16181e] disabled:opacity-100"
              />
              {color ? (
                <span
                  key={spinning ? `${index}-${view.version}` : index}
                  className={`pointer-events-none absolute rounded-full ${pieceBg(color)} ${spinning ? "disc-flip" : ""}`}
                  style={{
                    top: "14%",
                    left: "14%",
                    width: "72%",
                    height: "72%",
                    boxShadow: marked ? "0 0 0 2px #ece8df" : undefined,
                  }}
                />
              ) : null}
              {can ? (
                <span
                  className={`pointer-events-none absolute rounded-full border-2 ${pieceBorder(colors.me)}`}
                  style={{ top: "33%", left: "33%", width: "34%", height: "34%" }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RULES = [
  { icon: Flag, text: "Поставь фишку так, чтобы чужие оказались на прямой между твоими — они перевернутся." },
  { icon: MousePointerClick, text: "Ходить можно только туда, где что-то переворачивается. Такие клетки отмечены." },
  { icon: ArrowRight, text: "Нет хода — ход переходит партнёру." },
  { icon: Trophy, text: "Когда ходов нет или поле заполнено, побеждает тот, у кого больше фишек." },
];

export function ReversiMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteReversi = useCouple((s) => s.noteReversi);
  const [view, setView] = useState<RevMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: RevMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("reversi", true, GAME_POLL_MS, async () => {
    try {
      take(await loadReversiMatch());
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
    noteReversi(view.winner, `reversi:${view.version}`);
  }, [view, noteReversi]);

  const reconcile = () =>
    loadReversiMatch()
      .then((next) => setView(next))
      .catch(() => undefined);

  const onCell = (index: number) => {
    if (busy.current || !view || !view.myTurn || !view.legal.includes(index)) return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void playReversiMove({ data: { index, version: view.version } })
      .then((next) => take(next))
      .catch((error: unknown) => {
        noticeFromPoll.current = false;
        showFailure(error, setNotice);
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
    void openNewReversiMatch({ data: { version: view.version } })
      .then((next) => setView(next))
      .catch((error: unknown) => {
        noticeFromPoll.current = false;
        showFailure(error, setNotice);
        return reconcile();
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const status = view ? reversiBanner(view, partnerName) : "";
  const passed = Boolean(view?.passed);

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Реверси</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("reversi")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <ReversiBoard view={view} colors={colors} pending={pending} onCell={onCell} />
            </div>

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">Реверси</h1>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Поймай чужие фишки — и они станут твоими.</p>
            <p className={`mt-1 text-[15px] ${passed ? "text-[#e6e1d6]" : "text-muted"}`} aria-live="polite">
              {status}
            </p>

            <div className="mt-4 rounded-[22px] bg-raised px-4 py-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Ваш счёт</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.me)}`} />
                <span className="min-w-[4.75rem] flex-1 truncate text-[15px]">{myName}</span>
                <span className="shrink-0 text-[18px] font-semibold tabular-nums">
                  {view.score.me}
                  <span className="px-1 text-[#e6e1d6]">:</span>
                  {view.score.partner}
                </span>
                <span className="min-w-[4.75rem] flex-1 truncate text-right text-[15px]">{partnerName}</span>
                <span className={`size-3 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
              </div>
            </div>

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

      {help && view ? (
        <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-bg">
          <div className="app-frame flex w-full flex-col px-5 pb-6" role="dialog" aria-modal="true" aria-labelledby="reversi-rules-title">
            <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center pt-2">
              <button type="button" onClick={() => setHelp(false)} className="grid size-11 place-items-center text-[#e6e1d6]" aria-label="Закрыть">
                <X className="size-5" />
              </button>
              <p id="reversi-rules-title" className="text-center text-[17px] text-muted">
                Правила
              </p>
              <span className="size-11" />
            </header>
            <ReversiBoard view={view} colors={colors} pending={false} />
            <h2 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Реверси</h2>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Поймай чужие фишки — и они станут твоими.</p>
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
