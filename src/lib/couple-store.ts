import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pickQuestion, questionById } from "@/lib/daily-questions";
import { pairColors, type PieceColor } from "@/lib/pair-color";
import {
  DEMO_ANNIVERSARY,
  FALLBACK_MY_NAME,
  FALLBACK_PARTNER_NAME,
  scrubStoredCouple,
} from "@/lib/pair-identity";

export type TabId = "tasks" | "calendar" | "wishes" | "lists" | "more";
export type WishOwner = "me" | "partner" | "all";

export type TaskOwner = "free" | "me" | "partner" | "both";
export type RepeatKind = "none" | "daily" | "weekly" | "monthly";

export type Subtask = { id: string; text: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  owner: TaskOwner;
  done: boolean;
  subtasks: Subtask[];
  note: string;
  dueDate?: string;
  repeat: RepeatKind;
  showInCalendar: boolean;
  createdAt: string;
  claimedAt?: string;
  assignedBy: "me";
  ownerUserId?: string | null;
  createdBy?: string | null;
  updatedAt?: string;
  deleted?: boolean;
};

export type EventItem = {
  id: string;
  title: string;
  date: string;
};

export type WishPriority = "want" | "really";

export type Wish = {
  id: string;
  title: string;
  link: string;
  photo: string;
  price: string;
  currency: string;
  priority: WishPriority;
  note: string;
  owner: "me" | "partner";
  ownerUserId?: string | null;
  createdAt: string;
  fulfilled: boolean;
  fulfilledAt?: string;
  photoPath?: string | null;
  updatedAt?: string;
  deleted?: boolean;
};

export type ListItem = {
  id: string;
  text: string;
  done: boolean;
  date?: string;
  addedBy: "me" | "partner";
};

export type NoteFolder = {
  id: string;
  title: string;
  color: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  folderId?: string;
  tags: string[];
  createdAt: string;
  author: "me" | "partner";
};

export type CheckList = {
  id: string;
  title: string;
  details: string;
  anyoneCanDone: boolean;
  createdAt: string;
  items: ListItem[];
};

export type VoteOption = { id: string; text: string };

export type VotePoll = {
  id: string;
  question: string;
  options: VoteOption[];
  createdAt: string;
  createdBy: "me" | "partner";
  myChoice?: string;
  partnerChoice?: string;
};

export type Capsule = {
  id: string;
  title: string;
  body: string;
  to: "partner" | "me";
  opensAt: string;
  createdAt: string;
  author: "me" | "partner";
};

export type CardKind = "ean13" | "code128" | "qr";
export type LoyaltyCard = {
  id: string;
  title: string;
  number: string;
  kind: CardKind;
  color: string;
  owner?: "me" | "partner";
};
export type ChatMsg = {
  id: string;
  at: string;
  author: "me" | "partner";
  text: string;
  cardId?: string;
};

export type GameWins = { me: number; partner: number };
export type TttRecord = { me: number; partner: number; games: number };

export type BudgetTx = {
  id: string;
  kind: "expense" | "income";
  amount: number;
  currency: string;
  categoryId: string;
  date: string;
  paidBy: "me" | "partner";
  note: string;
  createdAt: string;
};
export type BudgetCategory = {
  id: string;
  title: string;
  kind: "expense" | "income";
  icon: string;
  color: string;
  hidden?: boolean;
};
export type BudgetAccount = { id: string; title: string };
export type BudgetLimitLog = { id: string; key: string; title: string; amount: number | null; at: string };
export type RecurringPayment = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amount: number;
  currency: string;
  categoryId: string;
  accountId: string;
  paidBy: "me" | "partner";
  freq: "month" | "week" | "biweek" | "year";
  day: number;
  mode: "auto" | "confirm";
  remindAt: string;
  lastPosted: string;
};
export type BudgetAlert = { id: string; title: string; body: string; at: string };
export type BudgetState = {
  currency: string;
  txs: BudgetTx[];
  categories: BudgetCategory[];
  accounts: BudgetAccount[];
  monthLimit: number | null;
  monthLimitFrom: string | null;
  catLimits: Record<string, number>;
  limitLog: BudgetLimitLog[];
  recurring: RecurringPayment[];
  alerts: BudgetAlert[];
};
export type Person = {
  id: string;
  name: string;
  date: string;
  relation: string;
  note: string;
  noYear: boolean;
};

export type QuizState = {
  index: number;
  myAnswers: number[];
  partnerAnswers: number[];
  myDoneAt?: string;
  partnerDoneAt?: string;
  remindedAt?: string;
  consented: boolean;
};

export type DailyEntry = {
  date: string;
  questionId: string;
  topic: string;
  text: string;
  myAnswer?: string;
  myAt?: string;
  partnerAnswer?: string;
  partnerAt?: string;
};

export type DailyState = {
  date: string;
  questionId: string;
  myAnswer?: string;
  myAt?: string;
  partnerAnswer?: string;
  partnerAt?: string;
  skippedIds: string[];
  history: DailyEntry[];
};

type CoupleState = {
  pairCode: string | null;
  seat: "a" | "b";
  waiting: boolean;
  joined: boolean;
  myName: string;
  partnerName: string;
  myUserId: string | null;
  partnerUserId: string | null;
  myColor: PieceColor | null;
  partnerColor: PieceColor | null;
  inviteCode: string | null;
  deletedTaskIds: string[];
  deletedWishIds: string[];
  myBirthday: string;
  partnerBirthday: string;
  myBirthdayEdits: number;
  partnerBirthdayEdits: number;
  tab: TabId;
  moreOpen: string | null;
  tasks: Task[];
  events: EventItem[];
  wishes: Wish[];
  wishFilter: WishOwner;
  lists: CheckList[];
  notes: Note[];
  noteFolders: NoteFolder[];
  votes: VotePoll[];
  capsules: Capsule[];
  anniversaryDate: string;
  pairedAt: string | null;
  gettingMarried: boolean;
  weddingDate: string;
  people: Person[];
  quiz: QuizState;
  daily: DailyState;
  cards: LoyaltyCard[];
  chat: ChatMsg[];
  gameWins: GameWins;
  tttRecord: TttRecord;
  tttNoted: string;
  budget: BudgetState;
  openTaskId: string | null;
  taskReturn: TabId | null;
  createPair: () => void;
  joinPair: (code: string) => boolean;
  partnerArrived: () => void;
  leavePair: () => void;
  setMyName: (name: string) => void;
  setPartnerName: (name: string) => void;
  setPairUsers: (mine: string | null, partner: string | null) => void;
  setSeat: (seat: "a" | "b") => void;
  applyPairSession: (input: {
    pairId: string | null;
    seat: "a" | "b" | null;
    inviteCode: string;
    myBirthday: string | null;
    partnerBirthday: string | null;
    myColor: PieceColor | null;
    partnerColor: PieceColor | null;
  }) => void;
  applyCoupleIdentity: (input: {
    myName: string;
    partnerName: string;
    pairedAt: string | null;
    togetherSince: string | null;
  }) => void;
  replaceTasks: (tasks: Task[]) => void;
  replaceWishes: (wishes: Wish[]) => void;
  replaceTaskMeta: (id: string, patch: Partial<Task>) => void;
  replaceWishMeta: (id: string, patch: Partial<Wish>) => void;
  rememberDeletes: (tasks: string[], wishes: string[]) => void;
  setMyBirthday: (iso: string) => boolean;
  setPartnerBirthday: (iso: string) => boolean;
  setTab: (tab: TabId) => void;
  setMore: (id: string | null) => void;
  addTask: (input: Omit<Task, "id" | "done" | "createdAt" | "assignedBy">) => void;
  updateTask: (id: string, input: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  claimTask: (id: string, owner: TaskOwner) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  addSubtask: (taskId: string, text: string) => void;
  addEvent: (title: string, date: string) => void;
  addWish: (input: Omit<Wish, "id" | "createdAt" | "fulfilled">) => void;
  updateWish: (id: string, input: Partial<Wish>) => void;
  deleteWish: (id: string) => void;
  setWishFilter: (f: WishOwner) => void;
  addList: (input: { title: string; details: string; anyoneCanDone: boolean; items: string[] }) => void;
  addListItem: (listId: string, text: string, date?: string) => void;
  updateListItem: (listId: string, itemId: string, input: Partial<ListItem>) => void;
  updateList: (id: string, input: Partial<CheckList>) => void;
  deleteList: (id: string) => void;
  toggleListItem: (listId: string, itemId: string) => void;
  addNote: (input: { title: string; body: string; folderId?: string; tags: string[] }) => void;
  updateNote: (id: string, input: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addNoteFolder: (title: string, color: string) => string;
  addVote: (question: string, options: string[]) => void;
  castVote: (id: string, optionId: string, who?: "me" | "partner") => void;
  deleteVote: (id: string) => void;
  addCapsule: (input: { title: string; body: string; opensAt: string; to: "partner" | "me" }) => void;
  deleteCapsule: (id: string) => void;
  setQuiz: (patch: Partial<QuizState>) => void;
  resetQuiz: () => void;
  ensureDaily: () => void;
  answerDaily: (text: string, who?: "me" | "partner") => void;
  skipDaily: () => void;
  addCard: (input: { title: string; number: string; kind: CardKind; color: string }) => void;
  updateCard: (id: string, input: Partial<LoyaltyCard>) => void;
  deleteCard: (id: string) => void;
  addChat: (text: string, cardId?: string) => void;
  addGameWin: (who: "me" | "partner") => void;
  noteTtt: (winner: "me" | "partner" | "draw", key: string) => void;
  setBudgetCurrency: (code: string) => void;
  addBudgetTx: (input: Omit<BudgetTx, "id" | "createdAt">) => void;
  deleteBudgetTx: (id: string) => void;
  addBudgetCategory: (input: Omit<BudgetCategory, "id">) => string;
  updateBudgetCategory: (id: string, input: Partial<BudgetCategory>) => void;
  addBudgetAccount: (title: string) => void;
  setBudgetLimit: (key: string, amount: number | null, title?: string) => void;
  addRecurring: (input: Omit<RecurringPayment, "id" | "lastPosted">) => void;
  updateRecurring: (id: string, input: Partial<RecurringPayment>) => void;
  deleteRecurring: (id: string) => void;
  markRecurringPosted: (id: string, period: string) => void;
  setAnniversaryDate: (iso: string) => void;
  setGettingMarried: (on: boolean, date?: string) => void;
  addPerson: (input: { name: string; date: string; relation: string; note: string; noYear: boolean }) => void;
  updatePerson: (id: string, input: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  openTask: (id: string | null, from?: TabId) => void;
};

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const MONTH_RU = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];

function limitAlerts(budget: BudgetState, input: Omit<BudgetTx, "id" | "createdAt">): BudgetAlert[] {
  if (input.kind !== "expense") return budget.alerts ?? [];
  const month = input.date.slice(0, 7);
  const inMonth = (t: BudgetTx) => t.kind === "expense" && t.date.startsWith(month);
  const prevCat = budget.txs.filter((t) => inMonth(t) && t.categoryId === input.categoryId).reduce((s, t) => s + t.amount, 0);
  const nextCat = prevCat + input.amount;
  const prevAll = budget.txs.filter(inMonth).reduce((s, t) => s + t.amount, 0);
  const nextAll = prevAll + input.amount;
  const list = [...(budget.alerts ?? [])];
  const monthName = MONTH_RU[Number(month.slice(5)) - 1] ?? month;
  const fmt = (n: number) =>
    input.currency === "USD" ? `$${Math.round(n).toLocaleString("en-US")}` : `${Math.round(n)} ${input.currency}`;
  const ping = (title: string, body: string, tag: string, delay = 0) => {
    list.unshift({ id: crypto.randomUUID(), title, body, at: new Date().toISOString() });
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    const show = () => {
      try {
        new Notification(title, { body, tag });
      } catch {
        /* ignore */
      }
    };
    const run = () => {
      if (Notification.permission === "granted") show();
      else if (Notification.permission === "default") void Notification.requestPermission().then((p) => p === "granted" && show());
    };
    window.setTimeout(run, delay);
  };
  const cap = budget.catLimits?.[input.categoryId];
  if (cap && prevCat < cap && nextCat >= cap) {
    const name = budget.categories.find((c) => c.id === input.categoryId)?.title ?? "Категория";
    ping(`Лимит · ${name}`, `${Math.round((nextCat / cap) * 100)}% — ${fmt(nextCat)} из ${fmt(cap)} за ${monthName}. Лимит категории превышен.`, `cat-${input.categoryId}`, 0);
  }
  if (budget.monthLimit && prevAll < budget.monthLimit && nextAll >= budget.monthLimit) {
    ping(
      "Месячный лимит расходов",
      `${Math.round((nextAll / budget.monthLimit) * 100)}% — ${fmt(nextAll)} из ${fmt(budget.monthLimit)} за ${monthName}. Лимит на месяц превышен.`,
      `month-${month}`,
      cap && prevCat < cap && nextCat >= cap ? 400 : 0,
    );
  }
  return list.slice(0, 20);
}

export function viewedOwner(task: Task, myUserId?: string | null): TaskOwner {
  if (task.ownerUserId === "both") return "both";
  if (task.ownerUserId && task.ownerUserId !== "free" && myUserId) {
    return task.ownerUserId === myUserId ? "me" : "partner";
  }
  return task.owner;
}

export function viewedWishOwner(wish: Wish, myUserId?: string | null): "me" | "partner" {
  if (wish.ownerUserId && myUserId) {
    return wish.ownerUserId === myUserId ? "me" : "partner";
  }
  return wish.owner;
}

export function ownerUserOf(owner: TaskOwner, myId: string | null, partnerId: string | null) {
  if (owner === "both") return "both";
  if (owner === "free") return null;
  if (owner === "me") return myId;
  return partnerId;
}

function stamp() {
  return new Date().toISOString();
}

export const useCouple = create<CoupleState>()(
  persist(
    (set, get) => ({
      pairCode: null,
      seat: "a",
      waiting: false,
      joined: false,
      myName: FALLBACK_MY_NAME,
      partnerName: FALLBACK_PARTNER_NAME,
      myUserId: null,
      partnerUserId: null,
      myColor: null,
      partnerColor: null,
      inviteCode: null,
      deletedTaskIds: [],
      deletedWishIds: [],
      myBirthday: "",
      partnerBirthday: "",
      myBirthdayEdits: 0,
      partnerBirthdayEdits: 0,
      tab: "tasks",
      moreOpen: null,
      tasks: [],
      events: [],
      wishes: [],
      wishFilter: "partner",
      lists: [],
      notes: [],
      noteFolders: [],
      votes: [],
      capsules: [],
      anniversaryDate: "",
      pairedAt: null,
      gettingMarried: false,
      weddingDate: "",
      people: [],
      quiz: { index: 0, myAnswers: [], partnerAnswers: [], consented: false },
      daily: {
        date: "",
        questionId: "real",
        skippedIds: [],
        history: [],
      },
      cards: [],
      chat: [],
      gameWins: { me: 0, partner: 0 },
      tttRecord: { me: 0, partner: 0, games: 0 },
      tttNoted: "",
      budget: {
        currency: "USD",
        txs: [],
        categories: [],
        accounts: [],
        monthLimit: null,
        monthLimitFrom: null,
        catLimits: {},
        limitLog: [],
        recurring: [],
        alerts: [],
      },
      openTaskId: null,
      taskReturn: null,
      createPair: () => set({ pairCode: code(), seat: "a", waiting: true, joined: false }),
      joinPair: (raw) => {
        const value = raw.trim().toUpperCase();
        const current = get().pairCode;
        if (current && value === current) {
          set({ waiting: false, joined: true });
          return true;
        }
        if (!current && value.length >= 4) {
          set({ pairCode: value, seat: "b", waiting: false, joined: true });
          return true;
        }
        return false;
      },
      partnerArrived: () => set({ waiting: false, joined: true }),
      setMyName: (name) => {
        const value = name.trim();
        if (value) set({ myName: value });
      },
      setPartnerName: (name) => {
        const value = name.trim();
        if (value) set({ partnerName: value });
      },
      setPairUsers: (mine, partner) => set({ myUserId: mine, partnerUserId: partner }),
      setSeat: (seat) => set({ seat }),
      applyPairSession: (input) => {
        const patch: Partial<CoupleState> = { inviteCode: input.inviteCode };
        if (input.pairId && input.seat) {
          patch.pairCode = input.pairId;
          patch.seat = input.seat;
          patch.joined = true;
          patch.waiting = false;
        }
        if (input.myBirthday && !get().myBirthday) patch.myBirthday = input.myBirthday;
        if (input.partnerBirthday && get().partnerBirthdayEdits === 0) patch.partnerBirthday = input.partnerBirthday;
        patch.myColor = input.myColor;
        patch.partnerColor = input.partnerColor;
        set(patch);
      },
      applyCoupleIdentity: (input) => {
        const patch: Partial<CoupleState> = {
          myName: input.myName,
          partnerName: input.partnerName,
          pairedAt: input.pairedAt,
        };
        if (input.togetherSince) patch.anniversaryDate = input.togetherSince;
        else if (get().anniversaryDate === DEMO_ANNIVERSARY) patch.anniversaryDate = "";
        set(patch);
      },
      replaceTasks: (tasks) => set({ tasks }),
      replaceWishes: (wishes) => set({ wishes }),
      replaceTaskMeta: (id, patch) =>
        set({ tasks: get().tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)) }),
      replaceWishMeta: (id, patch) =>
        set({ wishes: get().wishes.map((wish) => (wish.id === id ? { ...wish, ...patch } : wish)) }),
      rememberDeletes: (tasks, wishes) =>
        set({
          deletedTaskIds: [...new Set([...get().deletedTaskIds, ...tasks])],
          deletedWishIds: [...new Set([...get().deletedWishIds, ...wishes])],
        }),
      leavePair: () =>
        set({
          pairCode: null,
          seat: "a",
          waiting: false,
          joined: false,
          tab: "tasks",
          moreOpen: null,
          openTaskId: null,
          taskReturn: null,
          tasks: [],
          wishes: [],
          deletedTaskIds: [],
          deletedWishIds: [],
          partnerUserId: null,
        }),
      setMyBirthday: (iso) => {
        const value = iso.trim();
        if (!value) return false;
        const edits = get().myBirthdayEdits;
        const current = get().myBirthday;
        if (current && edits >= 1) return false;
        set({
          myBirthday: value,
          myBirthdayEdits: current ? edits + 1 : edits,
        });
        return true;
      },
      setPartnerBirthday: (iso) => {
        const value = iso.trim();
        if (!value) return false;
        const edits = get().partnerBirthdayEdits;
        const current = get().partnerBirthday;
        if (current && edits >= 1) return false;
        set({
          partnerBirthday: value,
          partnerBirthdayEdits: current ? edits + 1 : edits,
        });
        return true;
      },
      setTab: (tab) => set({ tab, moreOpen: null }),
      setMore: (id) => set({ moreOpen: id }),
      addTask: (input) =>
        set({
          tasks: [
            {
              id: crypto.randomUUID(),
              done: false,
              createdAt: new Date().toISOString(),
              assignedBy: "me",
              ...input,
              ownerUserId: input.ownerUserId ?? ownerUserOf(input.owner, get().myUserId, get().partnerUserId),
              createdBy: input.createdBy ?? get().myUserId,
              note: input.note ?? "",
              updatedAt: stamp(),
            },
            ...get().tasks,
          ],
        }),
      updateTask: (id, input) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...input,
                  note: input.note !== undefined ? input.note : t.note ?? "",
                  ownerUserId:
                    input.owner !== undefined
                      ? ownerUserOf(input.owner, get().myUserId, get().partnerUserId)
                      : input.ownerUserId !== undefined
                        ? input.ownerUserId
                        : t.ownerUserId,
                  updatedAt: stamp(),
                }
              : t,
          ),
        }),
      deleteTask: (id) =>
        set({
          tasks: get().tasks.filter((task) => task.id !== id),
          deletedTaskIds: get().deletedTaskIds.includes(id) ? get().deletedTaskIds : [...get().deletedTaskIds, id],
        }),
      toggleTask: (id) =>
        set({
          tasks: get().tasks.map((t) => (t.id === id ? { ...t, done: !t.done, updatedAt: stamp() } : t)),
        }),
      claimTask: (id, owner) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  owner,
                  ownerUserId: ownerUserOf(owner, get().myUserId, get().partnerUserId),
                  claimedAt: owner === "free" ? undefined : new Date().toISOString(),
                  done: owner === "free" ? false : t.done,
                  updatedAt: stamp(),
                }
              : t,
          ),
        }),
      toggleSubtask: (taskId, subId) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id !== taskId
              ? t
              : {
                  ...t,
                  subtasks: (t.subtasks ?? []).map((s) =>
                    s.id === subId ? { ...s, done: !s.done } : s,
                  ),
                  updatedAt: stamp(),
                },
          ),
        }),
      addSubtask: (taskId, text) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id !== taskId
              ? t
              : {
                  ...t,
                  subtasks: [
                    ...(t.subtasks ?? []),
                    { id: crypto.randomUUID(), text, done: false },
                  ],
                  updatedAt: stamp(),
                },
          ),
        }),
      addEvent: (title, date) =>
        set({
          events: [{ id: crypto.randomUUID(), title, date }, ...get().events],
        }),
      addWish: (input) =>
        set({
          wishes: [
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              fulfilled: false,
              ...input,
              ownerUserId: input.ownerUserId ?? ownerUserOf(input.owner, get().myUserId, get().partnerUserId),
              updatedAt: stamp(),
            },
            ...get().wishes,
          ],
        }),
      updateWish: (id, input) =>
        set({
          wishes: get().wishes.map((wish) =>
            wish.id === id
              ? {
                  ...wish,
                  ...input,
                  ownerUserId:
                    input.owner !== undefined
                      ? input.owner === "me"
                        ? get().myUserId
                        : get().partnerUserId
                      : input.ownerUserId !== undefined
                        ? input.ownerUserId
                        : wish.ownerUserId,
                  updatedAt: stamp(),
                }
              : wish,
          ),
        }),
      deleteWish: (id) =>
        set({
          wishes: get().wishes.filter((wish) => wish.id !== id),
          deletedWishIds: get().deletedWishIds.includes(id) ? get().deletedWishIds : [...get().deletedWishIds, id],
        }),
      setWishFilter: (wishFilter) => set({ wishFilter }),
      addList: (input) =>
        set({
          lists: [
            {
              id: crypto.randomUUID(),
              title: input.title,
              details: input.details,
              anyoneCanDone: input.anyoneCanDone,
              createdAt: new Date().toISOString(),
              items: input.items.map((text) => ({
                id: crypto.randomUUID(),
                text,
                done: false,
                addedBy: "me" as const,
              })),
            },
            ...get().lists,
          ],
        }),
      addListItem: (listId, text, date) =>
        set({
          lists: get().lists.map((l) =>
            l.id !== listId
              ? l
              : {
                  ...l,
                  items: [
                    ...l.items,
                    {
                      id: crypto.randomUUID(),
                      text,
                      done: false,
                      date: date || undefined,
                      addedBy: "me",
                    },
                  ],
                },
          ),
        }),
      updateListItem: (listId, itemId, input) =>
        set({
          lists: get().lists.map((l) =>
            l.id !== listId
              ? l
              : {
                  ...l,
                  items: l.items.map((i) => (i.id === itemId ? { ...i, ...input } : i)),
                },
          ),
        }),
      updateList: (id, input) =>
        set({
          lists: get().lists.map((l) => (l.id === id ? { ...l, ...input } : l)),
        }),
      deleteList: (id) => set({ lists: get().lists.filter((l) => l.id !== id) }),
      toggleListItem: (listId, itemId) =>
        set({
          lists: get().lists.map((l) =>
            l.id !== listId
              ? l
              : {
                  ...l,
                  items: l.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
                },
          ),
        }),
      addNote: (input) =>
        set({
          notes: [
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              author: "me",
              ...input,
            },
            ...get().notes,
          ],
        }),
      updateNote: (id, input) =>
        set({
          notes: get().notes.map((n) => (n.id === id ? { ...n, ...input } : n)),
        }),
      deleteNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
      addNoteFolder: (title, color) => {
        const id = crypto.randomUUID();
        set({
          noteFolders: [{ id, title, color }, ...get().noteFolders],
        });
        return id;
      },
      addVote: (question, options) =>
        set({
          votes: [
            {
              id: crypto.randomUUID(),
              question: question.trim(),
              options: options
                .map((text) => text.trim())
                .filter(Boolean)
                .map((text) => ({ id: crypto.randomUUID(), text })),
              createdAt: new Date().toISOString(),
              createdBy: "me",
            },
            ...get().votes,
          ],
        }),
      castVote: (id, optionId, who = "me") =>
        set({
          votes: get().votes.map((v) =>
            v.id !== id
              ? v
              : who === "partner"
                ? { ...v, partnerChoice: optionId }
                : { ...v, myChoice: optionId },
          ),
        }),
      deleteVote: (id) => set({ votes: get().votes.filter((v) => v.id !== id) }),
      addCapsule: (input) =>
        set({
          capsules: [
            {
              id: crypto.randomUUID(),
              title: input.title.trim(),
              body: input.body.trim(),
              to: input.to,
              opensAt: input.opensAt,
              createdAt: new Date().toISOString(),
              author: "me",
            },
            ...get().capsules,
          ],
        }),
      deleteCapsule: (id) => set({ capsules: get().capsules.filter((c) => c.id !== id) }),
      setQuiz: (patch) => set({ quiz: { ...get().quiz, ...patch } }),
      resetQuiz: () =>
        set({
          quiz: { index: 0, myAnswers: [], partnerAnswers: [], consented: false },
        }),
      ensureDaily: () => {
        const today = new Date().toISOString().slice(0, 10);
        const daily = get().daily;
        if (daily.date === today && daily.questionId) return;
        const history = [...(daily.history ?? [])];
        if (daily.date && daily.date !== today && (daily.myAnswer || daily.partnerAnswer)) {
          const q = questionById(daily.questionId);
          history.unshift({
            date: daily.date,
            questionId: daily.questionId,
            topic: q.topic,
            text: q.text,
            myAnswer: daily.myAnswer,
            myAt: daily.myAt,
            partnerAnswer: daily.partnerAnswer,
            partnerAt: daily.partnerAt,
          });
        }
        const next = pickQuestion(today, daily.skippedIds ?? []);
        set({
          daily: {
            date: today,
            questionId: next.id,
            skippedIds: daily.skippedIds ?? [],
            history,
          },
        });
      },
      answerDaily: (text, who = "me") => {
        const value = text.trim();
        if (!value) return;
        get().ensureDaily();
        const daily = get().daily;
        if (who === "me" && daily.myAnswer) return;
        if (who === "partner" && daily.partnerAnswer) return;
        set({
          daily:
            who === "partner"
              ? { ...daily, partnerAnswer: value, partnerAt: new Date().toISOString() }
              : { ...daily, myAnswer: value, myAt: new Date().toISOString() },
        });
      },
      skipDaily: () => {
        get().ensureDaily();
        const daily = get().daily;
        const today = daily.date;
        const skippedIds = [...new Set([...(daily.skippedIds ?? []), daily.questionId])];
        const next = pickQuestion(today, skippedIds);
        set({
          daily: {
            date: today,
            questionId: next.id,
            skippedIds,
            history: daily.history ?? [],
          },
        });
      },
      addCard: (input) =>
        set({ cards: [{ id: crypto.randomUUID(), ...input }, ...get().cards] }),
      updateCard: (id, input) =>
        set({ cards: get().cards.map((c) => (c.id === id ? { ...c, ...input } : c)) }),
      deleteCard: (id) => set({ cards: get().cards.filter((c) => c.id !== id) }),
      addChat: (text, cardId) =>
        set({
          chat: [
            { id: crypto.randomUUID(), at: new Date().toISOString(), author: "me", text, cardId },
            ...get().chat,
          ],
        }),
      addGameWin: (who) =>
        set({
          gameWins: {
            ...get().gameWins,
            [who]: (get().gameWins?.[who] ?? 0) + 1,
          },
        }),
      noteTtt: (winner, key) => {
        if (get().tttNoted === key) return;
        const record = get().tttRecord ?? { me: 0, partner: 0, games: 0 };
        const wins = get().gameWins ?? { me: 0, partner: 0 };
        const nextRecord = {
          me: record.me + (winner === "me" ? 1 : 0),
          partner: record.partner + (winner === "partner" ? 1 : 0),
          games: record.games + 1,
        };
        const nextWins =
          winner === "draw"
            ? wins
            : winner === "me"
              ? { ...wins, me: wins.me + 2 }
              : { ...wins, partner: wins.partner + 2 };
        set({ tttRecord: nextRecord, gameWins: nextWins, tttNoted: key });
      },
      setBudgetCurrency: (code) => set({ budget: { ...get().budget, currency: code } }),
      addBudgetTx: (input) => {
        const budget = get().budget;
        set({
          budget: {
            ...budget,
            txs: [{ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...budget.txs],
            alerts: limitAlerts(budget, input),
          },
        });
      },
      deleteBudgetTx: (id) =>
        set({ budget: { ...get().budget, txs: get().budget.txs.filter((t) => t.id !== id) } }),
      addBudgetCategory: (input) => {
        const id = crypto.randomUUID();
        set({ budget: { ...get().budget, categories: [...get().budget.categories, { ...input, id }] } });
        return id;
      },
      updateBudgetCategory: (id, input) => {
        const list = get().budget.categories;
        const found = list.some((c) => c.id === id);
        set({
          budget: {
            ...get().budget,
            categories: found
              ? list.map((c) => (c.id === id ? { ...c, ...input } : c))
              : [...list, { id, title: "", kind: "expense", icon: "more", color: "#2a2d36", ...input }],
          },
        });
      },
      addBudgetAccount: (title) => {
        const name = title.trim();
        if (!name) return;
        set({
          budget: {
            ...get().budget,
            accounts: [...get().budget.accounts, { id: crypto.randomUUID(), title: name }],
          },
        });
      },
      setBudgetLimit: (key, amount, title) => {
        const budget = get().budget;
        const label = title || (key === "__month__" ? "Общий лимит" : "Категория");
        const log = [
          { id: crypto.randomUUID(), key, title: label, amount: amount && amount > 0 ? amount : null, at: new Date().toISOString() },
          ...(budget.limitLog ?? []),
        ].slice(0, 50);
        if (key === "__month__") {
          const from = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
          set({
            budget: {
              ...budget,
              monthLimit: amount && amount > 0 ? amount : null,
              monthLimitFrom: amount && amount > 0 ? budget.monthLimitFrom ?? from : null,
              limitLog: log,
            },
          });
          return;
        }
        const next = { ...(budget.catLimits ?? {}) };
        if (!amount || amount <= 0) delete next[key];
        else next[key] = amount;
        set({ budget: { ...budget, catLimits: next, limitLog: log } });
      },
      addRecurring: (input) =>
        set({
          budget: {
            ...get().budget,
            recurring: [{ ...input, id: crypto.randomUUID(), lastPosted: "" }, ...(get().budget.recurring ?? [])],
          },
        }),
      updateRecurring: (id, input) =>
        set({
          budget: {
            ...get().budget,
            recurring: (get().budget.recurring ?? []).map((r) => (r.id === id ? { ...r, ...input } : r)),
          },
        }),
      deleteRecurring: (id) =>
        set({
          budget: { ...get().budget, recurring: (get().budget.recurring ?? []).filter((r) => r.id !== id) },
        }),
      markRecurringPosted: (id, period) =>
        set({
          budget: {
            ...get().budget,
            recurring: (get().budget.recurring ?? []).map((r) => (r.id === id ? { ...r, lastPosted: period } : r)),
          },
        }),
      setAnniversaryDate: (iso) => set({ anniversaryDate: iso }),
      setGettingMarried: (on, date) => set({ gettingMarried: on, weddingDate: date ?? get().weddingDate }),
      addPerson: (input) =>
        set({
          people: [{ id: crypto.randomUUID(), ...input }, ...get().people],
        }),
      updatePerson: (id, input) =>
        set({
          people: get().people.map((p) => (p.id === id ? { ...p, ...input } : p)),
        }),
      deletePerson: (id) => set({ people: get().people.filter((p) => p.id !== id) }),
      openTask: (id, from) => {
        if (id) {
          set({ openTaskId: id, taskReturn: from ?? get().tab });
          return;
        }
        const back = get().taskReturn;
        set({
          openTaskId: null,
          taskReturn: null,
          ...(back ? { tab: back, moreOpen: null } : {}),
        });
      },
    }),
    {
      name: "my-pair-store",
      version: 2,
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<CoupleState> & { notes?: unknown };
        const notes = Array.isArray(raw.notes) && typeof raw.notes[0] === "string" ? [] : (raw.notes as CoupleState["notes"]) ?? [];
        const names = scrubStoredCouple(raw);
        return {
          ...current,
          ...raw,
          notes,
          noteFolders: raw.noteFolders ?? [],
          votes: raw.votes ?? [],
          capsules: raw.capsules ?? [],
          cards: raw.cards ?? [],
          chat: raw.chat ?? [],
          pairCode: raw.pairCode ?? null,
          seat: raw.seat === "b" ? "b" : "a",
          inviteCode: raw.inviteCode ?? null,
          deletedTaskIds: raw.deletedTaskIds ?? [],
          deletedWishIds: raw.deletedWishIds ?? [],
          myColor: raw.myColor === "blue" || raw.myColor === "pink" ? raw.myColor : null,
          partnerColor: raw.partnerColor === "blue" || raw.partnerColor === "pink" ? raw.partnerColor : null,
          myName: names.myName,
          partnerName: names.partnerName,
          anniversaryDate: names.anniversaryDate,
          pairedAt: raw.pairedAt ?? null,
          partnerBirthday: names.partnerBirthday,
          gameWins: raw.gameWins ?? { me: 0, partner: 0 },
          tttRecord: raw.tttRecord ?? { me: 0, partner: 0, games: 0 },
          tttNoted: raw.tttNoted ?? "",
          people: raw.people ?? [],
          gettingMarried: raw.gettingMarried ?? false,
          weddingDate: raw.weddingDate ?? "",
          budget: {
            currency: "USD",
            txs: [],
            categories: [],
            accounts: [],
            monthLimit: null,
            monthLimitFrom: null,
            catLimits: {},
            limitLog: [],
            recurring: [],
            alerts: [],
            ...(raw.budget ?? {}),
          },
          quiz: raw.quiz ?? { index: 0, myAnswers: [], partnerAnswers: [], consented: false },
          daily: raw.daily ?? {
            date: "",
            questionId: "real",
            skippedIds: [],
            history: [],
          },
        };
      },
    },
  ),
);

/** The two piece colors, identical on both phones. */
export function usePlayerColors() {
  const seat = useCouple((s) => s.seat);
  const joined = useCouple((s) => s.joined);
  const myChoice = useCouple((s) => s.myColor);
  const partnerChoice = useCouple((s) => s.partnerColor);
  return pairColors({
    mySeat: joined ? seat : null,
    myChoice,
    partnerChoice,
  });
}
