import { useEffect, useRef, useState } from "react";
import { CircleHelp, Flag, LayoutGrid, Square, Trophy, X } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, type PieceColor } from "@/lib/pair-color";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { DOTS_BOXES, DOTS_SPAN, dotsBanner, type DotsLine, type DotsMark, type DotsMatchView } from "@/lib/turn/dots";
import { loadDotsMatch, openNewDotsMatch, playDotsMove } from "@/lib/turn/server";
import { isConnectionFailure, userMessage } from "@/lib/user-message";

function textOf(error: unknown) {
  return userMessage(error, "Не вышло связаться с партией");
}

function showFailure(error: unknown, setNotice: (value: string) => void) {
  const text = textOf(error);
  if (isConnectionFailure(text)) return;
  setNotice(text);
}

function lineTone(owner: DotsMark, colors: { me: PieceColor; partner: PieceColor }) {
  if (owner === "me") return pieceBg(colors.me);
  if (owner === "partner") return pieceBg(colors.partner);
  return "bg-white/25";
}

function DotsBoard({
  view,
  colors,
  pending,
  onLine,
}: {
  view: DotsMatchView;
  colors: { me: PieceColor; partner: PieceColor };
  pending: boolean;
  onLine?: (kind: DotsLine, index: number) => void;
}) {
  const interactive = Boolean(onLine);
  return (
    <div className={`rounded-[28px] bg-[#16181e] p-4 sm:p-6 ${pending ? "opacity-70" : ""}`}>
      <div className="mx-auto w-full max-w-[24rem] px-6">
        <div className="sq">
          {Array.from({ length: DOTS_SPAN }, (_, row) =>
            Array.from({ length: DOTS_BOXES }, (_, column) => {
              const index = row * DOTS_BOXES + column;
              return (
                <LineButton
                  key={`h-${index}`}
                  label={`Горизонталь ${row + 1}, ${column + 1}`}
                  owner={view.h[index]}
                  marked={view.last?.kind === "h" && view.last.index === index}
                  colors={colors}
                  horizontal
                  disabled={!interactive || !view.myTurn || view.status !== "active" || Boolean(view.h[index]) || pending}
                  onClick={() => onLine?.("h", index)}
                  style={{
                    left: `calc(${column} * 25% + 14px)`,
                    width: "calc(25% - 28px)",
                    top: `calc(${row} * 25% - 22px)`,
                    height: 44,
                  }}
                />
              );
            }),
          )}
          {Array.from({ length: DOTS_BOXES }, (_, row) =>
            Array.from({ length: DOTS_SPAN }, (_, column) => {
              const index = row * DOTS_SPAN + column;
              return (
                <LineButton
                  key={`v-${index}`}
                  label={`Вертикаль ${row + 1}, ${column + 1}`}
                  owner={view.v[index]}
                  marked={view.last?.kind === "v" && view.last.index === index}
                  colors={colors}
                  disabled={!interactive || !view.myTurn || view.status !== "active" || Boolean(view.v[index]) || pending}
                  onClick={() => onLine?.("v", index)}
                  style={{
                    top: `calc(${row} * 25% + 14px)`,
                    height: "calc(25% - 28px)",
                    left: `calc(${column} * 25% - 22px)`,
                    width: 44,
                  }}
                />
              );
            }),
          )}
          {Array.from({ length: DOTS_BOXES }, (_, row) =>
            Array.from({ length: DOTS_BOXES }, (_, column) => {
              const owner = view.boxes[row * DOTS_BOXES + column];
              if (!owner) return null;
              return (
                <span
                  key={`box-${row}-${column}`}
                  className={`pointer-events-none absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${lineTone(owner, colors)}`}
                  style={{ left: `${column * 25 + 12.5}%`, top: `${row * 25 + 12.5}%` }}
                />
              );
            }),
          )}
          {Array.from({ length: DOTS_SPAN }, (_, row) =>
            Array.from({ length: DOTS_SPAN }, (_, column) => (
              <span
                key={`dot-${row}-${column}`}
                className="pointer-events-none absolute z-30 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                style={{ left: `${column * 25}%`, top: `${row * 25}%` }}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

function LineButton({
  label,
  owner,
  marked,
  colors,
  horizontal,
  disabled,
  onClick,
  style,
}: {
  label: string;
  owner: DotsMark;
  marked: boolean;
  colors: { me: PieceColor; partner: PieceColor };
  horizontal?: boolean;
  disabled: boolean;
  onClick: () => void;
  style: { left: string; top: string; width: number | string; height: number | string };
}) {
  return (
    <button
      type="button"
      aria-label={owner ? `${label}, занята` : label}
      disabled={disabled}
      onClick={onClick}
      className="absolute z-10 flex items-center justify-center disabled:opacity-100"
      style={style}
    >
      <span
        className={`rounded-full ${horizontal ? "h-1.5 w-full" : "h-full w-1.5"} ${lineTone(owner, colors)} ${
          marked ? "ring-2 ring-cream ring-offset-2 ring-offset-[#16181e]" : ""
        } ${marked && horizontal ? "h-2" : ""} ${marked && !horizontal ? "w-2" : ""}`}
      />
    </button>
  );
}

const RULES = [
  { icon: Flag, text: "Соединяй соседние точки — одна линия за ход." },
  { icon: Square, text: "Четвёртая сторона квадрата делает его твоим, и ты ходишь ещё раз." },
  { icon: LayoutGrid, text: "Поле 4 × 4. Когда линии кончатся, побеждает тот, у кого больше квадратов." },
  { icon: Trophy, text: "Победы и ничьи добавляют очки в общий счёт." },
];

export function DotsMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteDots = useCouple((s) => s.noteDots);
  const [view, setView] = useState<DotsMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: DotsMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("dots", true, GAME_POLL_MS, async () => {
    try {
      take(await loadDotsMatch());
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
    noteDots(view.winner, `dots:${view.version}`);
  }, [view, noteDots]);

  const reconcile = () =>
    loadDotsMatch()
      .then((next) => setView(next))
      .catch(() => undefined);

  const onLine = (kind: DotsLine, index: number) => {
    if (busy.current || !view || !view.myTurn) return;
    const taken = kind === "h" ? view.h[index] : view.v[index];
    if (taken) return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void playDotsMove({ data: { kind, index, version: view.version } })
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
    void openNewDotsMatch({ data: { version: view.version } })
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

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Точки и квадраты</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("dots")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <DotsBoard view={view} colors={colors} pending={pending} onLine={onLine} />
            </div>

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">Точки и квадраты</h1>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Закрой больше квадратов, чем {partnerName}.</p>
            <p className="mt-1 text-[15px] text-muted" aria-live="polite">
              {dotsBanner(view)}
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
          <div className="app-frame flex w-full flex-col px-5 pb-6" role="dialog" aria-modal="true" aria-labelledby="dots-rules-title">
            <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center pt-2">
              <button type="button" onClick={() => setHelp(false)} className="grid size-11 place-items-center text-[#e6e1d6]" aria-label="Закрыть">
                <X className="size-5" />
              </button>
              <p id="dots-rules-title" className="text-center text-[17px] text-muted">
                Правила
              </p>
              <span className="size-11" />
            </header>
            <DotsBoard view={view} colors={colors} pending={false} />
            <h2 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Точки и квадраты</h2>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Закрыл квадрат — ходи ещё.</p>
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
