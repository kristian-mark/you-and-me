import { useCouple } from "@/lib/couple-store";
import { loadCoupleQuiz, submitCoupleQuiz } from "@/lib/quiz-server";
import { parseQuizAnswers, type QuizSnapshot } from "@/lib/quiz-sync";

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
  const local = useCouple.getState().quiz;
  const localDone = parseQuizAnswers(local.myAnswers);
  if (!view.myDoneAt && local.myDoneAt && localDone) {
    const saved = await submitCoupleQuiz({ data: localDone });
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
