export type Side = "me" | "partner";

export function other(side: Side): Side {
  return side === "me" ? "partner" : "me";
}

export type Mark = Side | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function tttLine(board: Mark[]): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export function tttWinner(board: Mark[]): Side | "draw" | null {
  const line = tttLine(board);
  if (line) return board[line[0]];
  if (board.every(Boolean)) return "draw";
  return null;
}

export const C4_ROWS = 6;
export const C4_COLS = 7;

export function emptyC4(): Mark[][] {
  return Array.from({ length: C4_ROWS }, () => Array.from({ length: C4_COLS }, () => null));
}

export function c4Drop(board: Mark[][], col: number, side: Side): { board: Mark[][]; row: number } | null {
  if (col < 0 || col >= C4_COLS || board[0][col]) return null;
  const next = board.map((row) => row.slice());
  for (let row = C4_ROWS - 1; row >= 0; row -= 1) {
    if (!next[row][col]) {
      next[row][col] = side;
      return { board: next, row };
    }
  }
  return null;
}

export function c4Winner(board: Mark[][]): Side | "draw" | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r += 1) {
    for (let c = 0; c < C4_COLS; c += 1) {
      const side = board[r][c];
      if (!side) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k += 1) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || cc < 0 || rr >= C4_ROWS || cc >= C4_COLS || board[rr][cc] !== side) {
            ok = false;
            break;
          }
        }
        if (ok) return side;
      }
    }
  }
  if (board[0].every(Boolean)) return "draw";
  return null;
}

export const DOTS = 4;

export type LineOwner = Side | null;

export type DotsState = {
  h: LineOwner[][];
  v: LineOwner[][];
  boxes: LineOwner[][];
  turn: Side;
  scores: { me: number; partner: number };
};

export function emptyDots(): DotsState {
  const n = DOTS;
  return {
    h: Array.from({ length: n + 1 }, () => Array.from({ length: n }, () => null)),
    v: Array.from({ length: n }, () => Array.from({ length: n + 1 }, () => null)),
    boxes: Array.from({ length: n }, () => Array.from({ length: n }, () => null)),
    turn: "me",
    scores: { me: 0, partner: 0 },
  };
}

function boxReady(s: DotsState, r: number, c: number) {
  return Boolean(s.h[r][c] && s.h[r + 1][c] && s.v[r][c] && s.v[r][c + 1]);
}

export function dotsPlace(state: DotsState, kind: "h" | "v", r: number, c: number): DotsState | null {
  if (kind === "h") {
    if (!state.h[r] || state.h[r][c] !== null) return null;
  } else if (!state.v[r] || state.v[r][c] !== null) return null;
  const h = state.h.map((row) => row.slice());
  const v = state.v.map((row) => row.slice());
  const boxes = state.boxes.map((row) => row.slice());
  if (kind === "h") h[r][c] = state.turn;
  else v[r][c] = state.turn;
  const next: DotsState = { ...state, h, v, boxes, scores: { ...state.scores } };
  let claimed = 0;
  const candidates =
    kind === "h"
      ? [
          [r - 1, c],
          [r, c],
        ]
      : [
          [r, c - 1],
          [r, c],
        ];
  for (const [br, bc] of candidates) {
    if (br < 0 || bc < 0 || br >= DOTS || bc >= DOTS) continue;
    if (!boxes[br][bc] && boxReady(next, br, bc)) {
      boxes[br][bc] = state.turn;
      claimed += 1;
    }
  }
  if (claimed) next.scores[state.turn] += claimed;
  else next.turn = other(state.turn);
  const total = DOTS * DOTS;
  if (next.scores.me + next.scores.partner === total) {
    return next;
  }
  return next;
}

export function dotsWinner(s: DotsState): Side | "draw" | null {
  if (s.scores.me + s.scores.partner < DOTS * DOTS) return null;
  if (s.scores.me === s.scores.partner) return "draw";
  return s.scores.me > s.scores.partner ? "me" : "partner";
}

export type RevCell = Side | null;

export function emptyReversi(): RevCell[][] {
  const b: RevCell[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  b[3][3] = "partner";
  b[3][4] = "me";
  b[4][3] = "me";
  b[4][4] = "partner";
  return b;
}

const REV_DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function reversiFlips(board: RevCell[][], r: number, c: number, side: Side): [number, number][] {
  if (board[r][c]) return [];
  const flips: [number, number][] = [];
  for (const [dr, dc] of REV_DIRS) {
    const line: [number, number][] = [];
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && cc >= 0 && rr < 8 && cc < 8 && board[rr][cc] && board[rr][cc] !== side) {
      line.push([rr, cc]);
      rr += dr;
      cc += dc;
    }
    if (line.length && rr >= 0 && cc >= 0 && rr < 8 && cc < 8 && board[rr][cc] === side) {
      flips.push(...line);
    }
  }
  return flips;
}

export function reversiMoves(board: RevCell[][], side: Side) {
  const moves: { r: number; c: number; flips: [number, number][] }[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const flips = reversiFlips(board, r, c, side);
      if (flips.length) moves.push({ r, c, flips });
    }
  }
  return moves;
}

export function reversiPlay(board: RevCell[][], r: number, c: number, side: Side): RevCell[][] | null {
  const flips = reversiFlips(board, r, c, side);
  if (!flips.length) return null;
  const next = board.map((row) => row.slice());
  next[r][c] = side;
  for (const [fr, fc] of flips) next[fr][fc] = side;
  return next;
}

export function reversiScore(board: RevCell[][]) {
  let me = 0;
  let partner = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === "me") me += 1;
      else if (cell === "partner") partner += 1;
    }
  }
  return { me, partner };
}

export function reversiOutcome(board: RevCell[][]): Side | "draw" | null {
  if (reversiMoves(board, "me").length || reversiMoves(board, "partner").length) return null;
  const { me, partner } = reversiScore(board);
  if (me === partner) return "draw";
  return me > partner ? "me" : "partner";
}

export type Piece = { side: Side; king: boolean } | null;
export type Sq = { r: number; c: number };
export type CapStep = Sq & { cap?: Sq };
export type CheckerMove = { from: Sq; steps: CapStep[] };

const KING_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function emptyCheckers(): Piece[][] {
  const board: Piece[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) board[r][c] = { side: "partner", king: false };
      else if (r > 4) board[r][c] = { side: "me", king: false };
    }
  }
  return board;
}

function inside(r: number, c: number) {
  return r >= 0 && c >= 0 && r < 8 && c < 8;
}

function manCaps(board: Piece[][], r: number, c: number, side: Side): CapStep[] {
  const out: CapStep[] = [];
  for (const [dr, dc] of KING_DIRS) {
    const er = r + dr;
    const ec = c + dc;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (!inside(lr, lc)) continue;
    const enemy = board[er][ec];
    if (enemy && enemy.side !== side && !board[lr][lc]) out.push({ r: lr, c: lc, cap: { r: er, c: ec } });
  }
  return out;
}

function kingCaps(board: Piece[][], r: number, c: number, side: Side): CapStep[] {
  const out: CapStep[] = [];
  for (const [dr, dc] of KING_DIRS) {
    let rr = r + dr;
    let cc = c + dc;
    let seen: Sq | null = null;
    while (inside(rr, cc)) {
      const piece = board[rr][cc];
      if (!piece) {
        if (seen) out.push({ r: rr, c: cc, cap: seen });
      } else if (seen || piece.side === side) break;
      else seen = { r: rr, c: cc };
      rr += dr;
      cc += dc;
    }
  }
  return out;
}

function applyCheckerStep(board: Piece[][], from: Sq, step: CapStep): Piece[][] {
  const next = board.map((row) => row.slice());
  const piece = next[from.r][from.c];
  if (!piece) return next;
  next[from.r][from.c] = null;
  if (step.cap) next[step.cap.r][step.cap.c] = null;
  const end = piece.side === "me" ? 0 : 7;
  next[step.r][step.c] = { side: piece.side, king: piece.king || step.r === end };
  return next;
}

function captureSeqs(board: Piece[][], r: number, c: number): CheckerMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const seqs: CapStep[][] = [];
  const walk = (b: Piece[][], cr: number, cc: number, steps: CapStep[]) => {
    const current = b[cr][cc];
    if (!current) return;
    const opts = current.king ? kingCaps(b, cr, cc, current.side) : manCaps(b, cr, cc, current.side);
    if (!opts.length) {
      if (steps.length) seqs.push(steps);
      return;
    }
    for (const step of opts) {
      const wasKing = current.king;
      const next = applyCheckerStep(b, { r: cr, c: cc }, step);
      const promoted = !wasKing && next[step.r][step.c]?.king;
      if (promoted) seqs.push([...steps, step]);
      else walk(next, step.r, step.c, [...steps, step]);
    }
  };
  walk(board, r, c, []);
  return seqs.map((steps) => ({ from: { r, c }, steps }));
}

function quietMoves(board: Piece[][], r: number, c: number): CheckerMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const steps: CapStep[] = [];
  if (piece.king) {
    for (const [dr, dc] of KING_DIRS) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc) && !board[rr][cc]) {
        steps.push({ r: rr, c: cc });
        rr += dr;
        cc += dc;
      }
    }
  } else {
    const dir = piece.side === "me" ? -1 : 1;
    for (const dc of [-1, 1]) {
      const rr = r + dir;
      const cc = c + dc;
      if (inside(rr, cc) && !board[rr][cc]) steps.push({ r: rr, c: cc });
    }
  }
  return steps.map((step) => ({ from: { r, c }, steps: [step] }));
}

export function checkerMoves(board: Piece[][], side: Side): CheckerMove[] {
  const caps: CheckerMove[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (board[r][c]?.side === side) caps.push(...captureSeqs(board, r, c));
    }
  }
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.steps.length));
    return caps.filter((m) => m.steps.length === max);
  }
  const quiet: CheckerMove[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (board[r][c]?.side === side) quiet.push(...quietMoves(board, r, c));
    }
  }
  return quiet;
}

export function applyCheckerMove(board: Piece[][], move: CheckerMove): Piece[][] {
  let next = board;
  let from = move.from;
  for (const step of move.steps) {
    next = applyCheckerStep(next, from, step);
    from = step;
  }
  return next;
}

export function sameSq(a: Sq, b: Sq) {
  return a.r === b.r && a.c === b.c;
}

export const FLEET_LENGTHS = [4, 3, 3, 2, 2];

export type Ship = { cells: Sq[]; hits: number };

function keyOf(r: number, c: number) {
  return `${r},${c}`;
}

function shipCells(r: number, c: number, len: number, horiz: boolean): Sq[] {
  return Array.from({ length: len }, (_, i) => ({ r: r + (horiz ? 0 : i), c: c + (horiz ? i : 0) }));
}

function canLay(taken: Set<string>, cells: Sq[]) {
  for (const cell of cells) {
    if (cell.r < 0 || cell.c < 0 || cell.r > 9 || cell.c > 9) return false;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (taken.has(keyOf(cell.r + dr, cell.c + dc))) return false;
      }
    }
  }
  return true;
}

export function occupy(ships: Ship[]) {
  const set = new Set<string>();
  for (const ship of ships) for (const cell of ship.cells) set.add(keyOf(cell.r, cell.c));
  return set;
}

export function addShip(ships: Ship[], r: number, c: number, len: number, horiz: boolean): Ship[] | null {
  const cells = shipCells(r, c, len, horiz);
  if (!canLay(occupy(ships), cells)) return null;
  return [...ships, { cells, hits: 0 }];
}

export function randomFleet(): Ship[] {
  let ships: Ship[] = [];
  for (const len of FLEET_LENGTHS) {
    let placed = false;
    for (let attempt = 0; attempt < 400 && !placed; attempt += 1) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horiz ? 10 : 11 - len));
      const c = Math.floor(Math.random() * (horiz ? 11 - len : 10));
      const next = addShip(ships, r, c, len, horiz);
      if (next) {
        ships = next;
        placed = true;
      }
    }
    if (!placed) return randomFleet();
  }
  return ships;
}

export type ShotMap = Record<string, "hit" | "miss">;

export function fireAt(ships: Ship[], shots: ShotMap, r: number, c: number): { ships: Ship[]; shots: ShotMap; result: "hit" | "miss" | "sunk" | "win" | "repeat" } {
  const k = keyOf(r, c);
  if (shots[k]) return { ships, shots, result: "repeat" };
  const index = ships.findIndex((ship) => ship.cells.some((cell) => cell.r === r && cell.c === c));
  if (index < 0) return { ships, shots: { ...shots, [k]: "miss" }, result: "miss" };
  const shipsNext = ships.map((ship, i) => (i === index ? { ...ship, hits: ship.hits + 1 } : ship));
  const sunk = shipsNext[index].hits >= shipsNext[index].cells.length;
  const win = shipsNext.every((ship) => ship.hits >= ship.cells.length);
  return { ships: shipsNext, shots: { ...shots, [k]: "hit" }, result: win ? "win" : sunk ? "sunk" : "hit" };
}

export type Suit = "s" | "h" | "d" | "c";
export type DCard = { suit: Suit; rank: number };
export type Bout = { attack: DCard; defend?: DCard };

export type DurakState = {
  deck: DCard[];
  trump: Suit;
  hands: Record<Side, DCard[]>;
  table: Bout[];
  attacker: Side;
  defender: Side;
  phase: "attack" | "defend" | "done";
  view: Side | "cover";
  nextView: Side;
  winner?: Side | "draw";
};

export type DurakAct =
  | { type: "reveal" }
  | { type: "attack"; index: number }
  | { type: "toDefend" }
  | { type: "defend"; index: number; pair: number }
  | { type: "take" }
  | { type: "bito" };

const SUITS: Suit[] = ["s", "h", "d", "c"];

function shuffle(cards: DCard[]) {
  const next = cards.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sortHand(cards: DCard[], trump: Suit) {
  return cards.slice().sort((a, b) => {
    const at = a.suit === trump ? 1 : 0;
    const bt = b.suit === trump ? 1 : 0;
    if (at !== bt) return at - bt;
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });
}

export function cardLabel(card: DCard) {
  const ranks = ["6", "7", "8", "9", "10", "В", "Д", "К", "Т"];
  const suits: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
  return `${ranks[card.rank - 6]}${suits[card.suit]}`;
}

export function beats(card: DCard, target: DCard, trump: Suit) {
  if (card.suit === target.suit) return card.rank > target.rank;
  return card.suit === trump && target.suit !== trump;
}

function tableRanks(table: Bout[]) {
  const ranks = new Set<number>();
  for (const pair of table) {
    ranks.add(pair.attack.rank);
    if (pair.defend) ranks.add(pair.defend.rank);
  }
  return ranks;
}

function canAdd(s: DurakState, card: DCard) {
  if (s.table.length >= 6) return false;
  const unbeaten = s.table.filter((pair) => !pair.defend).length;
  if (unbeaten + 1 > s.hands[s.defender].length) return false;
  if (!s.table.length) return true;
  return tableRanks(s.table).has(card.rank);
}

function copyHands(s: DurakState): Record<Side, DCard[]> {
  return { me: s.hands.me.slice(), partner: s.hands.partner.slice() };
}

function drawUp(s: DurakState): DurakState {
  const deck = s.deck.slice();
  const hands = copyHands(s);
  for (const side of [s.attacker, s.defender]) {
    while (hands[side].length < 6 && deck.length) hands[side].push(deck.shift() as DCard);
  }
  return {
    ...s,
    deck,
    hands: { me: sortHand(hands.me, s.trump), partner: sortHand(hands.partner, s.trump) },
  };
}

function finish(s: DurakState): DurakState {
  if (s.deck.length) return s;
  const me0 = s.hands.me.length === 0;
  const p0 = s.hands.partner.length === 0;
  if (!me0 && !p0) return s;
  if (me0 && p0) return { ...s, phase: "done", winner: "draw", view: "me" };
  if (me0) return { ...s, phase: "done", winner: "me", view: "me" };
  return { ...s, phase: "done", winner: "partner", view: "me" };
}

function cover(s: DurakState, nextView: Side, phase: DurakState["phase"] = s.phase): DurakState {
  return { ...s, phase, view: "cover", nextView };
}

export function newDurak(): DurakState {
  const deck = shuffle(
    SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, i) => ({ suit, rank: i + 6 }))),
  );
  const trump = deck[deck.length - 1].suit;
  const hands: Record<Side, DCard[]> = { me: [], partner: [] };
  for (let i = 0; i < 6; i += 1) {
    hands.me.push(deck.shift() as DCard);
    hands.partner.push(deck.shift() as DCard);
  }
  const lowest = (side: Side) =>
    hands[side]
      .filter((card) => card.suit === trump)
      .sort((a, b) => a.rank - b.rank)[0];
  const mine = lowest("me");
  const theirs = lowest("partner");
  let attacker: Side = "me";
  if (mine && theirs) attacker = mine.rank <= theirs.rank ? "me" : "partner";
  else if (!mine && theirs) attacker = "partner";
  return {
    deck,
    trump,
    hands: { me: sortHand(hands.me, trump), partner: sortHand(hands.partner, trump) },
    table: [],
    attacker,
    defender: other(attacker),
    phase: "attack",
    view: "cover",
    nextView: attacker,
  };
}

export function durakLegal(s: DurakState): DurakAct[] {
  if (s.phase === "done") return [];
  if (s.view === "cover") return [{ type: "reveal" }];
  const view: Side = s.view;
  const acts: DurakAct[] = [];
  if (s.phase === "attack" && view === s.attacker) {
    s.hands[view].forEach((card, index) => {
      if (canAdd(s, card)) acts.push({ type: "attack", index });
    });
    if (s.table.some((pair) => !pair.defend)) acts.push({ type: "toDefend" });
    if (s.table.length && s.table.every((pair) => pair.defend)) acts.push({ type: "bito" });
  }
  if (s.phase === "defend" && view === s.defender) {
    acts.push({ type: "take" });
    s.table.forEach((pair, pi) => {
      if (pair.defend) return;
      s.hands[view].forEach((card, index) => {
        if (beats(card, pair.attack, s.trump)) acts.push({ type: "defend", index, pair: pi });
      });
    });
  }
  return acts;
}

export function durakApply(s: DurakState, act: DurakAct): DurakState {
  if (s.phase === "done") return s;
  if (act.type === "reveal") {
    if (s.view !== "cover") return s;
    return { ...s, view: s.nextView };
  }
  if (s.view === "cover") return s;
  if (act.type === "attack") {
    if (s.phase !== "attack" || s.view !== s.attacker) return s;
    const card = s.hands[s.view][act.index];
    if (!card || !canAdd(s, card)) return s;
    const hands = copyHands(s);
    hands[s.view] = sortHand(
      hands[s.view].filter((_, i) => i !== act.index),
      s.trump,
    );
    return { ...s, hands, table: [...s.table, { attack: card }] };
  }
  if (act.type === "toDefend") {
    if (s.phase !== "attack" || s.view !== s.attacker) return s;
    if (!s.table.some((pair) => !pair.defend)) return s;
    return cover(s, s.defender, "defend");
  }
  if (act.type === "defend") {
    if (s.phase !== "defend" || s.view !== s.defender) return s;
    const card = s.hands[s.view][act.index];
    const pair = s.table[act.pair];
    if (!card || !pair || pair.defend || !beats(card, pair.attack, s.trump)) return s;
    const hands = copyHands(s);
    hands[s.view] = sortHand(
      hands[s.view].filter((_, i) => i !== act.index),
      s.trump,
    );
    const table = s.table.map((item, i) => (i === act.pair ? { ...item, defend: card } : item));
    const next = { ...s, hands, table };
    if (table.some((item) => !item.defend)) return next;
    return cover({ ...next, phase: "attack" }, s.attacker, "attack");
  }
  if (act.type === "take") {
    if (s.phase !== "defend" || s.view !== s.defender) return s;
    const pile = s.table.flatMap((pair) => (pair.defend ? [pair.attack, pair.defend] : [pair.attack]));
    const hands = copyHands(s);
    hands[s.view] = hands[s.view].concat(pile);
    let next: DurakState = { ...s, hands, table: [] };
    next = drawUp(next);
    next = finish({ ...next, phase: "attack" });
    if (next.phase === "done") return next;
    return cover(next, s.attacker, "attack");
  }
  if (act.type === "bito") {
    if (s.phase !== "attack" || s.view !== s.attacker) return s;
    if (!s.table.length || s.table.some((pair) => !pair.defend)) return s;
    let next = drawUp({ ...s, table: [] });
    next = {
      ...next,
      attacker: s.defender,
      defender: s.attacker,
      phase: "attack",
    };
    next = finish(next);
    if (next.phase === "done") return next;
    return cover(next, next.attacker, "attack");
  }
  return s;
}
