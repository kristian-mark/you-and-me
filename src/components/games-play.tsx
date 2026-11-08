import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useCouple } from "@/lib/couple-store";
import {
  DOTS,
  FLEET_LENGTHS,
  type Bout,
  type CheckerMove,
  type DCard,
  type DotsState,
  type DurakState,
  type Piece,
  type RevCell,
  type Ship,
  type ShotMap,
  type Side,
  addShip,
  applyCheckerMove,
  c4Drop,
  c4Winner,
  cardLabel,
  checkerMoves,
  dotsPlace,
  dotsWinner,
  durakApply,
  durakLegal,
  emptyC4,
  emptyCheckers,
  emptyDots,
  emptyReversi,
  fireAt,
  newDurak,
  randomFleet,
  reversiMoves,
  reversiOutcome,
  reversiPlay,
  reversiScore,
  sameSq,
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
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-10">
      <button type="button" onClick={onBack} className="w-fit text-[17px] text-muted">
        ‹ Игры
      </button>
      <h1 className="mt-3 text-[32px] font-semibold tracking-tight">{title}</h1>
      {children}
    </section>
  );
}

function Turn({ side }: { side: Side }) {
  const { name } = useNames();
  return (
    <p className="mt-3 flex items-center gap-2 text-[15px] text-muted">
      <span className={`size-3 rounded-full ${side === "me" ? "bg-blue" : "bg-pink"}`} />
      Ход · {name(side)}
    </p>
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

function pieceClass(side: Side) {
  return side === "me" ? "bg-blue" : "bg-pink";
}

export function ConnectFour({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const [board, setBoard] = useState(emptyC4);
  const [turn, setTurn] = useState<Side>("me");
  const result = c4Winner(board);
  useAward(result);
  return (
    <Shell title="Четыре в ряд" onBack={onBack}>
      {result ? null : <Turn side={turn} />}
      <div className="mx-auto mt-6 grid w-full max-w-[336px] grid-cols-7 gap-1.5 rounded-[24px] bg-raised p-3">
        {board[0].map((_, col) => (
          <button
            key={col}
            type="button"
            disabled={Boolean(result || board[0][col])}
            onClick={() => {
              const dropped = c4Drop(board, col, turn);
              if (!dropped) return;
              setBoard(dropped.board);
              setTurn(turn === "me" ? "partner" : "me");
            }}
            className="grid gap-1.5"
          >
            {board.map((row, r) => (
              <span
                key={r}
                className={`aspect-square rounded-full ${row[col] ? pieceClass(row[col] as Side) : "bg-bg"}`}
              />
            ))}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">Нажми на столбик — фишка упадёт вниз</p>
      {result ? <Outcome result={result} onAgain={onAgain} /> : null}
    </Shell>
  );
}

export function DotsAndBoxes({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const [state, setState] = useState<DotsState>(emptyDots);
  const result = dotsWinner(state);
  useAward(result);
  const play = (kind: "h" | "v", r: number, c: number) => {
    if (result) return;
    const next = dotsPlace(state, kind, r, c);
    if (next) setState(next);
  };
  return (
    <Shell title="Точки и квадраты" onBack={onBack}>
      {result ? null : <Turn side={state.turn} />}
      <p className="mt-1 text-[14px] text-muted">
        {state.scores.me} : {state.scores.partner}
      </p>
      <div className="mt-6 overflow-x-auto">
        {Array.from({ length: DOTS + 1 }, (_, r) => (
          <Fragment key={r}>
            <div className="flex items-center">
              {Array.from({ length: DOTS + 1 }, (_, c) => (
                <Fragment key={c}>
                  <span className="size-3 shrink-0 rounded-full bg-muted" />
                  {c < DOTS ? (
                    <button
                      type="button"
                      aria-label="Линия"
                      onClick={() => play("h", r, c)}
                      className="grid h-8 w-11 place-items-center"
                    >
                      <span
                        className={`h-1.5 w-8 rounded-full ${
                          state.h[r][c] ? pieceClass(state.h[r][c] as Side) : "bg-chip"
                        }`}
                      />
                    </button>
                  ) : null}
                </Fragment>
              ))}
            </div>
            {r < DOTS ? (
              <div className="flex">
                {Array.from({ length: DOTS + 1 }, (_, c) => (
                  <Fragment key={c}>
                    <button
                      type="button"
                      aria-label="Линия"
                      onClick={() => play("v", r, c)}
                      className="grid h-11 w-3 place-items-center"
                    >
                      <span
                        className={`h-8 w-1.5 rounded-full ${
                          state.v[r][c] ? pieceClass(state.v[r][c] as Side) : "bg-chip"
                        }`}
                      />
                    </button>
                    {c < DOTS ? (
                      <div className="grid h-11 w-11 place-items-center">
                        {state.boxes[r][c] ? (
                          <span className={`size-7 rounded-lg ${pieceClass(state.boxes[r][c] as Side)}`} />
                        ) : null}
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
      {result ? <Outcome result={result} onAgain={onAgain} /> : null}
    </Shell>
  );
}

export function Reversi({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const [board, setBoard] = useState<RevCell[][]>(emptyReversi);
  const [turn, setTurn] = useState<Side>("me");
  const moves = reversiMoves(board, turn);
  const passed = moves.length === 0 && reversiMoves(board, turn === "me" ? "partner" : "me").length > 0;
  const result = reversiOutcome(board);
  const score = reversiScore(board);
  useAward(result);
  const side = passed ? (turn === "me" ? "partner" : "me") : turn;
  const legal = new Set(reversiMoves(board, side).map((m) => `${m.r},${m.c}`));
  return (
    <Shell title="Реверси" onBack={onBack}>
      {result ? null : <Turn side={side} />}
      <p className="mt-1 text-[14px] text-muted">
        {score.me} : {score.partner}
        {passed ? " · ход переходит" : ""}
      </p>
      <div className="mt-5 grid grid-cols-8 gap-1 rounded-[24px] bg-raised p-2">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const can = !result && legal.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={!can}
                onClick={() => {
                  const next = reversiPlay(board, r, c, side);
                  if (!next) return;
                  const opp = side === "me" ? "partner" : "me";
                  setBoard(next);
                  setTurn(reversiMoves(next, opp).length ? opp : side);
                }}
                className="grid aspect-square place-items-center rounded-md bg-bg"
              >
                {cell ? <span className={`size-[70%] rounded-full ${pieceClass(cell)}`} /> : null}
                {can ? <span className={`size-2 rounded-full ${side === "me" ? "bg-blue" : "bg-pink"}`} /> : null}
              </button>
            );
          }),
        )}
      </div>
      {result ? <Outcome result={result} onAgain={onAgain} /> : null}
    </Shell>
  );
}

export function Checkers({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const [board, setBoard] = useState<Piece[][]>(emptyCheckers);
  const [turn, setTurn] = useState<Side>("me");
  const [quiet, setQuiet] = useState(0);
  const [from, setFrom] = useState<{ r: number; c: number } | null>(null);
  const moves = checkerMoves(board, turn);
  const result: Side | "draw" | null = moves.length === 0 ? (turn === "me" ? "partner" : "me") : quiet >= 60 ? "draw" : null;
  useAward(result);
  const mine = from ? moves.filter((m) => sameSq(m.from, from)) : [];
  const play = (move: CheckerMove) => {
    const captured = move.steps.some((step) => step.cap);
    setBoard(applyCheckerMove(board, move));
    setFrom(null);
    setQuiet(captured ? 0 : quiet + 1);
    setTurn(turn === "me" ? "partner" : "me");
  };
  return (
    <Shell title="Шашки" onBack={onBack}>
      {result ? null : <Turn side={turn} />}
      <p className="mt-1 text-[13px] text-muted">
        {moves.some((m) => m.steps.some((s) => s.cap)) ? "Нужно бить. Дамка ходит на любое число клеток." : "Ход по диагонали."}
      </p>
      <div className="mt-4 grid grid-cols-8 overflow-hidden rounded-[20px]">
        {board.map((row, r) =>
          row.map((piece, c) => {
            const dark = (r + c) % 2 === 1;
            const targets = mine.filter((m) => sameSq(m.steps[m.steps.length - 1], { r, c }));
            const selected = from && sameSq(from, { r, c });
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={!dark || Boolean(result)}
                onClick={() => {
                  if (targets.length) {
                    play(targets[0]);
                    return;
                  }
                  if (piece?.side === turn) setFrom({ r, c });
                }}
                className={`grid aspect-square place-items-center ${dark ? "bg-chip" : "bg-bg"} ${selected ? "outline outline-2 outline-cream" : ""}`}
              >
                {piece ? (
                  <span
                    className={`size-[68%] rounded-full ${pieceClass(piece.side)} ${piece.king ? "outline outline-2 outline-cream" : ""}`}
                  />
                ) : targets.length ? (
                  <span className="size-2.5 rounded-full bg-cream" />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      {result ? <Outcome result={result} onAgain={onAgain} /> : null}
    </Shell>
  );
}

function SeaGrid({
  ships,
  shots,
  hide,
  onCell,
}: {
  ships: Ship[];
  shots: ShotMap;
  hide: boolean;
  onCell?: (r: number, c: number) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-px overflow-hidden rounded-2xl bg-line">
      {Array.from({ length: 100 }, (_, i) => {
        const r = Math.floor(i / 10);
        const c = i % 10;
        const ship = ships.find((item) => item.cells.some((cell) => cell.r === r && cell.c === c));
        const shot = shots[`${r},${c}`];
        const sunk = ship && ship.hits >= ship.cells.length;
        let tone = "bg-bg";
        if (shot === "miss") tone = "bg-chip";
        else if (shot === "hit") tone = sunk ? "bg-pink" : "bg-blue";
        else if (ship && !hide) tone = "bg-blue";
        return (
          <button
            key={i}
            type="button"
            disabled={!onCell}
            onClick={() => onCell?.(r, c)}
            className={`aspect-square ${tone}`}
            aria-label={`${r + 1} ${c + 1}`}
          />
        );
      })}
    </div>
  );
}

export function Battleship({ onBack, onAgain }: { onBack: () => void; onAgain: () => void }) {
  const { name } = useNames();
  const [fleets, setFleets] = useState<Record<Side, Ship[]>>({ me: [], partner: [] });
  const [shots, setShots] = useState<Record<Side, ShotMap>>({ me: {}, partner: {} });
  const [horiz, setHoriz] = useState(true);
  const [phase, setPhase] = useState<{ kind: "place" | "pass" | "fight" | "end"; who: Side; note?: string }>({
    kind: "place",
    who: "me",
  });
  const [winner, setWinner] = useState<Side | null>(null);
  useAward(winner);
  const who = phase.who;
  const nextLen = FLEET_LENGTHS[fleets[who].length];

  const place = (r: number, c: number) => {
    if (phase.kind !== "place" || nextLen === undefined) return;
    const next = addShip(fleets[who], r, c, nextLen, horiz);
    if (!next) return;
    const fleetsNext = { ...fleets, [who]: next };
    setFleets(fleetsNext);
    if (next.length === FLEET_LENGTHS.length) {
      const otherSide: Side = who === "me" ? "partner" : "me";
      if (who === "me") setPhase({ kind: "pass", who: otherSide, note: "Расставь корабли" });
      else setPhase({ kind: "pass", who: "me", note: "Первый выстрел" });
    }
  };

  const randomize = () => {
    const fleet = randomFleet();
    const fleetsNext = { ...fleets, [who]: fleet };
    setFleets(fleetsNext);
    const otherSide: Side = who === "me" ? "partner" : "me";
    if (who === "me") setPhase({ kind: "pass", who: otherSide, note: "Расставь корабли" });
    else setPhase({ kind: "pass", who: "me", note: "Первый выстрел" });
  };

  const shoot = (r: number, c: number) => {
    if (phase.kind !== "fight") return;
    const enemy: Side = who === "me" ? "partner" : "me";
    const res = fireAt(fleets[enemy], shots[enemy], r, c);
    if (res.result === "repeat") return;
    setFleets({ ...fleets, [enemy]: res.ships });
    setShots({ ...shots, [enemy]: res.shots });
    if (res.result === "win") {
      setWinner(who);
      setPhase({ kind: "end", who });
      return;
    }
    const note = res.result === "sunk" ? "Потопил" : res.result === "hit" ? "Попадание" : "Мимо";
    setPhase({ kind: "pass", who: enemy, note });
  };

  if (phase.kind === "pass") {
    return (
      <Shell title="Морской бой" onBack={onBack}>
        <p className="mt-16 text-center text-[15px] text-muted">Передай телефон</p>
        <p className="mt-3 text-center text-[28px] font-semibold">{name(phase.who)}</p>
        {phase.note ? <p className="mt-2 text-center text-muted">{phase.note}</p> : null}
        <button
          type="button"
          onClick={() =>
            setPhase(
              fleets[phase.who].length < FLEET_LENGTHS.length
                ? { kind: "place", who: phase.who }
                : { kind: "fight", who: phase.who },
            )
          }
          className="mt-8 w-full rounded-full bg-cream py-4 text-[17px] font-semibold text-cream-fg"
        >
          Это я
        </button>
      </Shell>
    );
  }

  if (phase.kind === "place") {
    return (
      <Shell title="Морской бой" onBack={onBack}>
        <p className="mt-2 text-[15px] text-muted">{name(who)} ставит корабли. Соседние борта нельзя.</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setHoriz((v) => !v)}
            className="rounded-full bg-raised px-4 py-2 text-[14px]"
          >
            {horiz ? "Горизонтально" : "Вертикально"}
          </button>
          <button type="button" onClick={randomize} className="rounded-full bg-raised px-4 py-2 text-[14px]">
            Случайно
          </button>
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {nextLen ? `Сейчас корабль на ${nextLen}` : "Все на месте"} · {fleets[who].length}/{FLEET_LENGTHS.length}
        </p>
        <div className="mt-4">
          <SeaGrid ships={fleets[who]} shots={{}} hide={false} onCell={place} />
        </div>
      </Shell>
    );
  }

  const enemy: Side = who === "me" ? "partner" : "me";
  return (
    <Shell title="Морской бой" onBack={onBack}>
      {winner ? null : <Turn side={who} />}
      <p className="mt-4 text-[13px] tracking-[0.14em] text-muted uppercase">куда стреляешь</p>
      <div className="mt-2">
        <SeaGrid ships={fleets[enemy]} shots={shots[enemy]} hide onCell={winner ? undefined : shoot} />
      </div>
      <p className="mt-5 text-[13px] tracking-[0.14em] text-muted uppercase">твоё поле</p>
      <div className="mt-2">
        <SeaGrid ships={fleets[who]} shots={shots[who]} hide={false} />
      </div>
      {winner ? <Outcome result={winner} onAgain={onAgain} /> : null}
    </Shell>
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
