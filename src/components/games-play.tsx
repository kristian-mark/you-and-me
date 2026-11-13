import { useEffect, useState, type ReactNode } from "react";
import { useCouple } from "@/lib/couple-store";
import {
  type Bout,
  type DCard,
  type DurakState,
  type Side,
  cardLabel,
  durakApply,
  durakLegal,
  newDurak,
} from "@/lib/games";

function useNames() {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const name = (side: Side) => (side === "me" ? myName : partnerName);
  return { myName, partnerName, name };
}

function useAward(result: Side | "draw" | null) {
  const addGameWin = useCouple((s) => s.addGameWin);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!result || result === "draw" || sent) return;
    setSent(true);
    addGameWin(result);
  }, [result, sent, addGameWin]);
}

function Shell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto flex min-h-dvh w-full flex-col px-5 pt-6 pb-10 app-frame">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-[17px] text-[#e6e1d6]">
        ‹ Игры
      </button>
      <h1 className="mt-3 text-[32px] font-semibold tracking-tight">{title}</h1>
      {children}
    </section>
  );
}

function Outcome({
  result,
  onAgain,
}: {
  result: Side | "draw";
  onAgain: () => void;
}) {
  const { name } = useNames();
  return (
    <div className="mt-5 rounded-[24px] bg-raised px-4 py-4">
      <p className="text-[22px] font-semibold">{result === "draw" ? "Ничья" : `Победа · ${name(result)}`}</p>
      <button
        type="button"
        onClick={onAgain}
        className="mt-4 w-full rounded-full bg-cream py-3.5 text-[16px] font-semibold text-cream-fg"
      >
        Ещё партию
      </button>
    </div>
  );
}

function CardFace({ card, onClick }: { card: DCard; onClick?: () => void }) {
  const red = card.suit === "h" || card.suit === "d";
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`grid h-[72px] w-12 shrink-0 place-items-center rounded-xl bg-cream text-[15px] font-semibold ${
        red ? "text-suit" : "text-cream-fg"
      }`}
    >
      {cardLabel(card)}
    </button>
  );
}

function TablePair({ pair, active, onClick }: { pair: Bout; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative h-[92px] w-16 ${active ? "rounded-2xl outline outline-2 outline-cream" : ""}`}>
      <span className="absolute top-0 left-0">
        <CardFace card={pair.attack} />
      </span>
      {pair.defend ? (
        <span className="absolute top-4 left-3">
          <CardFace card={pair.defend} />
        </span>
      ) : null}
    </button>
  );
}

export function Durak({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const { name } = useNames();
  const [state, setState] = useState<DurakState>(newDurak);
  const [aim, setAim] = useState(0);
  useAward(state.winner ?? null);
  const legal = durakLegal(state);
  const suits: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

  if (state.view === "cover" && state.phase !== "done") {
    return (
      <Shell title="Дурак" onBack={onBack}>
        <p className="mt-16 text-center text-[15px] text-muted">Передай телефон, карты не подглядывать</p>
        <p className="mt-3 text-center text-[28px] font-semibold">{name(state.nextView)}</p>
        <button
          type="button"
          onClick={() => setState(durakApply(state, { type: "reveal" }))}
          className="mt-8 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg"
        >
          Это я
        </button>
      </Shell>
    );
  }

  const hand = state.view === "cover" ? [] : state.hands[state.view];
  const unbeaten = state.table.map((pair, i) => (!pair.defend ? i : -1)).filter((i) => i >= 0);
  const target = unbeaten.includes(aim) ? aim : unbeaten[0];

  const onCard = (index: number) => {
    if (state.phase === "attack" && legal.some((act) => act.type === "attack" && act.index === index)) {
      setState(durakApply(state, { type: "attack", index }));
      return;
    }
    if (state.phase === "defend" && target !== undefined) {
      const act = legal.find((item) => item.type === "defend" && item.index === index && item.pair === target);
      if (act) setState(durakApply(state, act));
    }
  };

  return (
    <Shell title="Дурак" onBack={onBack}>
      <p className="mt-2 text-[15px] text-muted">
        Козырь {suits[state.trump]} · в колоде {state.deck.length} · у соперника{" "}
        {state.view === "me" ? state.hands.partner.length : state.hands.me.length}
      </p>
      {state.phase !== "done" && state.view !== "cover" ? (
        <p className="mt-1 text-[14px] text-muted">
          {state.view === state.attacker ? `${name(state.view)} атакует` : `${name(state.view)} отбивается`}
        </p>
      ) : null}
      <div className="mt-5 flex min-h-[96px] flex-wrap gap-3">
        {state.table.length === 0 ? <p className="text-muted">Стол пуст</p> : null}
        {state.table.map((pair, i) => (
          <TablePair
            key={`${pair.attack.suit}${pair.attack.rank}-${i}`}
            pair={pair}
            active={state.phase === "defend" && i === target}
            onClick={state.phase === "defend" && !pair.defend ? () => setAim(i) : undefined}
          />
        ))}
      </div>
      {state.phase === "done" && state.winner ? <Outcome result={state.winner} onAgain={onAgain} /> : null}
      {state.phase !== "done" ? (
        <div className="mt-4 flex gap-2">
          {legal.some((act) => act.type === "toDefend") ? (
            <button
              type="button"
              onClick={() => setState(durakApply(state, { type: "toDefend" }))}
              className="rounded-full bg-cream px-4 py-3 text-[15px] font-semibold text-cream-fg"
            >
              На отбой
            </button>
          ) : null}
          {legal.some((act) => act.type === "bito") ? (
            <button
              type="button"
              onClick={() => setState(durakApply(state, { type: "bito" }))}
              className="rounded-full bg-cream px-4 py-3 text-[15px] font-semibold text-cream-fg"
            >
              Бито
            </button>
          ) : null}
          {legal.some((act) => act.type === "take") ? (
            <button
              type="button"
              onClick={() => setState(durakApply(state, { type: "take" }))}
              className="rounded-full bg-raised px-4 py-3 text-[15px]"
            >
              Беру
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {hand.map((card, index) => (
          <CardFace key={`${card.suit}${card.rank}`} card={card} onClick={() => onCard(index)} />
        ))}
      </div>
    </Shell>
  );
}
