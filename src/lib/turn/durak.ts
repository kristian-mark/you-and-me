import { TurnRuleError, assertCanAct, otherSeat, type Seat, type TurnSnapshot, type TurnStep } from "./engine.ts";

export type Suit = "s" | "h" | "d" | "c";
export type Card = { suit: Suit; rank: number };
export type Pair = { attack: Card; defend?: Card };
export type DurakPhase = "attack" | "defend" | "throw";

export type DurakState = {
  deck: Card[];
  trump: Suit;
  handA: Card[];
  handB: Card[];
  table: Pair[];
  attacker: Seat;
  defender: Seat;
  phase: DurakPhase;
  limit: number;
  discard: number;
  wins: { a: number; b: number };
  draws: number;
};

export type DurakMove = { kind: "play"; index: number } | { kind: "bito" } | { kind: "take" } | { kind: "finish" };

export type DurakMatchView = {
  version: number;
  updatedAt: string | null;
  status: "idle" | "active" | "finished";
  phase: DurakPhase;
  myTurn: boolean;
  iAttack: boolean;
  winner: "me" | "partner" | "draw" | null;
  hand: Card[];
  table: Pair[];
  trumpSuit: Suit | null;
  trumpCard: Card | null;
  deckCount: number;
  discardCount: number;
  partnerCards: number;
  canBito: boolean;
  canTake: boolean;
  canFinish: boolean;
  wins: { me: number; partner: number };
  draws: number;
};

const SUITS: Suit[] = ["s", "h", "d", "c"];

export function emptyDurakState(): DurakState {
  return {
    deck: [],
    trump: "s",
    handA: [],
    handB: [],
    table: [],
    attacker: "a",
    defender: "b",
    phase: "attack",
    limit: 0,
    discard: 0,
    wins: { a: 0, b: 0 },
    draws: 0,
  };
}

export function sameCard(a: Card, b: Card) {
  return a.suit === b.suit && a.rank === b.rank;
}

export function beats(card: Card, target: Card, trump: Suit) {
  if (card.suit === target.suit) return card.rank > target.rank;
  return card.suit === trump && target.suit !== trump;
}

function handOf(state: DurakState, seat: Seat) {
  return seat === "a" ? state.handA : state.handB;
}

function withHand(state: DurakState, seat: Seat, cards: Card[]): DurakState {
  const sorted = sortHand(cards, state.trump);
  return seat === "a" ? { ...state, handA: sorted } : { ...state, handB: sorted };
}

export function sortHand(cards: Card[], trump: Suit) {
  return cards.slice().sort((a, b) => {
    const trumpOrder = Number(a.suit === trump) - Number(b.suit === trump);
    if (trumpOrder) return trumpOrder;
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });
}

function ranksOn(table: Pair[]) {
  const ranks = new Set<number>();
  for (const pair of table) {
    ranks.add(pair.attack.rank);
    if (pair.defend) ranks.add(pair.defend.rank);
  }
  return ranks;
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const card = value as Card;
  return (SUITS as string[]).includes(card.suit) && Number.isInteger(card.rank) && card.rank >= 6 && card.rank <= 14;
}

function shuffle(cards: Card[], random: () => number) {
  const next = cards.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function freshDeck(random: () => number = Math.random) {
  const cards = SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => ({ suit, rank: index + 6 })));
  return shuffle(cards, random);
}

function lowestTrump(hand: Card[], trump: Suit) {
  return hand.filter((card) => card.suit === trump).sort((a, b) => a.rank - b.rank)[0] ?? null;
}

export function dealDurak(starter: Seat, random: () => number = Math.random): DurakState {
  const deck = freshDeck(random);
  const handA: Card[] = [];
  const handB: Card[] = [];
  for (let i = 0; i < 6; i += 1) {
    handA.push(deck.shift() as Card);
    handB.push(deck.shift() as Card);
  }
  const trump = deck[deck.length - 1].suit;
  const lowA = lowestTrump(handA, trump);
  const lowB = lowestTrump(handB, trump);
  let attacker: Seat = starter;
  if (lowA && lowB) attacker = lowA.rank <= lowB.rank ? "a" : "b";
  else if (lowA) attacker = "a";
  else if (lowB) attacker = "b";
  const defender = otherSeat(attacker);
  return {
    ...emptyDurakState(),
    deck,
    trump,
    handA: sortHand(handA, trump),
    handB: sortHand(handB, trump),
    attacker,
    defender,
  };
}

function drawUp(state: DurakState): DurakState {
  const deck = state.deck.slice();
  const hands = { a: state.handA.slice(), b: state.handB.slice() };
  for (const seat of [state.attacker, state.defender] as const) {
    while (hands[seat].length < 6 && deck.length) hands[seat].push(deck.shift() as Card);
  }
  return {
    ...state,
    deck,
    handA: sortHand(hands.a, state.trump),
    handB: sortHand(hands.b, state.trump),
  };
}

function outcome(state: DurakState): { status: "active" | "finished"; winner: Seat | "draw" | null; turn: Seat | null } {
  if (state.deck.length) return { status: "active", winner: null, turn: state.attacker };
  const aEmpty = state.handA.length === 0;
  const bEmpty = state.handB.length === 0;
  if (!aEmpty && !bEmpty) return { status: "active", winner: null, turn: state.attacker };
  if (aEmpty && bEmpty) return { status: "finished", winner: "draw", turn: null };
  return { status: "finished", winner: aEmpty ? "a" : "b", turn: null };
}

function endStep(state: DurakState, wins: DurakState["wins"], draws: number): TurnStep<DurakState> {
  const result = outcome(state);
  const nextWins = {
    a: wins.a + (result.winner === "a" ? 1 : 0),
    b: wins.b + (result.winner === "b" ? 1 : 0),
  };
  const nextDraws = draws + (result.winner === "draw" ? 1 : 0);
  return {
    state: { ...state, wins: nextWins, draws: nextDraws, phase: "attack", limit: 0 },
    status: result.status,
    turn: result.status === "active" ? result.turn : null,
    winner: result.winner,
  };
}

function giveTable(state: DurakState, seat: Seat) {
  const pile = state.table.flatMap((pair) => (pair.defend ? [pair.attack, pair.defend] : [pair.attack]));
  return withHand({ ...state, table: [], limit: 0 }, seat, [...handOf(state, seat), ...pile]);
}

export function readDurakState(raw: unknown): DurakState {
  const empty = emptyDurakState();
  if (!raw || typeof raw !== "object") return empty;
  const record = raw as Partial<DurakState>;
  const cards = (value: unknown) => (Array.isArray(value) && value.every(isCard) ? (value as Card[]) : null);
  const handA = cards(record.handA);
  const handB = cards(record.handB);
  const deck = cards(record.deck);
  if (!handA || !handB || !deck) return empty;
  if (!Array.isArray(record.table)) return empty;
  const table: Pair[] = [];
  for (const pair of record.table) {
    if (!pair || typeof pair !== "object" || !isCard((pair as Pair).attack)) return empty;
    const defend = (pair as Pair).defend;
    if (defend && !isCard(defend)) return empty;
    table.push({ attack: (pair as Pair).attack, defend });
  }
  if (!(SUITS as string[]).includes(record.trump ?? "")) return empty;
  const attacker = record.attacker === "b" ? "b" : "a";
  const defender = record.defender === "a" || record.defender === "b" ? record.defender : otherSeat(attacker);
  const phase = record.phase === "defend" || record.phase === "throw" ? record.phase : "attack";
  return {
    deck,
    trump: record.trump as Suit,
    handA,
    handB,
    table,
    attacker,
    defender,
    phase,
    limit: typeof record.limit === "number" ? record.limit : 0,
    discard: typeof record.discard === "number" ? record.discard : 0,
    wins: {
      a: typeof record.wins?.a === "number" ? record.wins.a : 0,
      b: typeof record.wins?.b === "number" ? record.wins.b : 0,
    },
    draws: typeof record.draws === "number" ? record.draws : 0,
  };
}

export function presentDurak(
  snapshot: TurnSnapshot<DurakState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): DurakMatchView {
  const state = snapshot.state;
  const attacking = state.attacker === seat;
  const myTurn = snapshot.status === "active" && snapshot.turn === seat;
  const open = state.table.some((pair) => !pair.defend);
  const allBeaten = state.table.length > 0 && state.table.every((pair) => pair.defend);
  return {
    version,
    updatedAt,
    status: snapshot.status,
    phase: state.phase,
    myTurn,
    iAttack: attacking,
    winner: snapshot.winner === "draw" ? "draw" : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null,
    hand: handOf(state, seat),
    table: state.table,
    trumpSuit: snapshot.status === "idle" ? null : state.trump,
    trumpCard: state.deck.length ? state.deck[state.deck.length - 1] : null,
    deckCount: state.deck.length,
    discardCount: state.discard,
    partnerCards: handOf(state, otherSeat(seat)).length,
    canBito: myTurn && attacking && state.phase === "attack" && allBeaten,
    canTake: myTurn && !attacking && state.phase === "defend" && open,
    canFinish: myTurn && attacking && state.phase === "throw",
    wins: {
      me: seat === "a" ? state.wins.a : state.wins.b,
      partner: seat === "a" ? state.wins.b : state.wins.a,
    },
    draws: state.draws,
  };
}

export function idleDurakView(): DurakMatchView {
  return presentDurak({ state: emptyDurakState(), status: "idle", turn: null, winner: null }, 0, "a", null);
}

export function newDurakMatch(previous: DurakState): DurakState {
  return { ...emptyDurakState(), wins: { a: previous.wins.a, b: previous.wins.b }, draws: previous.draws };
}

export function beginDurak(previous: DurakState, seat: Seat): TurnStep<DurakState> {
  const dealt = dealDurak(seat);
  return {
    state: { ...dealt, wins: { a: previous.wins.a, b: previous.wins.b }, draws: previous.draws },
    status: "active",
    turn: dealt.attacker,
    winner: null,
  };
}

export function durakBanner(view: Pick<DurakMatchView, "status" | "myTurn" | "winner" | "phase" | "iAttack" | "table">, partnerName: string) {
  if (view.status === "idle") return { title: "Колода ещё не сдана", hint: `Сбрось карты раньше, чем ${partnerName}.` };
  if (view.status === "finished") {
    if (view.winner === "draw") return { title: "Ничья", hint: "Карты кончились у обоих сразу." };
    if (view.winner === "me") return { title: "Ты не дурак", hint: "Карты кончились у тебя раньше." };
    return { title: "Ты дурак", hint: `Карты остались у тебя. ${partnerName} вышел раньше.` };
  }
  if (!view.myTurn) return { title: `Ход ${partnerName}`, hint: "Можно закрыть экран и вернуться позже." };
  if (view.phase === "defend") return { title: "Побей карту", hint: "Старше той же масти или любой козырь. Иначе «Взять»." };
  if (view.phase === "throw") return { title: "Можно подкинуть", hint: "Того же достоинства, что уже на столе. Потом «Хватит»." };
  if (!view.table.length) return { title: "Твой заход", hint: "Нажми карту — она ляжет на стол." };
  return { title: "Можно подкинуть", hint: "Или скажи «Бито», если всё побито." };
}

function asMove(move: unknown): DurakMove {
  if (!move || typeof move !== "object") throw new TurnRuleError("illegal", "Некорректный ход");
  const raw = move as { kind?: unknown; index?: unknown };
  if (raw.kind === "bito" || raw.kind === "take" || raw.kind === "finish") return { kind: raw.kind };
  if (raw.kind === "play" && typeof raw.index === "number" && Number.isInteger(raw.index) && raw.index >= 0) {
    return { kind: "play", index: raw.index };
  }
  throw new TurnRuleError("illegal", "Некорректный ход");
}

function playCard(state: DurakState, actor: Seat, index: number): TurnStep<DurakState> {
  const hand = handOf(state, actor);
  const card = hand[index];
  if (!card) throw new TurnRuleError("illegal", "Нет такой карты");
  if (state.phase === "defend") {
    if (actor !== state.defender) throw new TurnRuleError("turn", "Сейчас ход партнёра");
    const pairIndex = state.table.findIndex((pair) => !pair.defend && beats(card, pair.attack, state.trump));
    if (pairIndex < 0) throw new TurnRuleError("illegal", "Этой картой не побить");
    const table = state.table.map((pair, i) => (i === pairIndex ? { ...pair, defend: card } : pair));
    const next = withHand({ ...state, table }, actor, hand.filter((_, i) => i !== index));
    if (table.some((pair) => !pair.defend)) {
      return { state: next, status: "active", turn: state.defender, winner: null };
    }
    return { state: { ...next, phase: "attack" }, status: "active", turn: state.attacker, winner: null };
  }
  if (actor !== state.attacker) throw new TurnRuleError("turn", "Сейчас ход партнёра");
  if (state.phase !== "attack" && state.phase !== "throw") throw new TurnRuleError("illegal", "Сейчас нельзя подкидывать");
  const ranks = ranksOn(state.table);
  if (state.table.length && !ranks.has(card.rank)) throw new TurnRuleError("illegal", "Такого достоинства на столе нет");
  const limit = state.table.length === 0 ? Math.min(6, handOf(state, state.defender).length) : state.limit;
  if (limit < 1) throw new TurnRuleError("illegal", "Отбиваться нечем");
  if (state.table.length >= limit) throw new TurnRuleError("illegal", "Больше карт в этот заход нельзя");
  const table = [...state.table, { attack: card }];
  const next = withHand({ ...state, table, limit }, actor, hand.filter((_, i) => i !== index));
  if (state.phase === "throw") return { state: next, status: "active", turn: state.attacker, winner: null };
  return { state: { ...next, phase: "defend" }, status: "active", turn: state.defender, winner: null };
}

export const durakRules = {
  type: "durak",
  empty: emptyDurakState,
  apply(snapshot: TurnSnapshot<DurakState>, actor: Seat, move: DurakMove): TurnStep<DurakState> {
    const action = asMove(move);
    if (snapshot.status !== "active") assertCanAct(snapshot, actor);
    assertCanAct(snapshot, actor);
    const state = snapshot.state;
    if (action.kind === "play") return playCard(state, actor, action.index);
    if (action.kind === "take") {
      if (state.phase !== "defend" || actor !== state.defender) throw new TurnRuleError("turn", "Сейчас ход партнёра");
      if (!state.table.some((pair) => !pair.defend)) throw new TurnRuleError("illegal", "Брать нечего");
      return { state: { ...state, phase: "throw" }, status: "active", turn: state.attacker, winner: null };
    }
    if (action.kind === "finish") {
      if (state.phase !== "throw" || actor !== state.attacker) throw new TurnRuleError("turn", "Сейчас ход партнёра");
      const given = giveTable(state, state.defender);
      const drawn = drawUp(given);
      return endStep({ ...drawn, phase: "attack" }, state.wins, state.draws);
    }
    if (state.phase !== "attack" || actor !== state.attacker) throw new TurnRuleError("turn", "Сейчас ход партнёра");
    if (!state.table.length || state.table.some((pair) => !pair.defend)) throw new TurnRuleError("illegal", "Ещё не всё побито");
    const discard = state.discard + state.table.reduce((sum, pair) => sum + (pair.defend ? 2 : 1), 0);
    const drawn = drawUp({ ...state, table: [], limit: 0, discard });
    const swapped = {
      ...drawn,
      attacker: state.defender,
      defender: state.attacker,
      phase: "attack" as const,
    };
    return endStep(swapped, state.wins, state.draws);
  },
};
