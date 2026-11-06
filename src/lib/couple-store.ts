import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  createdAt: string;
  fulfilled: boolean;
  fulfilledAt?: string;
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

type CoupleState = {
  pairCode: string | null;
  waiting: boolean;
  joined: boolean;
  myName: string;
  partnerName: string;
  tab: TabId;
  moreOpen: string | null;
  tasks: Task[];
  events: EventItem[];
  wishes: Wish[];
  wishFilter: WishOwner;
  lists: CheckList[];
  notes: Note[];
  noteFolders: NoteFolder[];
  openTaskId: string | null;
  taskReturn: TabId | null;
  createPair: () => void;
  joinPair: (code: string) => boolean;
  partnerArrived: () => void;
  leavePair: () => void;
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
  openTask: (id: string | null, from?: TabId) => void;
};

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const useCouple = create<CoupleState>()(
  persist(
    (set, get) => ({
      pairCode: null,
      waiting: false,
      joined: false,
      myName: "Кристианс",
      partnerName: "Алиночка",
      tab: "tasks",
      moreOpen: null,
      tasks: [],
      events: [],
      wishes: [],
      wishFilter: "partner",
      lists: [],
      notes: [],
      noteFolders: [],
      openTaskId: null,
      taskReturn: null,
      createPair: () => set({ pairCode: code(), waiting: true, joined: false }),
      joinPair: (raw) => {
        const value = raw.trim().toUpperCase();
        const current = get().pairCode;
        if (current && value === current) {
          set({ waiting: false, joined: true });
          return true;
        }
        if (!current && value.length >= 4) {
          set({ pairCode: value, waiting: false, joined: true });
          return true;
        }
        return false;
      },
      partnerArrived: () => set({ waiting: false, joined: true }),
      leavePair: () =>
        set({
          pairCode: null,
          waiting: false,
          joined: false,
          tab: "tasks",
          moreOpen: null,
          openTaskId: null,
          taskReturn: null,
        }),
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
              note: input.note ?? "",
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
                }
              : t,
          ),
        }),
      deleteTask: (id) => set({ tasks: get().tasks.filter((t) => t.id !== id) }),
      toggleTask: (id) =>
        set({
          tasks: get().tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        }),
      claimTask: (id, owner) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  owner,
                  claimedAt: owner === "free" ? undefined : new Date().toISOString(),
                  done: owner === "free" ? false : t.done,
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
            },
            ...get().wishes,
          ],
        }),
      updateWish: (id, input) =>
        set({
          wishes: get().wishes.map((w) => (w.id === id ? { ...w, ...input } : w)),
        }),
      deleteWish: (id) => set({ wishes: get().wishes.filter((w) => w.id !== id) }),
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
        return {
          ...current,
          ...raw,
          notes,
          noteFolders: raw.noteFolders ?? [],
        };
      },
    },
  ),
);
