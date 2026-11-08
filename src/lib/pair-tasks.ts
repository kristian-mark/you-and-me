import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Task } from "@/lib/couple-store";
import { myPairId, stillInPair } from "@/lib/pair-access";
import { assertSafeId, eqFilter, sbDelete, sbInsert, sbPatch, sbSelect } from "@/lib/supabase-app";

type Payload = Partial<Task> & { deleted?: boolean };

type Row = {
  id: string;
  pair_id: string;
  owner_user_id: string | null;
  title: string;
  done: boolean;
  payload: Payload | string | null;
  updated_at?: string;
};

function payloadOf(row: Row): Payload {
  if (!row.payload) return {};
  if (typeof row.payload === "string") {
    try {
      return JSON.parse(row.payload) as Payload;
    } catch {
      return {};
    }
  }
  return row.payload;
}

function parseTask(row: Row): Task {
  const extra = payloadOf(row);
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
    createdAt: extra.createdAt ?? row.updated_at ?? new Date().toISOString(),
    claimedAt: extra.claimedAt,
    assignedBy: "me",
    createdBy: extra.createdBy ?? null,
    updatedAt: row.updated_at,
    deleted: Boolean(extra.deleted),
  };
}

async function rowById(id: string) {
  const rows = await sbSelect<Row>("app_tasks", `${eqFilter("id", id)}&select=*`);
  return rows[0] ?? null;
}

function taskBody(pairId: string, task: Task, deleted: boolean) {
  return {
    owner_user_id: task.ownerUserId ?? null,
    title: task.title || "Задача",
    done: deleted ? true : task.done,
    payload: {
      owner: task.owner,
      subtasks: task.subtasks ?? [],
      note: task.note ?? "",
      dueDate: task.dueDate ?? null,
      repeat: task.repeat ?? "none",
      showInCalendar: Boolean(task.showInCalendar),
      createdAt: task.createdAt,
      claimedAt: task.claimedAt ?? null,
      createdBy: task.createdBy ?? null,
      deleted,
    },
    updated_at: new Date().toISOString(),
  };
}

async function writeTask(userId: string, pairId: string, task: Task, deleted: boolean) {
  const id = assertSafeId(task.id);
  const existing = await rowById(id);
  if (existing && existing.pair_id !== pairId) throw new Error("Чужая задача");
  const body = taskBody(pairId, { ...task, id }, deleted);
  if (!existing) {
    try {
      await sbInsert("app_tasks", { id, pair_id: pairId, ...body });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
      const again = await rowById(id);
      if (!again || again.pair_id !== pairId) throw new Error("Чужая задача");
      await sbPatch("app_tasks", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`, body);
    }
  } else {
    await sbPatch("app_tasks", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`, body);
  }
  if (!(await stillInPair(userId, pairId))) {
    await sbDelete("app_tasks", `${eqFilter("id", id)}&${eqFilter("pair_id", pairId)}`);
    return { ...task, id, deleted, updatedAt: body.updated_at };
  }
  const saved = await rowById(id);
  return saved ? parseTask(saved) : { ...task, id, deleted, updatedAt: body.updated_at };
}

export const listPairTasks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Task[]> => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return [];
    const rows = await sbSelect<Row>("app_tasks", `${eqFilter("pair_id", pairId)}&select=*&order=updated_at.desc`);
    return rows.map(parseTask);
  });

export const savePairTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((task: Task) => task)
  .handler(async ({ context, data: task }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return task;
    return writeTask(context.userId, pairId, task, false);
  });

export const deletePairTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => assertSafeId(id))
  .handler(async ({ context, data: id }) => {
    const pairId = await myPairId(context.userId);
    if (!pairId) return;
    const existing = await rowById(id);
    if (!existing || payloadOf(existing).deleted) return;
    if (existing.pair_id !== pairId) throw new Error("Чужая задача");
    await writeTask(context.userId, pairId, parseTask(existing), true);
  });
