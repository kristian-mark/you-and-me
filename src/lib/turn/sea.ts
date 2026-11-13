import { TurnRuleError, assertCanAct, otherSeat, type Seat, type TurnSnapshot, type TurnStep } from "./engine.ts";

export const SEA = 10;
export const SEA_CELLS = SEA * SEA;
export const SEA_LENGTHS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] as const;
export const SEA_COLS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"] as const;

export type SeaPhase = "setup" | "fight";
export type SeaCell = "empty" | "ship" | "hit" | "sunk" | "miss";
export type SeaMove =
  | { kind: "reshuffle" }
  | { kind: "ready" }
  | { kind: "shot"; index: number };

export type SeaState = {
  shipsA: number[][];
  shipsB: number[][];
  shotsA: string;
  shotsB: string;
  readyA: boolean;
  readyB: boolean;
  phase: SeaPhase;
  starter: Seat | null;
  wins: { a: number; b: number };
};

export type SeaMatchView = {
  version: number;
  updatedAt: string | null;
  status: "idle" | "active" | "finished";
  phase: SeaPhase;
  myTurn: boolean;
  winner: "me" | "partner" | null;
  ready: { me: boolean; partner: boolean };
  mine: SeaCell[];
  target: SeaCell[];
  wins: { me: number; partner: number };
};

const EMPTY_SHOTS = " ".repeat(SEA_CELLS);

export function emptySeaState(): SeaState {
  return {
    shipsA: [],
    shipsB: [],
    shotsA: EMPTY_SHOTS,
    shotsB: EMPTY_SHOTS,
    readyA: false,
    readyB: false,
    phase: "setup",
    starter: null,
    wins: { a: 0, b: 0 },
  };
}

function rowOf(index: number) {
  return Math.floor(index / SEA);
}

function colOf(index: number) {
  return index % SEA;
}

function touches(a: number, b: number) {
  return Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b))) <= 1;
}

function around(index: number) {
  const row = rowOf(index);
  const col = colOf(index);
  const cells: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextCol >= 0 && nextRow < SEA && nextCol < SEA) cells.push(nextRow * SEA + nextCol);
    }
  }
  return cells;
}

export function fleetIsValid(ships: number[][]) {
  if (ships.length !== SEA_LENGTHS.length) return false;
  const seen = new Set<number>();
  for (let i = 0; i < ships.length; i += 1) {
    const ship = ships[i];
    if (!ship || ship.length !== SEA_LENGTHS[i]) return false;
    const sorted = [...ship].sort((a, b) => a - b);
    const horizontal = sorted.every((cell) => rowOf(cell) === rowOf(sorted[0]));
    const vertical = sorted.every((cell) => colOf(cell) === colOf(sorted[0]));
    if (!horizontal && !vertical) return false;
    for (let k = 1; k < sorted.length; k += 1) {
      const step = horizontal ? 1 : SEA;
      if (sorted[k] !== sorted[0] + k * step) return false;
    }
    for (const cell of ship) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= SEA_CELLS) return false;
      for (const prev of seen) {
        if (touches(cell, prev)) return false;
      }
    }
    for (const cell of ship) seen.add(cell);
  }
  return true;
}

export function placeFleet(random: () => number = Math.random): number[][] {
  for (let restart = 0; restart < 40; restart += 1) {
    const occupied: number[] = [];
    const ships: number[][] = [];
    let failed = false;
    for (const length of SEA_LENGTHS) {
      let placed: number[] | null = null;
      for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
        const horizontal = random() < 0.5;
        const row = Math.floor(random() * SEA);
        const col = Math.floor(random() * SEA);
        const cells: number[] = [];
        let fits = true;
        for (let k = 0; k < length; k += 1) {
          const nextRow = horizontal ? row : row + k;
          const nextCol = horizontal ? col + k : col;
          if (nextRow >= SEA || nextCol >= SEA) {
            fits = false;
            break;
          }
          cells.push(nextRow * SEA + nextCol);
        }
        if (!fits) continue;
        if (cells.some((cell) => occupied.some((prev) => touches(cell, prev)))) continue;
        placed = cells;
      }
      if (!placed) {
        failed = true;
        break;
      }
      ships.push(placed);
      occupied.push(...placed);
    }
    if (!failed && fleetIsValid(ships)) return ships;
  }
  throw new Error("Не вышло расставить флот");
}

function shots(value: string) {
  const text = value.length === SEA_CELLS ? value : (value + EMPTY_SHOTS).slice(0, SEA_CELLS);
  return text.split("");
}

function fleetSunk(ships: number[][], board: string[]) {
  return ships.every((ship) => ship.every((cell) => board[cell] === "s"));
}

function applyShot(ships: number[][], board: string[], index: number) {
  if (board[index] !== " ") throw new TurnRuleError("occupied", "Сюда уже стреляли");
  const ship = ships.find((item) => item.includes(index));
  if (!ship) {
    board[index] = "m";
    return "miss" as const;
  }
  board[index] = "h";
  if (!ship.every((cell) => board[cell] === "h" || board[cell] === "s")) return "hit" as const;
  const hull = new Set(ships.flat());
  for (const cell of ship) board[cell] = "s";
  for (const cell of ship) {
    for (const next of around(cell)) {
      if (board[next] === " " && !hull.has(next)) board[next] = "m";
    }
  }
  return "sunk" as const;
}

function shipsOf(state: SeaState, seat: Seat) {
  return seat === "a" ? state.shipsA : state.shipsB;
}

function shotsOf(state: SeaState, seat: Seat) {
  return seat === "a" ? state.shotsA : state.shotsB;
}

function readyOf(state: SeaState, seat: Seat) {
  return seat === "a" ? state.readyA : state.readyB;
}

function withShots(state: SeaState, seat: Seat, board: string[]): SeaState {
  const text = board.join("");
  return seat === "a" ? { ...state, shotsA: text } : { ...state, shotsB: text };
}

function withShips(state: SeaState, seat: Seat, ships: number[][]): SeaState {
  return seat === "a" ? { ...state, shipsA: ships } : { ...state, shipsB: ships };
}

function withReady(state: SeaState, seat: Seat, ready: boolean): SeaState {
  return seat === "a" ? { ...state, readyA: ready } : { ...state, readyB: ready };
}

function parseShips(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;
  const ships = value.map((ship) => {
    if (!Array.isArray(ship) || !ship.every((cell) => typeof cell === "number" && Number.isInteger(cell))) return null;
    return ship as number[];
  });
  if (ships.some((ship) => ship === null)) return null;
  const clean = ships as number[][];
  return fleetIsValid(clean) ? clean : null;
}

function parseShots(value: unknown) {
  return typeof value === "string" && value.length === SEA_CELLS && /^[ hms]*$/.test(value) ? value : null;
}

export function readSeaState(raw: unknown): SeaState {
  const empty = emptySeaState();
  if (!raw || typeof raw !== "object") return empty;
  const record = raw as Partial<SeaState>;
  const shipsA = parseShips(record.shipsA);
  const shipsB = parseShips(record.shipsB);
  const shotsA = parseShots(record.shotsA);
  const shotsB = parseShots(record.shotsB);
  if (!shipsA || !shipsB || !shotsA || !shotsB) return empty;
  const wins = record.wins;
  return {
    shipsA,
    shipsB,
    shotsA,
    shotsB,
    readyA: record.readyA === true,
    readyB: record.readyB === true,
    phase: record.phase === "fight" ? "fight" : "setup",
    starter: record.starter === "a" || record.starter === "b" ? record.starter : null,
    wins: {
      a: typeof wins?.a === "number" && wins.a >= 0 ? wins.a : 0,
      b: typeof wins?.b === "number" && wins.b >= 0 ? wins.b : 0,
    },
  };
}

export function seaMayAct(snapshot: TurnSnapshot<SeaState>, seat: Seat, move: unknown) {
  if (snapshot.status !== "active" || snapshot.state.phase !== "setup") return false;
  if (!move || typeof move !== "object") return false;
  const kind = (move as { kind?: unknown }).kind;
  if (kind !== "reshuffle" && kind !== "ready") return false;
  return !readyOf(snapshot.state, seat);
}

/**
 * Setup only touches this seat's fleet and ready flag, so it can land on the
 * latest row after the partner reshuffles or readies. Shots return null and
 * keep the strict version check.
 */
export function rebaseSeaSetup(latest: TurnSnapshot<SeaState>, seat: Seat, move: unknown): TurnStep<SeaState> | null {
  if (!seaMayAct(latest, seat, move)) return null;
  return seaRules.apply(latest, seat, move as SeaMove);
}

function cellsFor(ships: number[][] | null, board: string, revealShips: boolean): SeaCell[] {
  return Array.from({ length: SEA_CELLS }, (_, index) => {
    const mark = board[index];
    if (mark === "m") return "miss";
    if (mark === "s") return "sunk";
    if (mark === "h") return "hit";
    if (revealShips && ships?.some((ship) => ship.includes(index))) return "ship";
    return "empty";
  });
}

export function presentSea(
  snapshot: TurnSnapshot<SeaState>,
  version: number,
  seat: Seat,
  updatedAt: string | null,
): SeaMatchView {
  const mineShips = shipsOf(snapshot.state, seat);
  const targetShots = shotsOf(snapshot.state, otherSeat(seat));
  const mineShots = shotsOf(snapshot.state, seat);
  const over = snapshot.status === "finished";
  return {
    version,
    updatedAt,
    status: snapshot.status,
    phase: snapshot.state.phase,
    myTurn: snapshot.status === "active" && snapshot.state.phase === "fight" && snapshot.turn === seat,
    winner: snapshot.winner === "draw" ? null : snapshot.winner ? (snapshot.winner === seat ? "me" : "partner") : null,
    ready: { me: readyOf(snapshot.state, seat), partner: readyOf(snapshot.state, otherSeat(seat)) },
    mine: cellsFor(mineShips, mineShots, true),
    target: cellsFor(over ? shipsOf(snapshot.state, otherSeat(seat)) : null, targetShots, over),
    wins: {
      me: seat === "a" ? snapshot.state.wins.a : snapshot.state.wins.b,
      partner: seat === "a" ? snapshot.state.wins.b : snapshot.state.wins.a,
    },
  };
}

export function idleSeaView(): SeaMatchView {
  return presentSea(
    { state: emptySeaState(), status: "idle", turn: null, winner: null },
    0,
    "a",
    null,
  );
}

export function newSeaMatch(previous: SeaState): SeaState {
  return { ...emptySeaState(), wins: { a: previous.wins.a, b: previous.wins.b } };
}

export function beginSea(previous: SeaState, seat: Seat): TurnStep<SeaState> {
  return {
    state: {
      ...emptySeaState(),
      shipsA: placeFleet(),
      shipsB: placeFleet(),
      starter: seat,
      wins: { a: previous.wins.a, b: previous.wins.b },
    },
    status: "active",
    turn: seat,
    winner: null,
  };
}

export function seaBanner(view: SeaMatchView, partnerName: string) {
  if (view.status === "idle") {
    return { title: "Корабли ещё в порту", hint: "Новая игра ставит флот случайно. Кто нажал — тот стреляет первым." };
  }
  if (view.status === "finished") {
    return {
      title: view.winner === "me" ? "Флот партнёра потоплен" : "Твой флот потоплен",
      hint: "Счёт уже записан. Можно начать ещё одну.",
    };
  }
  if (view.phase === "setup") {
    if (!view.ready.me) return { title: "Расставь свой флот", hint: "Можно перемешать. Когда нравится — нажми «Готов»." };
    if (!view.ready.partner) return { title: "Ты готов", hint: `Ждём ${partnerName}.` };
  }
  if (view.myTurn) return { title: "Твой выстрел", hint: "Попадание — стреляешь ещё. Мимо — ход партнёра." };
  return { title: `Ход ${partnerName}`, hint: "Попадание оставляет выстрел у того, кто попал." };
}

function asMove(move: SeaMove | unknown): SeaMove {
  if (!move || typeof move !== "object") throw new TurnRuleError("illegal", "Некорректный ход");
  const raw = move as { kind?: unknown; index?: unknown };
  if (raw.kind === "reshuffle" || raw.kind === "ready") return { kind: raw.kind };
  if (raw.kind === "shot" && typeof raw.index === "number" && Number.isInteger(raw.index) && raw.index >= 0 && raw.index < SEA_CELLS) {
    return { kind: "shot", index: raw.index };
  }
  throw new TurnRuleError("illegal", "Некорректный ход");
}

export const seaRules = {
  type: "sea",
  empty: emptySeaState,
  apply(snapshot: TurnSnapshot<SeaState>, actor: Seat, move: SeaMove): TurnStep<SeaState> {
    const action = asMove(move);
    if (snapshot.status !== "active") assertCanAct(snapshot, actor);
    if (action.kind === "reshuffle" || action.kind === "ready") {
      if (snapshot.state.phase !== "setup") throw new TurnRuleError("illegal", "Флот уже в бою");
      if (readyOf(snapshot.state, actor)) throw new TurnRuleError("illegal", "Ты уже готов");
      if (action.kind === "reshuffle") {
        return {
          state: withShips(snapshot.state, actor, placeFleet()),
          status: "active",
          turn: snapshot.turn,
          winner: null,
        };
      }
      const next = withReady(snapshot.state, actor, true);
      const both = next.readyA && next.readyB;
      return {
        state: { ...next, phase: both ? "fight" : "setup" },
        status: "active",
        turn: both ? next.starter ?? actor : snapshot.turn,
        winner: null,
      };
    }
    if (snapshot.state.phase !== "fight") throw new TurnRuleError("illegal", "Сначала оба должны быть готовы");
    assertCanAct(snapshot, actor);
    const defender = otherSeat(actor);
    const board = shots(shotsOf(snapshot.state, defender));
    const result = applyShot(shipsOf(snapshot.state, defender), board, action.index);
    const sunkAll = fleetSunk(shipsOf(snapshot.state, defender), board);
    const wins = {
      a: snapshot.state.wins.a + (sunkAll && actor === "a" ? 1 : 0),
      b: snapshot.state.wins.b + (sunkAll && actor === "b" ? 1 : 0),
    };
    const state = { ...withShots(snapshot.state, defender, board), wins };
    if (sunkAll) return { state, status: "finished", turn: null, winner: actor };
    return {
      state,
      status: "active",
      turn: result === "miss" ? defender : actor,
      winner: null,
    };
  },
};
