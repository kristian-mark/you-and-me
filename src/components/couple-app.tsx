import { useEffect, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  CalendarScreen,
  ListsScreen,
  MoreScreen,
  TasksScreen,
  WishesScreen,
} from "@/components/screens";
import { TabBar } from "@/components/ui/shell";
import { useCouple } from "@/lib/couple-store";
import { getMyPair, joinByInvite, leavePairRemote, saveMyProfile, type PairProfile } from "@/lib/pair-server";
import { listPairTasks, savePairTask } from "@/lib/pair-tasks";
import { listPairWishes, packWish, savePairWish } from "@/lib/pair-wishes";
import { compressPhotoData } from "@/lib/compress-photo";

export function CoupleApp() {
  return <PairGate />;
}

function PairGate() {
  const setMyName = useCouple((s) => s.setMyName);
  const setPartnerName = useCouple((s) => s.setPartnerName);
  const setPairUsers = useCouple((s) => s.setPairUsers);
  const partnerArrived = useCouple((s) => s.partnerArrived);
  const [profile, setProfile] = useState<PairProfile | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void getMyPair()
        .then((next) => {
          if (stop) return;
          setProfile(next);
          setError("");
          const mine = next.displayName;
          if (mine) setMyName(mine);
          if (next.partner?.displayName) setPartnerName(next.partner.displayName);
          setPairUsers(next.userId, next.partner?.userId ?? null);
          if (next.partner) partnerArrived();
        })
        .catch((err) => {
          if (stop) return;
          const raw = err instanceof Error ? err.message : "Облако не ответило";
          if (/unauthor/i.test(raw)) return;
          setError(raw);
        });
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [partnerArrived, setMyName, setPartnerName, setPairUsers, tick]);

  useEffect(() => {
    if (!profile?.partner) return;
    let stop = false;
    const pull = async () => {
      try {
        const rows = await listPairTasks();
        if (stop) return;
        const local = useCouple.getState().tasks;
        const map = new Map(rows.map((task) => [task.id, task]));
        for (const task of local) {
          if (!map.has(task.id)) {
            map.set(task.id, task);
            void savePairTask({ data: task }).catch(() => undefined);
          }
        }
        useCouple.getState().replaceTasks([...map.values()]);
      } catch {
        /* keep local */
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 2500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [profile?.partner, profile?.pairId]);

  useEffect(() => {
    if (!profile?.partner) return;
    let stop = false;
    const pull = async () => {
      try {
        const rows = await listPairWishes();
        if (stop) return;
        const local = useCouple.getState().wishes;
        const map = new Map(rows.map((wish) => [wish.id, wish]));
        for (const wish of local) {
          if (!map.has(wish.id)) {
            map.set(wish.id, wish);
            void savePairWish({ data: packWish(wish) }).catch(() => undefined);
          }
        }
        useCouple.getState().replaceWishes([...map.values()]);
      } catch {
        /* keep local */
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 2500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [profile?.partner, profile?.pairId]);

  if (!profile) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center text-muted">
        <div>
          <p>{error || "Собираем профиль…"}</p>
          {error ? (
            <button type="button" className="mt-4 text-cream" onClick={() => setTick((n) => n + 1)}>
              Ещё раз
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  if (!profile.partner) {
    return (
      <InviteScreen
        profile={profile}
        error={error}
        onJoin={async (code) => {
          setError("");
          try {
            const next = await joinByInvite({ data: code });
            setProfile(next);
            if (next.partner) partnerArrived();
          } catch (err) {
            setError(err instanceof Error && /unauthor/i.test(err.message) ? "Сессия слетела — войди снова" : err instanceof Error ? err.message : "Не вышло");
          }
        }}
      />
    );
  }

  return <AppShell />;
}

function InviteScreen({
  profile,
  error,
  onJoin,
}: {
  profile: PairProfile;
  error: string;
  onJoin: (code: string) => Promise<void>;
}) {
  const setMyBirthday = useCouple((s) => s.setMyBirthday);
  const [code, setCode] = useState("");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [pick, setPick] = useState(false);
  const pretty = birthday
    ? format(new Date(`${birthday}T12:00:00`), "d MMMM yyyy", { locale: ru })
    : "Выбрать дату";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-12 pb-10">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">Мы</h1>
      </div>
      <p className="mt-8 text-[12px] tracking-[0.16em] text-muted uppercase">твой код навсегда</p>
      <p className="mt-3 text-[40px] font-semibold tracking-[0.16em] text-pink">{profile.inviteCode}</p>
      <p className="mt-3 text-[15px] leading-6 text-muted">
        Партнёр входит в свой аккаунт и вводит этот код. В паре только двое.
      </p>
      <p className="mt-8 text-[13px] text-muted">День рождения</p>
      <button
        type="button"
        onClick={() => setPick(true)}
        className="mt-2 flex h-14 items-center justify-between rounded-[22px] bg-raised px-4 text-left"
      >
        <span className={birthday ? "text-[17px] capitalize" : "text-[17px] text-muted"}>{pretty}</span>
        <span className="text-muted">›</span>
      </button>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Код партнёра"
        className="mt-3 h-14 rounded-[22px] bg-raised px-4 text-[17px] outline-none placeholder:text-muted"
      />
      {error ? <p className="mt-3 text-sm text-[#e07a72]">{error}</p> : null}
      <button
        type="button"
        onClick={() => {
          if (birthday) setMyBirthday(birthday);
          if (birthday) void saveMyProfile({ data: { birthday } });
          void onJoin(code);
        }}
        className="mt-6 h-14 rounded-full bg-cream text-[17px] font-semibold text-cream-fg"
      >
        Соединиться
      </button>
      {pick ? <BirthdaySheet value={birthday} onPick={setBirthday} onClose={() => setPick(false)} /> : null}
    </main>
  );
}

function BirthdaySheet({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [cursor, setCursor] = useState(startOfMonth(initial));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/55" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-bg px-5 pt-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} className="grid size-10 place-items-center">
            <ChevronLeft className="size-5" />
          </button>
          <p className="capitalize">{format(cursor, "LLLL yyyy", { locale: ru })}</p>
          <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} className="grid size-10 place-items-center">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[12px] text-muted">
          {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const picked = key === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                className={`mx-auto grid size-10 place-items-center rounded-full text-[15px] ${
                  picked ? "bg-cream text-cream-fg" : isSameMonth(day, cursor) ? "text-fg" : "text-muted/35"
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full py-3 text-muted">
          Закрыть
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const tab = useCouple((s) => s.tab);
  const tasks = useCouple((s) => s.tasks);
  const wishes = useCouple((s) => s.wishes);
  const myUserId = useCouple((s) => s.myUserId);
  const partnerUserId = useCouple((s) => s.partnerUserId);
  const seen = useState(() => new Map<string, string>())[0];

  useEffect(() => {
    for (const task of tasks) {
      const withOwner = {
        ...task,
        ownerUserId: task.ownerUserId ?? (task.owner === "both" ? "both" : task.owner === "me" ? myUserId : task.owner === "partner" ? partnerUserId : null),
      };
      const key = JSON.stringify({
        t: withOwner.title,
        o: withOwner.ownerUserId,
        d: withOwner.done,
        n: withOwner.note,
        s: withOwner.subtasks,
      });
      if (seen.get(`t:${task.id}`) === key) continue;
      seen.set(`t:${task.id}`, key);
      void savePairTask({ data: withOwner }).catch(() => undefined);
    }
  }, [tasks, seen, myUserId, partnerUserId]);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      for (const wish of wishes) {
        if (stop) return;
        const withOwner = {
          ...wish,
          ownerUserId: wish.ownerUserId ?? (wish.owner === "me" ? myUserId : partnerUserId),
        };
        const photo = await compressPhotoData(withOwner.photo);
        const packed = packWish({ ...withOwner, photo });
        const key = JSON.stringify({
          t: packed.title,
          o: packed.ownerUserId,
          f: packed.fulfilled,
          p: packed.price,
          n: packed.note,
          l: packed.link,
          ph: packed.photo,
        });
        if (seen.get(`w:${wish.id}`) === key) continue;
        seen.set(`w:${wish.id}`, key);
        if (photo && photo !== wish.photo) {
          useCouple.getState().updateWish(wish.id, { photo });
        }
        await savePairWish({ data: packed }).catch(() => undefined);
      }
    };
    void run();
    return () => {
      stop = true;
    };
  }, [wishes, seen, myUserId, partnerUserId]);

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

export async function leaveCurrentPair() {
  await leavePairRemote();
}
