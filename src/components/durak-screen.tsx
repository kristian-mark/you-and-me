import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, Layers, MousePointerClick, Plus, Trophy, X } from "lucide-react";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";
import { ScoreLine } from "@/components/score-line";
import { GAME_POLL_MS, pollFailureNotice, refreshScreen, useScreenPoll } from "@/lib/screen-poll";
import { DURAK_CARD_W, durakBanner, handFanStep, type Card, type DurakMatchView, type Suit } from "@/lib/turn/durak";
import { loadDurakMatch, openNewDurakMatch, playDurakMove } from "@/lib/turn/server";
import { isConnectionFailure, userMessage } from "@/lib/user-message";

function textOf(error: unknown) {
  return userMessage(error, "Не вышло связаться с партией");
}

function showFailure(error: unknown, setNotice: (value: string) => void) {
  const text = textOf(error);
  if (isConnectionFailure(text)) return;
  setNotice(text);
}

const RANKS = ["6", "7", "8", "9", "10", "В", "Д", "К", "Т"];
const SUIT: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

function label(card: Card) {
  return `${RANKS[card.rank - 6]}${SUIT[card.suit]}`;
}

function red(card: Card) {
  return card.suit === "h" || card.suit === "d";
}

function Face({ card, selected, onClick }: { card: Card; selected?: boolean; onClick?: () => void }) {
  const className = `relative shrink-0 rounded-xl bg-cream text-left ${selected ? "-translate-y-3 ring-2 ring-blue shadow-[0_10px_18px_rgba(0,0,0,0.45)]" : ""}`;
  const mark = (
    <span className={`absolute top-1 left-1.5 text-[15px] leading-none font-semibold ${red(card) ? "text-[#c43758]" : "text-[#161616]"}`}>
      {label(card)}
    </span>
  );
  if (!onClick) {
    return (
      <div style={{ width: DURAK_CARD_W, height: 90 }} className={className}>
        {mark}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label(card)} style={{ width: DURAK_CARD_W, height: 90 }} className={className}>
      {mark}
    </button>
  );
}

function Back() {
  return <span style={{ width: 28, height: 40 }} className="inline-block shrink-0 rounded-md border border-line bg-[#1a1c22]" />;
}

function DurakArt() {
  return (
    <div className="flex h-40 items-center justify-center rounded-[28px] bg-[#16181e]">
      <div className="relative h-28 w-56">
        <span style={{ width: 64, height: 90 }} className="absolute top-3 left-6 rotate-[-8deg] rounded-xl bg-cream">
          <span className="absolute top-1 left-1.5 text-[15px] font-semibold text-[#c43758]">9♥</span>
        </span>
        <span style={{ width: 64, height: 90 }} className="absolute top-5 left-16 rotate-[6deg] rounded-xl bg-cream">
          <span className="absolute top-1 left-1.5 text-[15px] font-semibold text-[#c43758]">В♥</span>
        </span>
        <span style={{ width: 64, height: 90 }} className="absolute top-4 right-10 rounded-xl bg-[#12141a] ring-1 ring-line">
          <span className="absolute top-3 left-3 size-3 rounded-full bg-blue" />
          <span className="absolute top-3 right-3 size-3 rounded-full bg-pink" />
        </span>
        <span style={{ width: 46, height: 64 }} className="absolute top-7 right-3 rotate-[12deg] rounded-lg bg-cream">
          <span className="absolute top-1 left-1 text-[12px] font-semibold text-[#161616]">Т♠</span>
        </span>
      </div>
    </div>
  );
}

function HandFan({
  cards,
  picked,
  myTurn,
  onPick,
}: {
  cards: Card[];
  picked: number | null;
  myTurn: boolean;
  onPick: (index: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [edges, setEdges] = useState({ left: false, right: false });
  const step = handFanStep(available > 0 ? available - 1 : 240, cards.length);
  const scrolls = available > 0 && DURAK_CARD_W + Math.max(0, cards.length - 1) * step > available + 0.5;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      setAvailable(el.clientWidth);
      setEdges({
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [cards.length, step]);

  const nudge = (direction: number) => box.current?.scrollBy({ left: direction * 72, behavior: "smooth" });

  return (
    <div className="relative mt-4 min-w-0">
      <div ref={box} data-hand-tray className="w-full min-w-0 overflow-x-auto pt-4 pb-1">
        <div className="flex w-max items-end">
          {cards.map((card, index) => (
            <div
              key={`${card.suit}${card.rank}-${index}`}
              className="relative"
              style={{ marginLeft: index ? step - DURAK_CARD_W : 0, zIndex: picked === index ? 40 : index + 1 }}
            >
              <Face card={card} selected={picked === index} onClick={myTurn ? () => onPick(index) : undefined} />
            </div>
          ))}
        </div>
      </div>
      {scrolls && edges.left ? (
        <button
          type="button"
          aria-label="Карты левее"
          onClick={() => nudge(-1)}
          className="absolute top-4 left-0 grid h-[90px] w-9 place-items-center bg-gradient-to-r from-bg via-bg/80 to-transparent text-cream"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {scrolls && edges.right ? (
        <button
          type="button"
          aria-label="Карты правее"
          onClick={() => nudge(1)}
          className="absolute top-4 right-0 grid h-[90px] w-9 place-items-center bg-gradient-to-l from-bg via-bg/80 to-transparent text-cream"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}
    </div>
  );
}

const RULES = [
  { icon: Layers, text: "По шесть карт. Козырь лежит под колодой и берётся последним." },
  { icon: MousePointerClick, text: "Заходи картой. Отбивают старше той же масти или любым козырем." },
  { icon: Plus, text: "Подкидывают достоинство, которое уже на столе. Не больше шести и не больше карт у защищающегося в начале захода." },
  { icon: Trophy, text: "Колода кончилась и карты у тебя кончились раньше — ты не дурак." },
];

export function DurakMatch({ onBack }: { onBack: () => void; onAgain?: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const noteDurak = useCouple((s) => s.noteDurak);
  const [view, setView] = useState<DurakMatchView | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [help, setHelp] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const seenVersion = useRef(-1);
  const busy = useRef(false);
  const pollMisses = useRef(0);
  const noticeFromPoll = useRef(false);

  const take = (next: DurakMatchView) => {
    setView((prev) => {
      if (!prev) return next;
      if (next.version !== prev.version) return next.version > prev.version ? next : prev;
      return (next.updatedAt ?? "") >= (prev.updatedAt ?? "") ? next : prev;
    });
  };

  useScreenPoll("durak", true, GAME_POLL_MS, async () => {
    try {
      take(await loadDurakMatch());
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
      setPicked(null);
    }
    seenVersion.current = view.version;
  }, [view]);

  useEffect(() => {
    if (!view || view.status !== "finished" || !view.winner) return;
    noteDurak(view.winner, `durak:${view.version}`);
  }, [view, noteDurak]);

  const reconcile = () =>
    loadDurakMatch()
      .then((next) => setView(next))
      .catch(() => undefined);

  const send = (move: { kind: "play"; index: number } | { kind: "bito" } | { kind: "take" } | { kind: "finish" }) => {
    if (busy.current || !view) return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void playDurakMove({ data: { ...move, version: view.version } })
      .then((next) => {
        setPicked(null);
        take(next);
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

  const onNew = () => {
    if (busy.current || !view || view.status === "active") return;
    busy.current = true;
    setPending(true);
    noticeFromPoll.current = false;
    setNotice("");
    void openNewDurakMatch({ data: { version: view.version } })
      .then((next) => setView(next))
      .catch(async (error: unknown) => {
        const next = await loadDurakMatch().catch(() => null);
        if (next && next.status === "active") {
          setView(next);
          setNotice("");
          return;
        }
        noticeFromPoll.current = false;
        showFailure(error, setNotice);
        if (next) setView(next);
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  };

  const banner = view ? durakBanner(view, partnerName) : null;
  const live = view && view.status !== "idle";

  return (
    <section className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-bg" data-status={view?.status ?? "loading"}>
      <div className="app-frame safe-pad flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-6">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center pr-2 text-[17px] text-[#e6e1d6]">
            ‹ Игры
          </button>
          <span className="sr-only">Дурак</span>
          <button type="button" onClick={() => setHelp(true)} className="grid size-11 place-items-center justify-self-end text-[#e6e1d6]" aria-label="Правила">
            <CircleHelp className="size-5" />
          </button>
        </header>

        {!view || !banner ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-[17px] text-[#e6e1d6]">{notice || "Открываем партию…"}</p>
              {notice ? (
                <button type="button" onClick={() => void refreshScreen("durak")} className="mt-4 inline-flex min-h-11 items-center text-[16px] text-cream">
                  Ещё раз
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {live ? (
              <div className={`mt-2 min-w-0 ${pending ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-3">
                  {view.trumpCard ? (
                    <Face card={view.trumpCard} />
                  ) : (
                    <span style={{ width: 64, height: 90 }} className="grid place-items-center rounded-xl bg-raised text-[28px]">
                      {view.trumpSuit ? SUIT[view.trumpSuit] : ""}
                    </span>
                  )}
                  <div className="min-w-0 text-[14px] leading-5 text-muted">
                    <p>Козырь {view.trumpSuit ? SUIT[view.trumpSuit] : ""}</p>
                    <p>В колоде {view.deckCount}</p>
                    <p>В отбое {view.discardCount}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[13px] text-muted">У {partnerName} · {view.partnerCards}</p>
                  <div className="mt-2 flex min-w-0 overflow-x-auto">
                    {Array.from({ length: view.partnerCards }, (_, index) => (
                      <span key={index} style={{ marginLeft: index ? -10 : 0 }} className="relative">
                        <Back />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 min-h-28 rounded-[28px] bg-[#16181e] px-3 py-3">
                  {view.table.length ? (
                    <div className="flex flex-wrap gap-2">
                      {view.table.map((pair, index) => (
                        <div key={`${pair.attack.suit}${pair.attack.rank}-${index}`} className="relative h-[104px] w-[78px]">
                          <span className="absolute top-0 left-0">
                            <Face card={pair.attack} />
                          </span>
                          {pair.defend ? (
                            <span className="absolute top-3 left-3">
                              <Face card={pair.defend} />
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-[15px] text-muted">Стол пуст</p>
                  )}
                </div>
                <HandFan
                  cards={view.hand}
                  picked={picked}
                  myTurn={view.myTurn}
                  onPick={(index) => (picked === index ? send({ kind: "play", index }) : setPicked(index))}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {view.canBito ? (
                    <button type="button" disabled={pending} onClick={() => send({ kind: "bito" })} className="min-h-14 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                      Бито
                    </button>
                  ) : null}
                  {view.canTake ? (
                    <button type="button" disabled={pending} onClick={() => send({ kind: "take" })} className="min-h-14 rounded-full bg-raised text-[16px] font-semibold disabled:opacity-60">
                      Взять
                    </button>
                  ) : null}
                  {picked !== null && view.myTurn && view.phase === "defend" ? (
                    <button type="button" disabled={pending} onClick={() => send({ kind: "play", index: picked })} className="min-h-14 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                      Побить
                    </button>
                  ) : null}
                  {picked !== null && view.myTurn && view.phase !== "defend" ? (
                    <button type="button" disabled={pending} onClick={() => send({ kind: "play", index: picked })} className="min-h-14 rounded-full bg-cream text-[16px] font-semibold text-cream-fg disabled:opacity-60">
                      {view.table.length ? "Подкинуть" : "Ходить"}
                    </button>
                  ) : null}
                  {view.canFinish ? (
                    <button type="button" disabled={pending} onClick={() => send({ kind: "finish" })} className="min-h-14 rounded-full bg-raised text-[16px] font-semibold disabled:opacity-60">
                      Хватит
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <DurakArt />
              </div>
            )}

            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Дурак</h1>
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
            {view.draws > 0 ? <p className="mt-2 text-center text-[13px] text-[#e6e1d6]">Ничьих: {view.draws}</p> : null}
            {notice ? <p className="mt-2 text-center text-[14px] text-pink">{notice}</p> : null}
            {view.status !== "active" ? (
              <button type="button" onClick={onNew} disabled={pending} className="mt-5 min-h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg disabled:opacity-60">
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
              <DurakArt />
            </div>
            <h3 className="mt-5 text-[40px] font-semibold leading-none tracking-tight">Дурак</h3>
            <p className="mt-2 text-[16px] leading-6 text-[#e6e1d6]">Подкидной дурак на двоих, колода 36 карт.</p>
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
