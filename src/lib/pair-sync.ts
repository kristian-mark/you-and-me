export type SyncRow = {
  id: string;
  updatedAt?: string;
  deleted?: boolean;
};

export function isNewer(local?: string, remote?: string) {
  const left = local ? Date.parse(local) : Number.NaN;
  const right = remote ? Date.parse(remote) : Number.NaN;
  if (Number.isNaN(left)) return false;
  if (Number.isNaN(right)) return true;
  return left > right;
}

export function mergeSynced<T extends SyncRow>(local: T[], remote: T[], deletedIds: string[]) {
  const deleted = new Set(deletedIds);
  const remoteIds = new Set(remote.map((row) => row.id));
  const next: T[] = [];
  const upload: T[] = [];
  const retryDelete: string[] = [];
  const forget = new Set(deletedIds);

  for (const row of remote) {
    if (row.deleted) {
      forget.add(row.id);
      continue;
    }
    if (deleted.has(row.id)) {
      retryDelete.push(row.id);
      continue;
    }
    const mine = local.find((item) => item.id === row.id);
    if (mine && isNewer(mine.updatedAt, row.updatedAt)) {
      next.push(mine);
      upload.push(mine);
    } else {
      next.push(mine && !row.updatedAt && mine.updatedAt ? mine : row);
    }
  }

  for (const mine of local) {
    if (remoteIds.has(mine.id) || deleted.has(mine.id) || mine.deleted) continue;
    next.push(mine);
    upload.push(mine);
  }

  return { next, upload, retryDelete, forget: [...forget] };
}
