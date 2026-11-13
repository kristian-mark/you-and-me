import { useCouple } from "@/lib/couple-store";
import { loadCoupleDaily, skipCoupleDaily, submitCoupleDaily } from "@/lib/daily-server";
import { presentDaily, shouldUploadLocalDaily, type DailySnapshot } from "@/lib/daily-sync";

export function applyDailySnapshot(view: DailySnapshot) {
  const local = useCouple.getState().daily;
  useCouple.getState().setDaily(
    presentDaily(view, {
      date: local.date,
      questionId: local.questionId,
      myAnswer: local.myAnswer,
      myAt: local.myAt,
      partnerAnswer: local.partnerAnswer,
      partnerAt: local.partnerAt,
      skippedIds: local.skippedIds ?? [],
      history: local.history ?? [],
    }),
  );
}

/** Load the shared question. This phone's own answer is uploaded once if the server has none. */
export async function refreshCoupleDaily() {
  const before = useCouple.getState();
  const view = await loadCoupleDaily();
  const state = useCouple.getState();
  if (state.localOwnerId !== before.localOwnerId || state.myUserId !== before.myUserId) {
    applyDailySnapshot(view);
    return view;
  }
  const daily = state.daily;
  const answeredDays = new Set<string>();
  if (view.myAnswer) answeredDays.add(view.dayKey);
  for (const item of view.history) {
    if (item.myAnswer) answeredDays.add(item.date);
  }
  const targetDay = daily.questionId === view.questionId ? view.dayKey : daily.date;
  if (
    shouldUploadLocalDaily({
      ownerId: state.localOwnerId,
      userId: state.myUserId,
      questionId: daily.questionId,
      dayKey: daily.date,
      myAnswer: daily.myAnswer,
      openQuestionId: view.questionId,
      openDayKey: view.dayKey,
      serverHasMine: answeredDays.has(targetDay),
    })
  ) {
    const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(daily.date) ? daily.date : null;
    const saved = await submitCoupleDaily({
      data: {
        body: daily.myAnswer?.trim() ?? "",
        answeredAt: daily.myAt ?? null,
        dayKey,
        questionId: dayKey ? daily.questionId : null,
      },
    });
    applyDailySnapshot(saved);
    return saved;
  }
  applyDailySnapshot(view);
  return view;
}

export async function skipSharedDaily() {
  const view = await skipCoupleDaily();
  applyDailySnapshot(view);
  return view;
}
