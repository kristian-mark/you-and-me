import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarScreen,
  ListsScreen,
  MoreScreen,
  TasksScreen,
  WishesScreen,
} from "@/components/screens";
import { TabBar } from "@/components/ui/shell";
import { useCouple } from "@/lib/couple-store";
import "@/styles.css";

function Home() {
  const waiting = useCouple((s) => s.waiting);
  const joined = useCouple((s) => s.joined);
  if (!joined && waiting) return <WaitingScreen />;
  if (!joined) return <GateScreen />;
  return <AppShell />;
}

function GateScreen() {
  const createPair = useCouple((s) => s.createPair);
  const joinPair = useCouple((s) => s.joinPair);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-16">
      <h1 className="text-[34px] font-semibold tracking-tight">Мы</h1>
      <p className="mt-1 text-muted">только двое</p>
      <button
        type="button"
        onClick={createPair}
        className="mt-10 rounded-2xl bg-pink py-4 text-[17px] font-semibold text-bg"
      >
        Создать пару
      </button>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Код пары"
        className="mt-4 rounded-2xl bg-raised px-4 py-4 outline-none"
      />
      <button
        type="button"
        onClick={() => setError(joinPair(code) ? "" : "Код не найден")}
        className="mt-3 rounded-2xl bg-raised py-4 text-[17px] font-semibold"
      >
        Войти по коду
      </button>
      {error ? <p className="mt-3 text-sm text-pink">{error}</p> : null}
    </main>
  );
}

function WaitingScreen() {
  const pairCode = useCouple((s) => s.pairCode);
  const partnerArrived = useCouple((s) => s.partnerArrived);
  const leavePair = useCouple((s) => s.leavePair);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-muted">Ждём второго</p>
      <p className="mt-4 text-5xl font-bold tracking-[0.18em] text-pink">{pairCode}</p>
      <p className="mt-4 max-w-xs text-muted">Отправь этот код партнёру. В интерфейс пустим только после входа второго.</p>
      <button
        type="button"
        onClick={partnerArrived}
        className="mt-8 w-full rounded-2xl bg-cream py-4 font-semibold text-cream-fg"
      >
        Партнёр уже ввёл код
      </button>
      <button type="button" onClick={leavePair} className="mt-3 w-full rounded-2xl bg-raised py-4 text-muted">
        Отмена
      </button>
    </main>
  );
}

function AppShell() {
  const tab = useCouple((s) => s.tab);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      {tab === "tasks" ? <TasksScreen /> : null}
      {tab === "calendar" ? <CalendarScreen /> : null}
      {tab === "wishes" ? <WishesScreen /> : null}
      {tab === "lists" ? <ListsScreen /> : null}
      {tab === "more" ? <MoreScreen /> : null}
      <TabBar />
    </main>
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
