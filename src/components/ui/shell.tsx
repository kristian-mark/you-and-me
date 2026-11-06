import type { ReactNode } from "react";
import {
  CalendarDays,
  CheckSquare,
  Gift,
  ListChecks,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useCouple, type TabId } from "@/lib/couple-store";

const TABS: { id: TabId; label: string; icon: typeof CheckSquare }[] = [
  { id: "tasks", label: "Задачи", icon: CheckSquare },
  { id: "calendar", label: "Календарь", icon: CalendarDays },
  { id: "wishes", label: "Хотелки", icon: Gift },
  { id: "lists", label: "Списки", icon: ListChecks },
  { id: "more", label: "Ещё", icon: MoreHorizontal },
];

export function UsBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-raised px-3 py-2">
      <span className="text-sm text-fg">Мы</span>
      <span className="relative h-5 w-8">
        <span className="absolute left-0 top-0.5 size-4 rounded-full bg-blue" />
        <span className="absolute right-0 top-0.5 size-4 rounded-full bg-pink" />
      </span>
    </div>
  );
}

export function ScreenHeader({
  title,
  onAdd,
}: {
  title: string;
  onAdd?: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4">
      <h1 className="text-[32px] font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="grid size-11 place-items-center rounded-2xl bg-raised"
            aria-label="Добавить"
          >
            <Plus className="size-5" />
          </button>
        ) : null}
        <UsBadge />
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  hint,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: string;
  hint?: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
      <div className="mb-6 text-muted">{icon}</div>
      <h2 className="text-[22px] font-semibold">{title}</h2>
      <p className="mt-2 max-w-[280px] text-[15px] leading-snug text-muted">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-7 w-full max-w-[340px] rounded-2xl bg-cream py-4 text-[17px] font-semibold text-cream-fg"
      >
        {action}
      </button>
      {hint ? <p className="mt-4 max-w-[260px] text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function TabBar() {
  const tab = useCouple((s) => s.tab);
  const setTab = useCouple((s) => s.setTab);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2 pb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 text-[11px] ${active ? "text-fg" : "text-muted"}`}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
