import { useCouple, type Task, type Wish } from "@/lib/couple-store";
import { listPairTasks } from "@/lib/pair-tasks";
import { listPairWishes } from "@/lib/pair-wishes";
import { planRemoteSync, type SyncRow } from "@/lib/pair-sync";

const taskSeen = new Map<string, string>();
const wishSeen = new Map<string, string>();

export function taskSyncKey(task: Pick<Task, "updatedAt">) {
  return task.updatedAt ?? "";
}

export function wishSyncKey(wish: Pick<Wish, "updatedAt" | "photoPath" | "photo">) {
  const photo = wish.photo ?? "";
  return `${wish.updatedAt ?? ""}|${wish.photoPath ?? ""}|${photo.startsWith("data:") ? "data" : photo}`;
}

export function taskNeedsUpload(id: string, key: string) {
  return taskSeen.get(id) !== key;
}

export function markTaskSynced(id: string, key: string) {
  taskSeen.set(id, key);
}

export function wishNeedsUpload(id: string, key: string) {
  return wishSeen.get(id) !== key;
}

export function markWishSynced(id: string, key: string) {
  wishSeen.set(id, key);
}

export function resetSyncMarks() {
  taskSeen.clear();
  wishSeen.clear();
}

function signature(rows: SyncRow[]) {
  return rows
    .map((row) => `${row.id}\0${row.updatedAt ?? ""}`)
    .sort()
    .join("\n");
}

export async function refreshPairTasks() {
  const rows = await listPairTasks();
  const state = useCouple.getState();
  if (!state.joined || !state.myUserId || state.localOwnerId !== state.myUserId) return;
  const plan = planRemoteSync(
    state.tasks.filter((task) => !task.deleted),
    rows,
    state.deletedTaskIds,
  );
  for (const task of plan.mark) markTaskSynced(task.id, taskSyncKey(task));
  if (plan.forget.length) state.rememberDeletes(plan.forget, []);
  if (signature(state.tasks) !== signature(plan.next)) state.replaceTasks(plan.next);
}

export async function refreshPairWishes() {
  const rows = await listPairWishes();
  const state = useCouple.getState();
  if (!state.joined || !state.myUserId || state.localOwnerId !== state.myUserId) return;
  const plan = planRemoteSync(
    state.wishes.filter((wish) => !wish.deleted),
    rows,
    state.deletedWishIds,
  );
  for (const wish of plan.mark) markWishSynced(wish.id, wishSyncKey(wish));
  if (plan.forget.length) state.rememberDeletes([], plan.forget);
  if (signature(state.wishes) !== signature(plan.next)) state.replaceWishes(plan.next);
}
