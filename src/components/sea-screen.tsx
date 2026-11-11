import { Fragment, useEffect, useRef, useState } from "react";
import { CircleHelp, Crosshair, MousePointerClick, Sailboat, Trophy, X } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, type PieceColor } from "@/lib/pair-color";
import { ScoreLine } from "@/components/score-line";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { SEA, SEA_COLS, seaBanner, type SeaCell, type SeaMatchView } from "@/lib/turn/sea";
import { loadSeaMatch, openNewSeaMatch, playSeaMove } from "@/lib/turn/server";
import { isConnectionFailure, userMessage } from "@/lib/user-message";

function textOf(error: unknown) {
  return userMessage(error, "Не вышло связаться с партией");
}

function showFailure(error: unknown, setNotice: (value: string) => void) {
  const text = textOf(error);
  if (isConnectionFailure(text)) return;
  setNotice(text);
}

const PREVIEW: SeaCell[] = Array.from({ length: 100 }, () => "empty");
function paint(row: number, col: number, cell: SeaCell) {
  PREVIEW[row * SEA + col] = cell;
}
paint(2, 2, "hit");
paint(2, 3, "hit");
paint(4, 4, "sunk");
paint(1, 8, "miss");
paint(5, 6, "miss");
paint(7, 1, "miss");
paint(8, 0, "miss");

function SeaBoard({
  cells,
  mine,
  colors,
  onCell,
}: {
  cells: SeaCell[];
  mine: boolean;
  colors: { me: PieceColor; partner: PieceColor };
  onCell?: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1.15rem_repeat(10,minmax(0,1fr))] gap-0.5">
      <span />
      {SEA_COLS.map((col) => (
        <span key={col} className="pb-0.5 text-center text-[10px] leading-4 text-muted">
          {col}
        </span>
      ))}
      {Array.from({ length: SEA }, (_, row) => (
        <Fragment key={row}>
          <span className="flex items-center justify-end pr-0.5 text-[10px] text-muted">{row + 1}</span>
          {Array.from({ length: SEA }, (_, col) => {
            const index = row * SEA + col;
            const cell = cells[index] ?? "empty";
            const shot = cell === "hit" || cell === "sunk";
            const tone = shot ? pieceBg(mine ? colors.partner : colors.me) : cell === "ship" ? pieceBg(colors.me) : "bg-[#12141a]";
            return (
              <button
                key={col}
                type="button"
                disabled={!onCell || cell !== "empty"}
                onClick={() => onCell?.(index)}
                aria-label={`${SEA_COLS[col]}${row + 1}`}
                className="sq disabled:opacity-100"
              >
                <span className={`sq-fill flex items-center justify-center rounded-[3px] text-[12px] font-semibold text-bg ${tone}`}>
                  {shot ? "×" : cell === "miss" ? <span className="size-1 rounded-full bg-[#8d8a84]" /> : null}
                </span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="rounded-[28px] bg-[#16181e] px-3 py-3">
      <SeaBoard cells={PREVIEW} mine={false} colors={{ me: "blue", partner: "pink" }} />
    </div>
  );
}

const RULES = [
  { icon: Sailboat, text: "Корабли стоят на твоём поле случайно. Они не касаются друг друга, даже углом." },
  { icon: MousePointerClick, text: "Стреляете по очереди: нажми клетку на поле партнёра." },
  { icon: Crosshair, text: "Попадание — стреляешь ещё. Корабль тонет, когда подбиты все его клетки." },
  { icon: Trophy, text: "Кто первым потопит весь флот — победа. Счёт записывается вам обоим." },
];

export function SeaMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteSea = useCouple((s) => s.noteSea);
  const [view, setView] = useState<SeaMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const [pane, setPane] = useState<"target" | "mine">("target");
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: SeaMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("sea", true, GAME_POLL_MS, async () => {
    try {
      take(await loadSeaMatch());
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
    noteSea(view.winner, `sea:${view.version}`);
  }, [view, noteSea]);

  const reconcile = () =>
    loadSeaMatch()
      .then((next) => setView(next))
      .catch(() => undefined);

  const send = (move: { kind: "reshuffle" | "ready" } | { kind: "shot"; index: number }) => {
    if (busy.current || !view) return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void playSeaMove({ data: { ...move, version: view.version } })
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
    void openNewSeaMatch({ data: { version: view.version } })
      .then((next) => {
        setPane("mine");
        setView(next);
      })
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

  const banner = view ? seaBanner(view, partnerName) : null;
  const playing = view && view.status === "active";
  const setup = playing && view.phase === "setup";

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Морской бой</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view || !banner ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("sea")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {playing && view.phase === "fight" ? (
              <div className={`mt-2 ${pending ? "opacity-70" : ""}`}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPane("target")}
                    className={`min-h-11 rounded-full text-[14px] ${pane === "target" ? "bg-cream font-semibold text-cream-fg" : "bg-raised text-muted"}`}
                  >
                    Куда стрелять
                  </button>
                  <button
                    type="button"
                    onClick={() => setPane("mine")}
                    className={`min-h-11 rounded-full text-[14px] ${pane === "mine" ? "bg-cream font-semibold text-cream-fg" : "bg-raised text-muted"}`}
                  >
                    Моё поле
                  </button>
                </div>
                <div className="mt-3 rounded-[28px] bg-[#16181e] px-2 py-3 sm:px-3">
                  <SeaBoard
                    cells={pane === "mine" ? view.mine : view.target}
                    mine={pane === "mine"}
                    colors={colors}
                    onCell={pane === "target" && view.myTurn ? (index) => send({ kind: "shot", index }) : undefined}
                  />
                </div>
              </div>
            ) : playing ? (
              <div className={`mt-2 rounded-[28px] bg-[#16181e] px-2 py-3 sm:px-3 ${pending ? "opacity-70" : ""}`}>
                <SeaBoard cells={view.mine} mine colors={colors} />
              </div>
            ) : (
              <div className="mt-2">
                <PreviewCard />
              </div>
            )}

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">Морской бой</h1>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">{banner.hint}</p>
            <p className="mt-1 text-[15px] text-muted" aria-live="polite">
              {banner.title}
            </p>

            <div className="mt-4 min-w-0 rounded-[22px] bg-raised px-3 py-4 sm:px-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Ваш счёт</p>
              <div className="mt-3">
                <ScoreLine
                  myName={myName}
                  partnerName={partnerName}
                  mine={view.wins.me}
                  theirs={view.wins.partner}
                  myTone={pieceBg(colors.me)}
                  partnerTone={pieceBg(colors.partner)}
                />
              </div>
            </div>

            {notice ? <p className="mt-2 text-center text-[14px] text-pink">{notice}</p> : null}

            {setup && !view.ready.me ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" disabled={pending} onClick={() => send({ kind: "reshuffle" })} className="min-h-14 rounded-full bg-raised text-[16px] font-semibold disabled:opacity-60">
                  Перемешать
                </button>
                <button type="button" disabled={pending} onClick={() => send({ kind: "ready" })} className="min-h-14 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                  Готов
                </button>
              </div>
            ) : null}

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
        <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
          <div className="app-frame flex min-h-dvh flex-col px-5 pt-4 pb-8">
            <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
              <button type="button" onClick={() => setHelp(false)} className="grid size-11 place-items-center" aria-label="Закрыть">
                <X className="size-5" />
              </button>
              <h2 className="text-center text-[17px] font-semibold">Правила</h2>
              <span />
            </header>
            <div className="mt-4">
              <PreviewCard />
            </div>
            <h3 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Морской бой</h3>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Потопи чужой флот первым.</p>
            <ul className="mt-5 space-y-4">
              {RULES.map((rule) => {
                const Icon = rule.icon;
                return (
                  <li key={rule.text} className="flex gap-3 text-[16px] leading-6">
                    <Icon className="mt-0.5 size-5 shrink-0 text-blue" strokeWidth={1.7} />
                    <span>{rule.text}</span>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setHelp(false)} className="mt-8 min-h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg">
              Понятно, играем
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
