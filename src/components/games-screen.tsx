import { useState } from "react";
import { ChevronRight, Circle, Contrast, Grid3x3, Hash, Sailboat, Spade, Square } from "lucide-react";
import { ConnectFourMatch } from "@/components/c4-screen";
import { DotsMatch } from "@/components/dots-screen";
import { CheckersMatch } from "@/components/checkers-screen";
import {
  Battleship,
  Durak,
} from "@/components/games-play";
import { ReversiMatch } from "@/components/reversi-screen";
import { TicTacToe } from "@/components/ttt-screen";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg } from "@/lib/pair-color";

const GAMES = [
  { id: "ttt", title: "Крестики-нолики", icon: Hash, Screen: TicTacToe },
  { id: "c4", title: "Четыре в ряд", icon: Square, Screen: ConnectFourMatch },
  { id: "dots", title: "Точки и квадраты", icon: Grid3x3, Screen: DotsMatch },
  { id: "reversi", title: "Реверси", icon: Contrast, Screen: ReversiMatch },
  { id: "checkers", title: "Шашки", icon: Circle, Screen: CheckersMatch },
  { id: "sea", title: "Морской бой", icon: Sailboat, Screen: Battleship },
  { id: "durak", title: "Дурак", icon: Spade, Screen: Durak },
] as const;

type GameId = (typeof GAMES)[number]["id"];

function level(wins: number) {
  return 1 + Math.floor(wins / 10);
}

export function GamesScreen({ onBack }: { onBack: () => void }) {
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const wins = useCouple((s) => s.gameWins) ?? { me: 0, partner: 0 };
  const colors = usePlayerColors();
  const [game, setGame] = useState<GameId | null>(null);
  const [round, setRound] = useState(0);
  const current = GAMES.find((item) => item.id === game);

  if (current) {
    const Screen = current.Screen;
    return <Screen key={`${current.id}-${round}`} onBack={() => setGame(null)} onAgain={() => setRound((n) => n + 1)} />;
  }

  return (
    <section className="px-5 pt-6 pb-10">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-[17px] text-[#e6e1d6]">
        ‹ Ещё
      </button>
      <h1 className="mt-4 text-[40px] font-semibold tracking-tight">Игры</h1>

      <div className="mt-5 grid grid-cols-2 rounded-[28px] bg-raised px-4 py-4">
        <Score name={myName} wins={wins.me} tone={pieceBg(colors.me)} />
        <div className="border-l border-line pl-4">
          <Score name={partnerName} wins={wins.partner} tone={pieceBg(colors.partner)} />
        </div>
      </div>

      <p className="mt-8 text-[12px] tracking-[0.22em] text-muted">НА ДВОИХ</p>
      <div className="mt-3 overflow-hidden rounded-[28px] bg-raised">
        {GAMES.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setRound(0);
                setGame(item.id);
              }}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left ${index ? "border-t border-line" : ""}`}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-bg">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px]">{item.title}</span>
                <span className="block text-[13px] text-muted">{item.id === "ttt" || item.id === "c4" || item.id === "dots" || item.id === "reversi" || item.id === "checkers" ? "По очереди, когда удобно" : "Новая игра"}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Score({ name, wins, tone }: { name: string; wins: number; tone: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`size-3.5 shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0">
        <p className="text-[32px] leading-none font-semibold">{wins}</p>
        <p className="mt-1 truncate text-[13px] text-muted">
          {name} · ур. {level(wins)}
        </p>
      </div>
    </div>
  );
}
