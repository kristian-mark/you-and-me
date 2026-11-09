import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BirthdayPicker } from "@/components/birthday-picker";
import {
  CalendarScreen,
  ListsScreen,
  MoreScreen,
  TasksScreen,
  WishesScreen,
} from "@/components/screens";
import { TabBar } from "@/components/ui/shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useCouple } from "@/lib/couple-store";
import { compressPhotoData } from "@/lib/compress-photo";
import {
  DEMO_ANNIVERSARY,
  FALLBACK_MY_NAME,
  FALLBACK_PARTNER_NAME,
  profileName,
  togetherDay,
} from "@/lib/pair-identity";
import {
  markTaskSynced,
  markWishSynced,
  resetSyncMarks,
  taskNeedsUpload,
  taskSyncKey,
  wishNeedsUpload,
  wishSyncKey,
} from "@/lib/pair-live";
import { getMyPair, joinByInvite, saveMyProfile, saveTogetherSince, type PairProfile } from "@/lib/pair-server";
import { savePairTask } from "@/lib/pair-tasks";
import { packWish, savePairWish } from "@/lib/pair-wishes";
import { refreshCoupleQuiz } from "@/lib/quiz-live";
import { PAIR_POLL_MS, PAIR_WAIT_POLL_MS, refreshScreen, useScreenPoll } from "@/lib/screen-poll";

export function CoupleApp() {
  return <PairGate />;
}

function PairGate() {
  const { user, isPending } = useCurrentUserState();
  const applyCoupleIdentity = useCouple((s) => s.applyCoupleIdentity);
  const setPairUsers = useCouple((s) => s.setPairUsers);
  const applyPairSession = useCouple((s) => s.applyPairSession);
  const partnerArrived = useCouple((s) => s.partnerArrived);
  const leavePair = useCouple((s) => s.leavePair);
  const [profile, setProfile] = useState<PairProfile | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const hadPair = useRef(false);
  const pushedAnniversary = useRef("");
  const pushedEmail = useRef("");

  // Names, birthdays, email, together_since, and who is in the pair can change.
  // Piece colors are fixed in the UI (you blue, partner pink) and are not stored.
  // A paired tab checks on open and every 4 hours. The invite screen stays fast.
  const waitingForPartner = Boolean(profile && !profile.partner);
  const canPollProfile = !needsLogin && !(authEnabled && isPending);

  useScreenPoll("pair", canPollProfile, waitingForPartner ? PAIR_WAIT_POLL_MS : PAIR_POLL_MS, async () => {
    try {
      const next = await getMyPair();
      if (useCouple.getState().claimAccount(next.userId) === "drop") resetSyncMarks();
      setProfile(next);
      setNeedsLogin(false);
      setError("");
      const mine = profileName(next.displayName, next.email ?? user?.primaryEmail ?? null, FALLBACK_MY_NAME);
      const partner = profileName(next.partner?.displayName, null, FALLBACK_PARTNER_NAME);
      const localAnniversary = useCouple.getState().anniversaryDate;
      applyCoupleIdentity({
        myName: mine,
        partnerName: partner,
        pairedAt: next.pairedAt,
        togetherSince: next.togetherSince,
      });
      if (
        useCouple.getState().localOwnerId === next.userId &&
        next.pairId &&
        !next.togetherSince &&
        localAnniversary &&
        localAnniversary !== DEMO_ANNIVERSARY &&
        togetherDay(localAnniversary, null) &&
        pushedAnniversary.current !== localAnniversary
      ) {
        pushedAnniversary.current = localAnniversary;
        void saveTogetherSince({ data: localAnniversary }).catch(() => undefined);
      }
      const email = user?.primaryEmail;
      if (!next.email && email && pushedEmail.current !== email) {
        pushedEmail.current = email;
        void saveMyProfile({ data: { email } }).catch(() => undefined);
      }
      setPairUsers(next.userId, next.partner?.userId ?? null);
      applyPairSession({
        pairId: next.pairId,
        seat: next.seat,
        inviteCode: next.inviteCode,
        myBirthday: next.birthday,
        partnerBirthday: next.partner?.birthday ?? null,
        myColor: next.color,
        partnerColor: next.partner?.color ?? null,
      });
      const storedPair = useCouple.getState().pairCode ?? "";
      const storedServerPair = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedPair);
      if (next.partner) {
        hadPair.current = true;
        partnerArrived();
      } else if (hadPair.current || storedServerPair) {
        hadPair.current = false;
        leavePair();
      }
      void refreshCoupleQuiz().catch(() => undefined);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Облако не ответило";
      if (/unauthor/i.test(raw)) {
        setNeedsLogin(true);
        if (authEnabled) void signOut("/login").catch(() => undefined);
        return;
      }
      setError(raw);
      throw err;
    }
  });

  if (authEnabled && isPending) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center text-muted">
        <p>Собираем профиль…</p>
      </main>
    );
  }
  if (needsLogin || (authEnabled && !user)) return <RedirectToSignIn />;

  if (!profile) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center text-muted">
        <div>
          <p>{error || "Собираем профиль…"}</p>
          {error ? (
            <button type="button" className="mt-4 text-cream" onClick={() => void refreshScreen("pair")}>
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
    <main className="app-frame safe-pad flex min-h-dvh flex-col px-5 pt-12 pb-10">
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
      {pick ? <BirthdayPicker value={birthday} onPick={setBirthday} onClose={() => setPick(false)} /> : null}
    </main>
  );
}

function AppShell() {
  const tab = useCouple((s) => s.tab);
  const tasks = useCouple((s) => s.tasks);
  const wishes = useCouple((s) => s.wishes);
  const myUserId = useCouple((s) => s.myUserId);
  const partnerUserId = useCouple((s) => s.partnerUserId);
  const localOwnerId = useCouple((s) => s.localOwnerId);
  useEffect(() => {
    if (!myUserId || localOwnerId !== myUserId) return;
    let stop = false;
    const run = async () => {
      for (const task of tasks) {
        const withOwner = {
          ...task,
          ownerUserId:
            task.ownerUserId ??
            (task.owner === "both" ? "both" : task.owner === "me" ? myUserId : task.owner === "partner" ? partnerUserId : null),
        };
        const key = taskSyncKey(withOwner);
        if (!taskNeedsUpload(task.id, key)) continue;
        markTaskSynced(task.id, key);
        const saved = await savePairTask({ data: withOwner }).catch(() => null);
        if (stop || !saved?.updatedAt || saved.updatedAt === key) continue;
        markTaskSynced(task.id, saved.updatedAt);
        useCouple.getState().replaceTaskMeta(task.id, { updatedAt: saved.updatedAt });
      }
    };
    void run();
    return () => {
      stop = true;
    };
  }, [tasks, myUserId, partnerUserId, localOwnerId]);

  useEffect(() => {
    if (!myUserId || localOwnerId !== myUserId) return;
    let stop = false;
    const run = async () => {
      for (const wish of wishes) {
        if (stop) return;
        const withOwner = {
          ...wish,
          ownerUserId: wish.ownerUserId ?? (wish.owner === "me" ? myUserId : partnerUserId),
        };
        const photo = withOwner.photo.startsWith("data:") ? await compressPhotoData(withOwner.photo) : withOwner.photo;
        const packed = packWish({ ...withOwner, photo });
        const key = wishSyncKey(packed);
        if (!wishNeedsUpload(wish.id, key)) continue;
        markWishSynced(wish.id, key);
        const saved = await savePairWish({ data: packed }).catch(() => null);
        if (stop || !saved) continue;
        const savedKey = wishSyncKey(saved);
        if (savedKey === key) continue;
        markWishSynced(wish.id, savedKey);
        useCouple.getState().replaceWishMeta(wish.id, {
          photo: saved.photo,
          photoPath: saved.photoPath,
          updatedAt: saved.updatedAt,
        });
      }
    };
    void run();
    return () => {
      stop = true;
    };
  }, [wishes, myUserId, partnerUserId, localOwnerId]);

  return (
    <main className="app-frame safe-pad flex min-h-dvh flex-col bg-bg">
      {tab === "tasks" ? <TasksScreen /> : null}
      {tab === "calendar" ? <CalendarScreen /> : null}
      {tab === "wishes" ? <WishesScreen /> : null}
      {tab === "lists" ? <ListsScreen /> : null}
      {tab === "more" ? <MoreScreen /> : null}
      <TabBar />
    </main>
  );
}
