import type { ActivityItem } from "@/lib/activity-model";
import { useCouple } from "@/lib/couple-store";

/** Open the section, and the row when the screen already knows how to focus one. */
export function openActivity(item: ActivityItem) {
  const store = useCouple.getState();
  store.setChatTarget(null);
  useCouple.setState({ openTaskId: null, taskReturn: null });
  if (item.section === "chat") {
    store.setTab("more");
    store.setMore("chat");
    return;
  }
  if (item.section === "album") {
    store.setTab("more");
    store.setMore("album");
    return;
  }
  if (item.section === "question") {
    store.setTab("more");
    store.setMore("question");
    return;
  }
  if (item.section === "test") {
    store.setTab("more");
    store.setMore("test");
    return;
  }
  if (item.section === "wishes") {
    store.setTab("wishes");
    if (item.action !== "deleted") store.setChatTarget({ kind: "wish", id: item.targetId });
    return;
  }
  if (item.section === "calendar") {
    store.setTab("calendar");
    if (item.date) store.setChatTarget({ kind: "event", id: item.targetId, date: item.date });
    return;
  }
  store.setTab("tasks");
  if (item.action !== "deleted") store.openTask(item.targetId, "tasks");
}
