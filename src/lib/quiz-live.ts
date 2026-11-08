import { shouldUploadLocalQuiz } from "@/lib/account-scope";
import { useCouple } from "@/lib/couple-store";
import { loadCoupleQuiz, submitCoupleQuiz } from "@/lib/quiz-server";
import { type QuizSnapshot } from "@/lib/quiz-sync";

export function applyQuizSnapshot(view: QuizSnapshot) {
  const local = useCouple.getState().quiz;
  const done = Boolean(view.myDoneAt);
  useCouple.getState().setQuiz({
    myAnswers: done ? view.myAnswers : local.myAnswers,
    myDoneAt: view.myDoneAt ?? undefined,
    partnerDoneAt: view.partnerDoneAt ?? undefined,
    partnerAnswers: view.partnerAnswers ?? [],
    remindedAt: view.myRemindedAt ?? undefined,
    partnerRemindedAt: view.partnerRemindedAt ?? undefined,
  });
}

/** Load the shared quiz. A finished local copy is uploaded once if the server has none. */
export async function refreshCoupleQuiz() {
  const view = await loadCoupleQuiz();
  const state = useCouple.getState();
  const local = state.quiz;
  if (
    shouldUploadLocalQuiz({
      ownerId: state.localOwnerId,
      userId: state.myUserId,
      localDoneAt: local.myDoneAt,
      localAnswers: local.myAnswers,
      serverHasDone: Boolean(view.myDoneAt),
    })
  ) {
    const saved = await submitCoupleQuiz({ data: local.myAnswers });
    applyQuizSnapshot(saved);
    return saved;
  }
  applyQuizSnapshot(view);
  return view;
}

export function openCompatibilityQuiz() {
  const store = useCouple.getState();
  store.setTab("more");
  store.setMore("test");
}
