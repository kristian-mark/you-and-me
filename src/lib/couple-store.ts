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

export type QuizState = {
  index: number;
  myAnswers: number[];
  partnerAnswers: number[];
  myDoneAt?: string;
  partnerDoneAt?: string;
  remindedAt?: string;
  consented: boolean;
};

type CoupleState = {
  pairCode: string | null;
  waiting: boolean;
  joined: boolean;
  myName: string;
  partnerName: string;
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
  quiz: QuizState;
  openTaskId: string | null;
  taskReturn: TabId | null;
  createPair: () => void;
  joinPair: (code: string) => boolean;
  partnerArrived: () => void;
  leavePair: () => void;
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
      myBirthday: "",
      partnerBirthday: "2000-03-29",
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
      anniversaryDate: "2024-03-24",
      quiz: { index: 0, myAnswers: [], partnerAnswers: [], consented: false },
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
          votes: raw.votes ?? [],
          capsules: raw.capsules ?? [],
          quiz: raw.quiz ?? { index: 0, myAnswers: [], partnerAnswers: [], consented: false },
        };
      },
    },
  ),
);
