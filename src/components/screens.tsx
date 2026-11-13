import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  CreditCard,
  Folder,
  Gamepad2,
  Gift,
  Images,
  ListTodo,
  Bookmark,
  Mail,
  MessageCircle,
  Plus,
  Radar,
  Settings,
  Target,
  Vote,
  Wallet,
} from "lucide-react";
import { AlbumScreen } from "@/components/album-screen";
import { ChatScreen } from "@/components/chat-screen";
import { InChatRow } from "@/components/in-chat-row";
import { NewListSheet } from "@/components/new-list-sheet";
import { NotesScreen } from "@/components/notes-screen";
import { GiftRadarScreen } from "@/components/gift-radar-screen";
import { VotingScreen } from "@/components/voting-screen";
import { CapsuleScreen } from "@/components/capsule-screen";
import { CompatibilityScreen } from "@/components/compatibility-screen";
import { QuestionDayScreen } from "@/components/question-day-screen";
import { CardsScreen } from "@/components/cards-screen";
import { BudgetScreen } from "@/components/budget-screen";
import { GamesScreen } from "@/components/games-screen";
import { NewTaskSheet } from "@/components/new-task-sheet";
import { NewWishSheet } from "@/components/new-wish-sheet";
import { DatePicker } from "@/components/date-picker";
import { PairCode } from "@/components/pair-code";
import { SheetHeader } from "@/components/sheet-header";
import { EmptyState, ScreenHeader, UsBadge } from "@/components/ui/shell";
import { WishPhoto } from "@/components/wish-photo";
import { badgeLabel } from "@/lib/chat-model";
import { shareToChat, useOpenChatTarget } from "@/lib/chat-nav";
import { useCouple, usePlayerColors, viewedOwner, viewedWishOwner, type CheckList, type Task, type TaskOwner, type Wish } from "@/lib/couple-store";
import { capitalRu, formatRuDay, formatRuWeekday, RU_MONTHS, toIsoDate } from "@/lib/dates";
import { pieceBg, pieceCss, type PieceColor } from "@/lib/pair-color";
import { leaveSharedPair } from "@/lib/leave-pair";
import { refreshPairTasks, refreshPairWishes } from "@/lib/pair-live";
import { openCompatibilityQuiz } from "@/lib/quiz-live";
import { quizNudge } from "@/lib/quiz-sync";
import { deletePairTask } from "@/lib/pair-tasks";
import { deletePairWish } from "@/lib/pair-wishes";
import { LIST_POLL_MS, useScreenPoll } from "@/lib/screen-poll";
import { AccountLogoutButton } from "@/components/account-logout";
import { LoginActivity } from "@/components/login-activity";
import { PasswordSettings } from "@/components/password-settings";
import { saveMyProfile } from "@/lib/pair-server";

export function TasksScreen() {
  useScreenPoll("tasks", true, LIST_POLL_MS, refreshPairTasks);
  const tasks = useCouple((s) => s.tasks);
  const toggleTask = useCouple((s) => s.toggleTask);
  const claimTask = useCouple((s) => s.claimTask);
  const deleteTask = useCouple((s) => s.deleteTask);
  const removeTask = (id: string) => {
    deleteTask(id);
    void deletePairTask({ data: id }).catch(() => undefined);
  };
  const openTaskId = useCouple((s) => s.openTaskId);
  const openTask = useCouple((s) => s.openTask);
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const quiz = useCouple((s) => s.quiz);
  const nudge = quizNudge({
    myDoneAt: quiz.myDoneAt,
    partnerRemindedAt: quiz.partnerRemindedAt,
    partnerName,
  });
  const [sheet, setSheet] = useState<"new" | Task | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "partner" | "open">("all");
  useOpenChatTarget("task", (target) => openTask(target.id));

  const ownerOf = (task: Task) => viewedOwner(task, myUserId);

  const counts = {
    all: tasks.length,
    mine: tasks.filter((t) => ownerOf(t) === "me").length,
    partner: tasks.filter((t) => ownerOf(t) === "partner").length,
    open: tasks.filter((t) => ownerOf(t) === "free" && !t.done).length,
  };

  const visible = tasks.filter((t) => {
    if (filter === "mine") return ownerOf(t) === "me";
    if (filter === "partner") return ownerOf(t) === "partner";
    if (filter === "open") return ownerOf(t) === "free" && !t.done;
    return true;
  });

  const openTasks = visible.filter((t) => ownerOf(t) === "free" && !t.done);
  const progress = visible.filter((t) => ownerOf(t) !== "free" && !t.done);
  const done = visible.filter((t) => t.done);
  const selected = tasks.find((t) => t.id === openTaskId);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {selected ? (
        <TaskDetail
          task={selected}
          onBack={() => openTask(null)}
          onEdit={() => setSheet(selected)}
          onDelete={() => {
            removeTask(selected.id);
            openTask(null);
          }}
        />
      ) : (
        <>
          <ScreenHeader title="Задачи" onAdd={() => setSheet("new")} />
          {nudge ? (
            <button
              type="button"
              onClick={openCompatibilityQuiz}
              className="mx-5 mb-3 min-h-11 rounded-[22px] bg-raised px-4 py-3 text-left text-[15px] leading-5"
            >
              {nudge}
            </button>
          ) : null}
      {tasks.length === 0 ? (
        <EmptyState
          icon={
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-muted">
                <CheckCircle2 className="size-7" />
                <span className="h-0.5 w-10 bg-line" />
              </div>
              <div className="flex items-center gap-3 text-muted">
                <Circle className="size-7" />
                <span className="h-0.5 w-10 bg-line" />
              </div>
            </div>
          }
          title="Список дел на двоих"
          body="Запишите, что нужно сделать. Любой может взять задачу — или отдать партнёру."
          action="Добавить задачу"
          hint="здесь нет начальника — задачу можно вернуть"
          onAction={() => setSheet("new")}
        />
      ) : (
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-28">
          <div className="flex min-w-0 flex-wrap gap-2 pb-4">
            {(
              [
                ["all", `Все · ${counts.all}`],
                ["mine", `Мои · ${counts.mine}`],
                ["partner", `${partnerName} · ${counts.partner}`],
                ["open", `Свободные · ${counts.open}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`max-w-full rounded-full px-3 py-2 text-[13px] break-words ${
                  filter === id ? "bg-cream text-cream-fg" : "bg-raised text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <TaskGroup title="Свободные" items={openTasks} empty={false}>
            {openTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                viewOwner={ownerOf(task)}
                partnerName={partnerName}
                actionLabel="Забрать"
                onAction={() => claimTask(task.id, "me")}
                onOpen={() => openTask(task.id, "tasks")}
                onToggle={() => toggleTask(task.id)}
                menuOpen={menuId === task.id}
                onMenu={() => setMenuId(menuId === task.id ? null : task.id)}
                onEdit={() => {
                  setMenuId(null);
                  setSheet(task);
                }}
                onDelete={() => {
                  setMenuId(null);
                  removeTask(task.id);
                }}
              />
            ))}
          </TaskGroup>
          <TaskGroup title="В работе" items={progress}>
            {progress.map((task) => {
              const mine = ownerOf(task) === "me";
              return (
              <TaskCard
                key={task.id}
                task={task}
                viewOwner={ownerOf(task)}
                claimed
                partnerName={partnerName}
                actionLabel={mine ? "Готово" : undefined}
                onAction={() => (mine ? toggleTask(task.id) : undefined)}
                onOpen={() => openTask(task.id, "tasks")}
                onToggle={() => toggleTask(task.id)}
                menuOpen={menuId === task.id}
                onMenu={() => setMenuId(menuId === task.id ? null : task.id)}
                onEdit={() => {
                  setMenuId(null);
                  setSheet(task);
                }}
                onDelete={() => {
                  setMenuId(null);
                  removeTask(task.id);
                }}
              />
              );
            })}
          </TaskGroup>
          <TaskGroup title="Сделано" items={done}>
            {done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                viewOwner={ownerOf(task)}
                partnerName={partnerName}
                actionLabel="Вернуть"
                onAction={() => toggleTask(task.id)}
                onOpen={() => openTask(task.id, "tasks")}
                onToggle={() => toggleTask(task.id)}
                menuOpen={menuId === task.id}
                onMenu={() => setMenuId(menuId === task.id ? null : task.id)}
                onEdit={() => {
                  setMenuId(null);
                  setSheet(task);
                }}
                onDelete={() => {
                  setMenuId(null);
                  removeTask(task.id);
                }}
              />
            ))}
          </TaskGroup>
        </div>
      )}
        </>
      )}
      {sheet === "new" ? <NewTaskSheet onClose={() => setSheet(null)} /> : null}
      {sheet && sheet !== "new" ? (
        <NewTaskSheet
          task={tasks.find((t) => t.id === sheet.id) ?? sheet}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </section>
  );
}

function TaskGroup({
  title,
  items,
  children,
  empty = true,
}: {
  title: string;
  items: Task[];
  children: ReactNode;
  empty?: boolean;
}) {
  if (!items.length && empty) return null;
  if (!items.length) return null;
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] tracking-widest text-muted">{title.toUpperCase()}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TaskCard({
  task,
  claimed,
  viewOwner,
  partnerName,
  actionLabel,
  onAction,
  onOpen,
  onToggle,
  menuOpen,
  onMenu,
  onEdit,
  onDelete,
}: {
  task: Task;
  claimed?: boolean;
  viewOwner?: TaskOwner;
  partnerName: string;
  actionLabel?: string;
  onAction: () => void;
  onOpen: () => void;
  onToggle: () => void;
  menuOpen: boolean;
  onMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const owner = viewOwner ?? task.owner;
  const subs = asList(task.subtasks);
  const doneCount = subs.filter((s) => s.done).length;
  const who =
    owner === "me" ? "ты" : owner === "partner" ? partnerName : owner === "both" ? "оба" : "никто";
  const status = task.done
    ? "сделано"
    : owner === "free"
      ? "назначена"
      : "взята";

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-raised p-4 ${claimed ? "pl-5" : ""}`}>
      {claimed ? <span className="absolute inset-y-3 left-0 w-1 rounded-full bg-blue" /> : null}
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} className="mt-1" aria-label="Отметить">
          {task.done ? <CheckCircle2 className="size-6 text-blue" /> : <Circle className="size-6 text-muted" />}
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-[16px] font-medium">{task.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {status} · {who}
            {task.dueDate ? ` · до ${formatDue(task.dueDate)}` : ""}
          </p>
          {subs.length ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-chip">
                <div
                  className="h-full bg-muted"
                  style={{ width: `${subs.length ? (doneCount / subs.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[12px] text-muted">
                {doneCount}/{subs.length}
              </span>
            </div>
          ) : null}
        </button>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={onMenu} className="px-1 text-muted" aria-label="Ещё">
            ⋯
          </button>
          {actionLabel ? (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full bg-blue px-3 py-2 text-[13px] font-semibold text-bg"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      {menuOpen ? (
        <div className="absolute top-10 right-3 z-10 overflow-hidden rounded-xl bg-chip shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="block w-full px-4 py-2 text-left text-[14px]"
          >
            Изменить
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="block w-full px-4 py-2 text-left text-[14px] text-pink"
          >
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TaskDetail({
  task,
  onBack,
  onEdit,
  onDelete,
}: {
  task: Task;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const claimTask = useCouple((s) => s.claimTask);
  const toggleTask = useCouple((s) => s.toggleTask);
  const toggleSubtask = useCouple((s) => s.toggleSubtask);
  const addSubtask = useCouple((s) => s.addSubtask);
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const partnerUserId = useCouple((s) => s.partnerUserId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const subs = asList(task.subtasks);
  const doneCount = subs.filter((s) => s.done).length;
  const owner = viewedOwner(task, myUserId);
  const free = owner === "free";
  const assigner =
    task.createdBy && task.createdBy === partnerUserId ? partnerName : task.createdBy && task.createdBy === myUserId ? "ты" : owner === "partner" ? partnerName : "ты";

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <header className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Задачи
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className="grid size-10 place-items-center text-muted"
            aria-label="Меню"
          >
            ⋯
          </button>
          {menu ? (
            <div className="absolute top-11 right-0 z-20 min-w-40 overflow-hidden rounded-xl bg-raised shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onEdit();
                }}
                className="block w-full px-4 py-3 text-left"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
                className="block w-full px-4 py-3 text-left text-pink"
              >
                Удалить
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <p className="mt-4 flex items-center gap-2 text-[12px] tracking-wider text-muted">
        <Circle className="size-5" />
        {free ? "СВОБОДНАЯ · НИКТО НЕ ВЗЯЛ" : task.done ? "СДЕЛАНА" : "В РАБОТЕ"}
      </p>
      <h1 className="mt-3 text-[32px] font-semibold">{task.title}</h1>

      <div className="mt-5 rounded-2xl bg-raised px-4 py-3">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>ПОДЗАДАЧИ</span>
          <span>
            {doneCount} из {subs.length || 0}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-chip">
          <div
            className="h-full bg-muted"
            style={{ width: `${subs.length ? (doneCount / subs.length) * 100 : 0}%` }}
          />
        </div>
        {subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleSubtask(task.id, s.id)}
            className="flex w-full items-center gap-3 border-t border-line py-3 text-left"
          >
            {s.done ? <CheckCircle2 className="size-5 text-blue" /> : <Circle className="size-5 text-muted" />}
            {s.text}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim()) addSubtask(task.id, draft.trim());
              setDraft("");
              setAdding(false);
            }}
            className="w-full border-t border-line bg-transparent py-3 outline-none"
            placeholder="Подзадача"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-2 border-t border-line py-3 text-muted"
          >
            <Plus className="size-4" /> Добавить подзадачу
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-raised">
        <Row label="Назначил" value={assigner} />
        <Row label="Создана" value={formatDue(createdDate(task))} />
        {task.claimedAt ? <Row label="Взята" value={`ты, ${formatDue(task.claimedAt.slice(0, 10))}`} /> : null}
        {task.dueDate ? <Row label="Срок" value={formatDue(task.dueDate)} /> : null}
      </div>

      <div className="mt-3 rounded-2xl bg-raised px-4 py-3">
        {task.note?.trim() ? task.note : <span className="text-muted">Нет заметки</span>}
      </div>

      <InChatRow
        onSend={() =>
          shareToChat({
            kind: "task",
            id: task.id,
            title: task.title,
            subtitle: task.dueDate ?? "",
          })
        }
      />

      {free ? (
        <>
          <button
            type="button"
            onClick={() => claimTask(task.id, "me")}
            className="mt-5 w-full rounded-2xl bg-blue py-4 text-[17px] font-semibold text-bg"
          >
            Забираю
          </button>
          <p className="mt-3 text-center text-[13px] text-muted">
            Для партнёра задача уйдёт из свободных и получит твой цвет
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() =>
              owner === "me" || task.done ? toggleTask(task.id) : claimTask(task.id, "me")
            }
            className="mt-5 w-full rounded-2xl bg-blue py-4 text-[17px] font-semibold text-bg"
          >
            {task.done ? "Вернуть в работу" : owner === "me" ? "Готово" : "Забрать"}
          </button>
          <button
            type="button"
            onClick={() => claimTask(task.id, "free")}
            className="mt-3 w-full rounded-2xl bg-raised py-4 text-[16px]"
          >
            Вернуть в свободные
          </button>
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 first:border-t-0">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function asList(raw: Task["subtasks"] | string[] | undefined) {
  return (raw ?? []).map((s, i) =>
    typeof s === "string" ? { id: `legacy-${i}`, text: s, done: false } : s,
  );
}

function createdDate(task: Task) {
  const raw = task.createdAt || "";
  if (raw.length >= 10) return raw.slice(0, 10);
  return toIsoDate(new Date());
}

function formatDue(date: string) {
  return formatRuDay(date, "dayMonth") || date;
}

function dotClass(owner: TaskOwner | "free", colors: { me: PieceColor; partner: PieceColor }) {
  if (owner === "me") return pieceBg(colors.me);
  if (owner === "partner") return pieceBg(colors.partner);
  if (owner === "both") return "bg-red";
  return "bg-cream";
}

function Chip({
  children,
  active,
  tone,
  piece,
  onClick,
}: {
  children: string;
  active?: boolean;
  tone: "white" | "piece" | "red";
  piece?: PieceColor;
  onClick: () => void;
}) {
  const on =
    tone === "white"
      ? "bg-cream text-cream-fg"
      : tone === "piece"
        ? `${pieceBg(piece ?? "blue")} text-bg`
        : "bg-red text-fg";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-full rounded-full px-3 py-1 text-left text-[12px] break-words ${active ? on : "bg-chip text-muted"}`}
    >
      {children}
    </button>
  );
}

export function CalendarScreen() {
  useScreenPoll("tasks", true, LIST_POLL_MS, refreshPairTasks);
  const colors = usePlayerColors();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(toIsoDate(new Date()));
  const [composer, setComposer] = useState(false);
  const [mode, setMode] = useState<"overview" | "month" | "week">("overview");
  const events = useCouple((s) => s.events);
  const tasks = useCouple((s) => s.tasks);
  const myUserId = useCouple((s) => s.myUserId);
  const addEvent = useCouple((s) => s.addEvent);
  const openTask = useCouple((s) => s.openTask);
  const setTab = useCouple((s) => s.setTab);
  const [shared, setShared] = useState("");
  useOpenChatTarget("event", (target) => {
    if (target.date) setSelected(target.date);
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const lists = useCouple((s) => s.lists);
  const calendarItems = useMemo(() => {
    const fromTasks = tasks
      .filter((t) => t.showInCalendar && t.dueDate)
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.dueDate as string,
        kind: "task" as const,
        owner: viewedOwner(t, myUserId),
        done: t.done,
      }));
    const fromLists = lists.flatMap((list) =>
      list.items
        .filter((i) => i.date)
        .map((i) => ({
          id: i.id,
          listId: list.id,
          listTitle: list.title,
          title: i.text,
          date: i.date as string,
          kind: "list" as const,
          owner: i.addedBy === "me" ? ("me" as const) : ("partner" as const),
          done: i.done,
        })),
    );
    const fromEvents = events.map((e) => ({
      ...e,
      kind: "event" as const,
      owner: "free" as const,
      done: false,
    }));
    return [...fromTasks, ...fromLists, ...fromEvents].sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, events, lists, myUserId]);

  const orderedItems = useMemo(() => {
    return [...calendarItems].sort((a, b) => {
      const aSel = a.date === selected ? 0 : 1;
      const bSel = b.date === selected ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      if (a.date === selected && b.date === selected) {
        const aDone = a.done ? 1 : 0;
        const bDone = b.done ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
      }
      return a.date.localeCompare(b.date);
    });
  }, [calendarItems, selected]);

  const add = (title: string, date: string) => {
    addEvent(title, date);
    setComposer(false);
  };

  async function shareCalendarItem(item: (typeof calendarItems)[number]) {
    try {
      if (item.kind === "task") {
        await shareToChat({ kind: "task", id: item.id, title: item.title, subtitle: item.date });
      } else if (item.kind === "list") {
        await shareToChat({ kind: "list", id: item.listId, title: item.listTitle, subtitle: item.title });
      } else {
        await shareToChat({ kind: "event", id: item.id, title: item.title, subtitle: item.date });
      }
      setShared("Отправлено в чат");
    } catch (error) {
      setShared(error instanceof Error ? error.message : "Не ушло");
    }
  }

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-5 pb-28">
      <p className="min-w-0 pt-5 text-[13px] text-muted uppercase">
        {formatRuWeekday(new Date())}
      </p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h1 className="min-w-0 text-[32px] leading-none font-semibold capitalize">
          {capitalRu(RU_MONTHS[cursor.getMonth()] ?? "")}
        </h1>
        <div className="flex max-w-full shrink-0 items-center">
          <button type="button" className="grid size-9 place-items-center rounded-xl bg-raised" aria-label="Календарь">
            <CalendarDays className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCursor((d) => addMonths(d, -1))}
            className="grid size-9 place-items-center"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCursor((d) => addMonths(d, 1))}
            className="grid size-9 place-items-center"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-5" />
          </button>
          <UsBadge />
        </div>
      </div>

      <div className="mt-4 flex rounded-full bg-raised p-1 text-[13px]">
        {(
          [
            ["overview", "Обзор"],
            ["month", "Месяц"],
            ["week", "Неделя"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 rounded-full py-2 ${mode === id ? "bg-chip text-fg" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-7 text-center text-[11px] text-muted">
        {["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-3 text-center text-[17px]">
        {days.map((day) => {
          const current = isSameMonth(day, cursor);
          const today = isToday(day);
          const key = toIsoDate(day);
          const picked = key === selected;
          const dayTasks = calendarItems.filter((i) => i.date === key).slice(0, 4);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelected(key)}
              className="flex h-12 flex-col items-center justify-start gap-1"
            >
              <span
                className={`grid size-8 place-items-center rounded-full ${
                  picked
                    ? "bg-blue text-bg"
                    : today
                      ? "bg-fg text-bg"
                      : current
                        ? "text-fg"
                        : "text-muted/40"
                }`}
              >
                {day.getDate()}
              </span>
              {dayTasks.length ? (
                <span className="flex h-1.5 items-center justify-center gap-0.5">
                  {dayTasks.map((item) => (
                    <span
                      key={item.id}
                      className={`size-1 rounded-full ${dotClass(item.owner, colors)}`}
                    />
                  ))}
                </span>
              ) : (
                <span className="h-1.5" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-[12px] tracking-wider text-muted">БЛИЖАЙШЕЕ</p>
      {shared ? <p className="mt-2 text-[13px] text-muted">{shared}</p> : null}
      {calendarItems.length === 0 ? (
        <p className="mt-10 text-center text-[16px] leading-snug text-muted">
          Пока пусто. Добавьте событие — партнёр увидит его сразу.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orderedItems.map((item) => {
            const glow =
              item.owner === "me"
                ? pieceCss(colors.me)
                : item.owner === "partner"
                  ? pieceCss(colors.partner)
                  : item.owner === "both"
                    ? "var(--color-red)"
                    : "var(--color-cream)";
            const done = "done" in item && item.done;
            const active = item.date === selected;
            const open = () => {
              if (item.kind !== "task") return;
              openTask(item.id, "calendar");
              setTab("tasks");
            };
            return (
              <li key={item.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={open}
                  className={`min-w-0 flex-1 text-left ${
                    active && done
                      ? "task-done-pulse px-4 py-3"
                      : active
                        ? "task-glow"
                        : "rounded-2xl bg-raised"
                  }`}
                  style={active && !done ? ({ "--glow-color": glow } as CSSProperties) : undefined}
                >
                  <div className={active && !done ? "task-glow-inner" : active && done ? "" : "px-4 py-3"}>
                    <p className="text-sm text-muted">
                      {formatRuDay(item.date, "long") || item.date}
                      {item.kind === "task" ? " · задача" : item.kind === "list" ? " · список" : ""}
                      {done ? " · готово" : ""}
                    </p>
                    <p className="truncate text-[16px]">{item.title}</p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="В чат"
                  onClick={() => void shareCalendarItem(item)}
                  className="grid w-11 shrink-0 place-items-center rounded-2xl bg-raised"
                >
                  <MessageCircle className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setComposer(true)}
        className="fixed right-5 bottom-24 grid size-14 place-items-center rounded-full bg-blue text-bg"
        aria-label="Добавить событие"
      >
        <span className="text-3xl leading-none">+</span>
      </button>
      {composer ? (
        <EventComposer
          initialDate={selected}
          onClose={() => setComposer(false)}
          onSave={add}
        />
      ) : null}
    </section>
  );
}

function EventComposer({
  initialDate,
  onClose,
  onSave,
}: {
  initialDate: string;
  onClose: () => void;
  onSave: (title: string, date: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [pick, setPick] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] bg-bg">
      <div className="mx-auto flex h-full min-w-0 max-w-md flex-col overflow-x-hidden">
        <SheetHeader
          title="Событие"
          onCancel={onClose}
          onDone={() => {
            if (title.trim()) onSave(title.trim(), date);
          }}
          doneMuted={!title.trim()}
          doneTone="fg"
        />
        <div className="space-y-3 px-4">
          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">НАЗВАНИЕ</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ужин, поездка, визит"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>
          <button
            type="button"
            onClick={() => setPick(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-raised px-4 py-4"
          >
            <span>Когда</span>
            <span className="text-[15px]">{formatRuDay(date, "long")}</span>
          </button>
        </div>
      </div>
      {pick ? (
        <DatePicker
          mode="any"
          label="Дата события"
          value={date}
          onPick={(day) => {
            setDate(day);
            setPick(false);
          }}
          onClose={() => setPick(false)}
        />
      ) : null}
    </div>
  );
}

export function WishesScreen() {
  useScreenPoll("wishes", true, LIST_POLL_MS, refreshPairWishes);
  const wishes = useCouple((s) => s.wishes);
  const filter = useCouple((s) => s.wishFilter);
  const setFilter = useCouple((s) => s.setWishFilter);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const colors = usePlayerColors();
  const [sheet, setSheet] = useState<"new" | Wish | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useOpenChatTarget("wish", (target) => setOpenId(target.id));
  const selected = wishes.find((w) => w.id === openId);
  const who = (wish: Wish) => viewedWishOwner(wish, myUserId);

  const visible = wishes.filter((w) => filter === "all" || who(w) === filter);
  const openWishes = visible.filter((w) => !w.fulfilled);
  const doneWishes = visible.filter((w) => w.fulfilled);
  const myCount = wishes.filter((w) => who(w) === "me" && !w.fulfilled).length;
  const partnerCount = wishes.filter((w) => who(w) === "partner" && !w.fulfilled).length;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
      {selected ? (
        <WishDetail
          wish={selected}
          onBack={() => setOpenId(null)}
          onEdit={() => setSheet(selected)}
        />
      ) : (
        <>
          <ScreenHeader title="Хотелки" onAdd={() => setSheet("new")} />
          <div className="flex min-w-0 flex-wrap gap-2 px-5 pb-2">
            <Chip tone="piece" piece={colors.partner} active={filter === "partner"} onClick={() => setFilter("partner")}>
              {`${partnerName} · ${partnerCount}`}
            </Chip>
            <Chip tone="piece" piece={colors.me} active={filter === "me"} onClick={() => setFilter("me")}>
              {`${myName} · ${myCount}`}
            </Chip>
            <Chip tone="white" active={filter === "all"} onClick={() => setFilter("all")}>
              Все
            </Chip>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={<Gift className="size-16" strokeWidth={1.2} />}
              title="Список пуст"
              body="Вставьте ссылку на вещь — или добавьте фото и название сами."
              action="Добавить хотелку"
              hint="можно с фото из галереи"
              onAction={() => setSheet("new")}
            />
          ) : (
            <div className="space-y-10 px-5 pb-28">
              {openWishes.length ? (
                <ul className="space-y-3">
                  {openWishes.map((wish) => (
                    <li key={wish.id}>
                      <WishRow wish={wish} onOpen={() => setOpenId(wish.id)} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {doneWishes.length ? (
                <div>
                  <p className="mb-2 text-[11px] tracking-widest text-muted uppercase">Исполненные</p>
                  <ul className="space-y-3">
                    {doneWishes.map((wish) => (
                      <li key={wish.id}>
                        <WishRow wish={wish} onOpen={() => setOpenId(wish.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
      {sheet === "new" ? <NewWishSheet onClose={() => setSheet(null)} /> : null}
      {sheet && sheet !== "new" ? (
        <NewWishSheet
          wish={wishes.find((w) => w.id === sheet.id) ?? sheet}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </section>
  );
}

function WishRow({ wish, onOpen }: { wish: Wish; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-raised p-3 text-left"
    >
      <WishPhoto
        wish={wish}
        className={`size-14 shrink-0 rounded-xl object-cover ${wish.fulfilled ? "opacity-70" : ""}`}
        fallback={
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-chip text-muted">
            <Gift className="size-6" />
          </span>
        }
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[16px] ${wish.fulfilled ? "text-muted line-through" : ""}`}>
          {wish.title}
        </span>
        <span className="mt-1 block text-sm text-muted">
          {wish.fulfilled
            ? fulfilledLabel(wish.fulfilledAt || wish.createdAt)
            : `${wish.price ? formatWishPrice(wish.price, wish.currency) : "без цены"}${
                wish.priority === "really" ? " · очень хочу" : " · хочу"
              }`}
        </span>
      </span>
    </button>
  );
}

function fulfilledLabel(iso?: string) {
  const date = new Date(iso || Date.now());
  const month = RU_MONTHS[date.getMonth()] ?? "";
  const prep: Record<string, string> = {
    январь: "январе",
    февраль: "феврале",
    март: "марте",
    апрель: "апреле",
    май: "мае",
    июнь: "июне",
    июль: "июле",
    август: "августе",
    сентябрь: "сентябре",
    октябрь: "октябре",
    ноябрь: "ноябре",
    декабрь: "декабре",
  };
  return `исполнено в ${prep[month] ?? month}`;
}

function formatWishPrice(price: string, currency?: string) {
  const num = price.replace(/\s/g, "");
  const pretty = Number.isFinite(Number(num))
    ? Number(num).toLocaleString("ru-RU")
    : price;
  const code = currency || "";
  const symbol = code === "RUB" ? "₽" : code === "USD" ? "$" : code === "EUR" ? "€" : code === "KZT" ? "₸" : code;
  return `${pretty} ${symbol}`.trim();
}

function shortLink(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const path = `${u.host}${u.pathname}`.replace(/\/$/, "");
    return path.length > 34 ? `${path.slice(0, 22)}…${path.slice(-10)}` : path;
  } catch {
    return url;
  }
}

function openWishLink(url: string) {
  if (!url.trim()) return;
  const href = url.startsWith("http") ? url : `https://${url}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

function WishDetail({
  wish,
  onBack,
  onEdit,
}: {
  wish: Wish;
  onBack: () => void;
  onEdit: () => void;
}) {
  const updateWish = useCouple((s) => s.updateWish);
  const deleteWish = useCouple((s) => s.deleteWish);
  const partnerName = useCouple((s) => s.partnerName);
  const myUserId = useCouple((s) => s.myUserId);
  const colors = usePlayerColors();
  const [menu, setMenu] = useState(false);
  const side = viewedWishOwner(wish, myUserId);
  const when = formatRuDay(toIsoDate(wish.createdAt ? new Date(wish.createdAt) : new Date()), "dayMonth");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative h-56 shrink-0 overflow-hidden bg-raised">
        <WishPhoto
          wish={wish}
          className="size-full object-cover"
          fallback={
            <div className="grid size-full place-items-center text-muted">
              <Gift className="size-16" />
            </div>
          }
        />
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-black/55"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className="grid size-10 place-items-center rounded-full bg-black/55"
            aria-label="Ещё"
          >
            ⋯
          </button>
          {menu ? (
            <div className="absolute top-12 right-0 z-20 min-w-40 overflow-hidden rounded-xl bg-raised">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onEdit();
                }}
                className="block w-full px-4 py-3 text-left"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  deleteWish(wish.id);
                  void deletePairWish({ data: wish.id }).catch(() => undefined);
                  onBack();
                }}
                className="block w-full px-4 py-3 text-left text-pink"
              >
                Удалить
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-36">
        <p className="mt-5 flex items-center gap-2 text-[14px] text-muted">
          <span className={`size-3 rounded-full ${pieceBg(side === "me" ? colors.me : colors.partner)}`} />
          {side === "me" ? "Ты" : partnerName} · {when}
        </p>
        <h1 className="mt-3 text-[32px] leading-tight font-semibold">{wish.title}</h1>
        {wish.price ? (
          <p className="mt-4 text-[28px] font-semibold tracking-wide">
            {formatWishPrice(wish.price, wish.currency)}
          </p>
        ) : null}
        {wish.note ? <p className="mt-3 text-[15px] text-muted">{wish.note}</p> : null}

        {wish.link ? (
          <button
            type="button"
            onClick={() => openWishLink(wish.link)}
            className="mt-6 flex w-full items-center justify-between rounded-2xl bg-raised px-4 py-4"
          >
            <span className="truncate text-[15px] text-muted">{shortLink(wish.link)}</span>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </button>
        ) : null}

        <InChatRow
          onSend={() =>
            shareToChat({
              kind: "wish",
              id: wish.id,
              title: wish.title,
              subtitle: wish.price ? formatWishPrice(wish.price, wish.currency) : "",
            })
          }
        />
      </div>

      <div className="absolute right-0 bottom-24 left-0 flex gap-3 px-5">
        <button
          type="button"
          onClick={() => (wish.link ? openWishLink(wish.link) : undefined)}
          disabled={!wish.link}
          className="flex-1 rounded-full bg-cream py-4 text-[16px] font-semibold text-cream-fg disabled:opacity-40"
        >
          Открыть на сайте
        </button>
        <button
          type="button"
          onClick={() =>
            updateWish(wish.id, {
              fulfilled: !wish.fulfilled,
              fulfilledAt: wish.fulfilled ? undefined : new Date().toISOString(),
            })
          }
          className={`rounded-full border border-line px-5 py-4 text-[16px] font-medium ${
            wish.fulfilled ? "bg-chip text-muted" : ""
          }`}
        >
          {wish.fulfilled ? "Снова хочу" : "Исполнено"}
        </button>
      </div>
    </div>
  );
}

export function ListsScreen() {
  const lists = useCouple((s) => s.lists);
  const myName = useCouple((s) => s.myName);
  const [sheet, setSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  useOpenChatTarget("list", (target) => setOpenId(target.id));
  const selected = lists.find((l) => l.id === openId);

  if (selected) {
    return <ListDetail list={selected} onBack={() => setOpenId(null)} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="Списки" onAdd={() => setSheet(true)} />
      {lists.length === 0 ? (
        <EmptyState
          icon={
            <div className="space-y-2 text-muted">
              <div className="flex items-center gap-3">
                <Check className="size-7" />
                <span className="h-0.5 w-10 bg-line" />
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-7" />
                <span className="h-0.5 w-10 bg-line" />
              </div>
            </div>
          }
          title="Списки на двоих"
          body="Куда сходить, что посмотреть, что приготовить. Один добавляет — второй отмечает."
          action="Создать список"
          hint="без сумм и бюджета — только галочки"
          onAction={() => setSheet(true)}
        />
      ) : (
        <div className="space-y-3 px-5 pb-28">
          {lists.map((list) => {
            const done = list.items.filter((i) => i.done).length;
            const total = list.items.length;
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => setOpenId(list.id)}
                className="w-full rounded-2xl bg-raised p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] tracking-widest text-muted">{list.title.toUpperCase()}</p>
                  <span className="size-4 rounded-full bg-blue" />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chip">
                  <div
                    className="h-full rounded-full bg-green"
                    style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-3 text-[15px]">
                  <span className="font-semibold">
                    {done} из {total}
                  </span>
                  <span className="ml-3 text-muted">
                    {myName} · сейчас
                  </span>
                </p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-raised px-4 py-4"
          >
            <Bookmark className="size-5" />
            <span className="flex-1 text-left">Шаблоны списков · 5</span>
            <ChevronRight className="size-4 text-muted" />
          </button>
        </div>
      )}
      {sheet ? <NewListSheet onClose={() => setSheet(false)} /> : null}
    </section>
  );
}

function ListDetail({ list, onBack }: { list: CheckList; onBack: () => void }) {
  const addListItem = useCouple((s) => s.addListItem);
  const updateListItem = useCouple((s) => s.updateListItem);
  const toggleListItem = useCouple((s) => s.toggleListItem);
  const deleteList = useCouple((s) => s.deleteList);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const [filter, setFilter] = useState<"left" | "done" | "all">("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [itemDate, setItemDate] = useState("");
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState<"new" | string | null>(null);
  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const visible = list.items.filter((i) => {
    if (filter === "left") return !i.done;
    if (filter === "done") return i.done;
    return true;
  });

  const commit = () => {
    if (!draft.trim()) {
      setAdding(false);
      return;
    }
    addListItem(list.id, draft.trim(), itemDate || undefined);
    setDraft("");
    setItemDate("");
    setAdding(true);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-5 pb-28">
      <header className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Списки
        </button>
        <div className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} className="px-2 text-muted" aria-label="Ещё">
            ⋯
          </button>
          {menu ? (
            <div className="absolute top-8 right-0 z-20 min-w-40 overflow-hidden rounded-xl bg-raised">
              <button
                type="button"
                onClick={() => {
                  deleteList(list.id);
                  onBack();
                }}
                className="block w-full px-4 py-3 text-left text-pink"
              >
                Удалить
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <h1 className="mt-4 text-[32px] font-semibold">{list.title}</h1>
      <p className="mt-1 text-[15px] text-muted">{list.details || "список на двоих"}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chip">
          <div
            className="h-full rounded-full bg-green"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[13px] text-muted">
          {done} из {total}
        </span>
      </div>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {(
          [
            ["left", `Осталось · ${list.items.filter((i) => !i.done).length}`],
            ["done", `Сделано · ${done}`],
            ["all", "Все"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`max-w-full rounded-full px-3 py-2 text-[13px] break-words ${
              filter === id ? "bg-chip text-fg" : "bg-raised text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {adding ? (
        <div className="mt-4 rounded-2xl bg-raised p-3">
          <div className="flex items-center gap-3">
            <Circle className="size-5 text-muted" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              placeholder="Что добавить"
              className="flex-1 bg-transparent text-[16px] outline-none"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPick("new")}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wide ${
                itemDate ? "bg-[#163a3c] text-[#6ed7dc]" : "rounded-full bg-chip text-fg"
              }`}
            >
              {itemDate ? formatRuDay(itemDate, "dayMonthShort") : "Дата"}
            </button>
            <button type="button" onClick={commit} className="text-[15px] text-muted">
              Готово
            </button>
          </div>
          {itemDate ? (
            <div className="mt-3 flex items-center justify-between text-[15px]">
              <span>Дата пункта</span>
              <span className="rounded-md bg-[#163a3c] px-3 py-1 text-[12px] font-semibold text-[#6ed7dc]">
                {formatRuDay(itemDate, "dayMonthShort")}
              </span>
            </div>
          ) : null}
          <p className="mt-3 text-[13px] leading-snug text-muted">
            «Готово» сохраняет и сразу открывает следующий пункт
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-4 text-muted"
        >
          <Plus className="size-4" /> Добавить пункт
        </button>
      )}

      <ul className="mt-3 space-y-3">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-2xl bg-raised px-4 py-3">
            <button
              type="button"
              onClick={() => toggleListItem(list.id, item.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              {item.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-green" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block ${item.done ? "text-muted line-through" : ""}`}>{item.text}</span>
                <span className="mt-1 block text-[13px] text-muted">
                  {item.addedBy === "me" ? myName : partnerName}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPick(item.id)}
              className={
                item.date
                  ? "rounded-md bg-[#163a3c] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#6ed7dc]"
                  : "rounded-md bg-chip px-2 py-1 text-[11px] tracking-wide text-muted"
              }
            >
              {item.date ? formatRuDay(item.date, "dayMonthShort") : "Дата"}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] leading-snug text-muted">
        Пункт с датой сам появится в календаре. Отметить может любой из вас.
      </p>
      <InChatRow
        className="mt-4"
        onSend={() => shareToChat({ kind: "list", id: list.id, title: list.title, subtitle: list.details })}
      />
      {pick ? (
        <DatePicker
          mode="any"
          label="Дата пункта"
          value={(pick === "new" ? itemDate : list.items.find((i) => i.id === pick)?.date) ?? ""}
          onPick={(day) => {
            if (pick === "new") setItemDate(day);
            else updateListItem(list.id, pick, { date: day });
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      ) : null}
    </section>
  );
}

const MORE = [
  { id: "chat", label: "Чат", icon: MessageCircle },
  { id: "album", label: "Альбом", icon: Images },
  { id: "budget", label: "Бюджет", icon: Wallet },
  { id: "files", label: "Файлы", icon: Folder },
  { id: "cards", label: "Карты", icon: CreditCard },
  { id: "question", label: "Вопрос дня", icon: CircleHelp },
  { id: "test", label: "Тест совместимости", icon: Target },
  { id: "games", label: "Игры", icon: Gamepad2 },
  { id: "capsule", label: "Капсула времени", icon: Mail },
  { id: "vote", label: "Голосование", icon: Vote },
  { id: "radar", label: "Радар подарков", icon: Radar },
  { id: "notes", label: "Заметки", icon: ListTodo },
  { id: "settings", label: "Настройки", icon: Settings },
];

export function MoreScreen() {
  const setMore = useCouple((s) => s.setMore);
  const moreOpen = useCouple((s) => s.moreOpen);
  const chatUnread = useCouple((s) => s.chatUnread);
  const partnerName = useCouple((s) => s.partnerName);
  const quiz = useCouple((s) => s.quiz);
  const nudge = quizNudge({
    myDoneAt: quiz.myDoneAt,
    partnerRemindedAt: quiz.partnerRemindedAt,
    partnerName,
  });

  if (moreOpen === "chat") {
    return <ChatScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "album") {
    return <AlbumScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "notes") {
    return <NotesScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "radar") {
    return <GiftRadarScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "vote") {
    return <VotingScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "capsule") {
    return <CapsuleScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "test") {
    return <CompatibilityScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "question") {
    return <QuestionDayScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "cards") {
    return <CardsScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "budget") {
    return <BudgetScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "games") {
    return <GamesScreen onBack={() => setMore(null)} />;
  }

  if (moreOpen === "settings") {
    return <BirthdaySettings onBack={() => setMore(null)} />;
  }

  if (moreOpen) {
    const item = MORE.find((m) => m.id === moreOpen);
    return (
      <section className="px-5 pt-6">
        <button type="button" onClick={() => setMore(null)} className="text-muted">
          Назад
        </button>
        <h1 className="mt-4 text-[32px] font-semibold">{item?.label}</h1>
        <p className="mt-4 text-muted">Раздел готов к наполнению. Сейчас важнее каркас экранов.</p>
      </section>
    );
  }

  return (
    <section className="px-5 pt-6 pb-28">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-[32px] font-semibold">Ещё</h1>
        <UsBadge />
      </div>
      <div className="mt-5 overflow-hidden rounded-[28px] bg-raised">
        {MORE.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMore(item.id)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left ${
                index ? "border-t border-line" : ""
              }`}
            >
              <Icon className="size-5 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px]">{item.label}</span>
                {item.id === "test" && nudge ? (
                  <span className="mt-1 block text-[13px] leading-4 text-muted">{nudge}</span>
                ) : null}
              </span>
              {item.id === "chat" && chatUnread > 0 ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-cream px-1.5 text-[12px] font-semibold text-cream-fg">
                  {badgeLabel(chatUnread)}
                </span>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted" />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-4 flex w-full items-center gap-3 rounded-[28px] bg-raised px-4 py-4 text-left"
      >
        <span className="text-lg">↕</span>
        <div>
          <p className="text-[16px]">Изменить порядок</p>
          <p className="text-sm text-muted">что сидит в панели и как идёт этот список</p>
        </div>
      </button>
    </section>
  );
}

function BirthdaySettings({ onBack }: { onBack: () => void }) {
  const inviteCode = useCouple((s) => s.inviteCode);
  const myBirthday = useCouple((s) => s.myBirthday);
  const partnerBirthday = useCouple((s) => s.partnerBirthday);
  const myBirthdayEdits = useCouple((s) => s.myBirthdayEdits);
  const partnerBirthdayEdits = useCouple((s) => s.partnerBirthdayEdits);
  const setMyBirthday = useCouple((s) => s.setMyBirthday);
  const setPartnerBirthday = useCouple((s) => s.setPartnerBirthday);
  const myLocked = Boolean(myBirthday) && myBirthdayEdits >= 1;
  const partnerLocked = Boolean(partnerBirthday) && partnerBirthdayEdits >= 1;
  const joined = useCouple((s) => s.joined);
  const saveMine = (iso: string) => {
    const ok = setMyBirthday(iso);
    if (ok) void saveMyProfile({ data: { birthday: iso } }).catch(() => undefined);
    return ok;
  };

  return (
    <section className="px-5 pt-6 pb-28">
      <button type="button" onClick={onBack} className="text-[17px] text-muted">
        ‹ Ещё
      </button>
      <h1 className="mt-5 text-[34px] font-semibold tracking-tight">Настройки</h1>
      <AccountLogoutButton />
      <PasswordSettings />
      <LoginActivity />
      <ColorChoice />
      <div className="mt-4">
        <PairCode
          code={inviteCode}
          label="Твой код"
          hint={
            joined
              ? "Пара уже собрана. Этим кодом партнёр вошёл. Новый человек по нему не подключится."
              : "Партнёр вводит этот код у себя. В паре только двое."
          }
        />
      </div>
      <BirthdayField
        label="Мой день рождения"
        value={myBirthday}
        locked={myLocked}
        hint={
          myLocked
            ? "Дату уже меняли один раз — больше нельзя"
            : myBirthday
              ? "Можно поменять ещё один раз"
              : "Укажи здесь. Позже подтянем из Google."
        }
        onSave={saveMine}
      />
      <BirthdayField
        label="День рождения партнёра"
        value={partnerBirthday}
        locked={partnerLocked}
        hint={
          partnerLocked
            ? "Дату уже меняли один раз — больше нельзя"
            : "Из профиля партнёра. Можно поправить один раз."
        }
        onSave={setPartnerBirthday}
      />
      <button
        type="button"
        onClick={() => void leaveSharedPair().catch(() => undefined)}
        className="mt-4 min-h-11 w-full rounded-[22px] bg-raised py-4 text-[16px] text-muted"
      >
        Выйти из пары
      </button>
    </section>
  );
}

function ColorChoice() {
  const myColor = useCouple((s) => s.myColor);
  const colors = usePlayerColors();
  const pick = (color: PieceColor) => {
    useCouple.setState({ myColor: color });
    void saveMyProfile({ data: { color } }).catch(() => undefined);
  };
  return (
    <div className="mt-4 rounded-[22px] bg-raised px-5 py-5">
      <p className="text-[13px] text-muted">Твой цвет</p>
      <p className="mt-1 text-[14px] leading-5 text-[#e6e1d6]">Один и тот же на твоём телефоне и у партнёра.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => pick("blue")}
          className={`min-h-11 rounded-full text-[16px] font-semibold ${myColor === "blue" ? "bg-blue text-bg" : "bg-bg"}`}
        >
          Синий
        </button>
        <button
          type="button"
          onClick={() => pick("pink")}
          className={`min-h-11 rounded-full text-[16px] font-semibold ${myColor === "pink" ? "bg-pink text-bg" : "bg-bg"}`}
        >
          Розовый
        </button>
      </div>
      {myColor && colors.me !== myColor ? (
        <p className="mt-3 text-[13px] leading-5 text-muted">Этот цвет уже у партнёра, поэтому на доске у тебя другой.</p>
      ) : null}
    </div>
  );
}

function BirthdayField({
  label,
  value,
  locked,
  hint,
  onSave,
}: {
  label: string;
  value: string;
  locked: boolean;
  hint: string;
  onSave: (iso: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const shown = draft ? formatRuDay(draft, "long") : "Выбрать дату";

  return (
    <div className="mt-3 rounded-[22px] bg-raised px-5 py-5">
      <p className="text-[13px] text-muted">{label}</p>
      <button
        type="button"
        disabled={locked}
        onClick={() => setOpen(true)}
        className={`mt-3 flex w-full items-center justify-between rounded-2xl bg-chip px-4 py-3.5 text-left text-[16px] ${
          draft ? "text-fg" : "text-muted"
        } ${locked ? "opacity-60" : ""}`}
      >
        <span>{shown}</span>
        {locked ? null : <span className="text-muted">›</span>}
      </button>
      {open && !locked ? (
        <DatePicker
          mode="birthday"
          label={label}
          value={draft}
          onPick={(iso) => {
            setDraft(iso);
            setMsg("");
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <p className="mt-2 text-[13px] leading-5 text-muted">{hint}</p>
      {locked ? null : (
        <button
          type="button"
          onClick={() => setMsg(onSave(draft) ? "Сохранено" : "Сначала выбери дату")}
          className="mt-3 w-full rounded-full bg-cream py-3.5 text-[16px] font-semibold text-cream-fg"
        >
          Сохранить дату
        </button>
      )}
      {msg ? <p className="mt-2 text-sm text-green">{msg}</p> : null}
    </div>
  );
}
