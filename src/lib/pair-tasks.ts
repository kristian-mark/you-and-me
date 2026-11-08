import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Task } from "@/lib/couple-store";
import { sbDelete, sbSelect, sbUpsert } from "@/lib/supabase-app";

type Row = {
  id: string;
  pair_id: string;
  owner_user_id: string | null;
  title: string;
  done: boolean;
  payload: Record<string, unknown> | string;
};

function parseTask(row: Row): Task {
  const extra = (typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : row.payload ?? {}) as Partial<Task>;
  return {
    id: row.id,
    title: row.title,
    owner: extra.owner ?? "free",
    ownerUserId: row.owner_user_id,
    done: row.done,
    subtasks: extra.subtasks ?? [],
    note: extra.note ?? "",
    dueDate: extra.dueDate,
    repeat: extra.repeat ?? "none",
    showInCalendar: Boolean(extra.showInCalendar),
    createdAt: extra.createdAt ?? new Date().toISOString(),
    claimedAt: extra.claimedAt,
    assignedBy: "me",
  };
}

async function myPairId(userId: string) {
  const row = (await sbSelect<{ pair_id: string | null }>("app_profiles", `user_id=eq.${encodeURIComponent(userId)}&select=pair_id`))[0];
  return row?.pair_id ?? null;
}

export const listPairTasks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Task[]> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return [];
    const rows = await sbSelect<Row>("app_tasks", `pair_id=eq.${pairId}&select=*&order=updated_at.desc`);
    return rows.map(parseTask);
  });

export const savePairTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((task: Task) => task)
  .handler(async ({ context, data: task }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return task;
    await sbUpsert("app_tasks", {
      id: task.id,
      pair_id: pairId,
      owner_user_id: task.ownerUserId ?? null,
      title: task.title,
      done: task.done,
      payload: {
        owner: task.owner,
        subtasks: task.subtasks,
        note: task.note,
        dueDate: task.dueDate,
        repeat: task.repeat,
        showInCalendar: task.showInCalendar,
        createdAt: task.createdAt,
        claimedAt: task.claimedAt,
      },
      updated_at: new Date().toISOString(),
    });
    return task;
  });

export const deletePairTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return;
    await sbDelete("app_tasks", `id=eq.${id}&pair_id=eq.${pairId}`);
  });
