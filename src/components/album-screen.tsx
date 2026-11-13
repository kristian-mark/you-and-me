import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  CloudUpload,
  Download,
  Heart,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { prepareAlbumUpload, saveAlbumPhoto, uploadPrepared } from "@/lib/album-image";
import {
  albumAfterRemoval,
  albumSpan,
  formatBytes,
  groupByMonth,
  mergeFreshUrls,
  photoCountLabel,
  URL_REFRESH_MS,
  usedRatio,
  viewerStamp,
} from "@/lib/album-model";
import {
  createAlbum,
  deleteAlbum,
  deleteAlbumPhotos,
  editAlbumPhotos,
  erasePhotos,
  getAlbumHome,
  getAlbumTrash,
  likeAlbumPhoto,
  openAlbumPhoto,
  restorePhotos,
  signAlbumPhotos,
  updateAlbum,
  type AlbumHome,
  type AlbumPhoto,
  type TrashPhoto,
} from "@/lib/album-server";
import { SheetHeader } from "@/components/sheet-header";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { pieceBg, pieceText } from "@/lib/pair-color";
import { LIST_POLL_MS, refreshScreen, useScreenPoll } from "@/lib/screen-poll";

type Page = "home" | "all" | "album" | "space" | "trash" | "new" | "cover" | "library" | "assign";
type UploadState = { done: number; total: number; fraction: number } | null;

export function AlbumScreen({ onBack }: { onBack: () => void }) {
  const myUserId = useCouple((s) => s.myUserId);
  const myName = useCouple((s) => s.myName);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const [home, setHome] = useState<AlbumHome | null>(null);
  const [trash, setTrash] = useState<TrashPhoto[] | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<{ ids: string[]; index: number } | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [upload, setUpload] = useState<UploadState>(null);
  const [draft, setDraft] = useState({
    title: "",
    photoIds: [] as string[],
    coverId: null as string | null,
  });
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<"all" | "album" | "new">("all");
  const pageRef = useRef(page);
  const epoch = useRef(0);
  pageRef.current = page;

  useScreenPoll("album", true, LIST_POLL_MS, async () => {
    const ticket = ++epoch.current;
    const next = await getAlbumHome();
    if (ticket !== epoch.current) return;
    setHome((prev) =>
      prev ? { ...next, photos: mergeFreshUrls(prev.photos, next.photos, Date.now()) } : next,
    );
    setError("");
    if (pageRef.current === "trash") setTrash(await getAlbumTrash());
  });

  const album = home?.albums.find((item) => item.id === albumId) ?? null;
  const photos = home?.photos ?? [];

  useEffect(() => {
    if (!home) return;
    const ids =
      page === "all"
        ? home.photos.map((photo) => photo.id)
        : page === "album" && album
          ? album.photoIds
          : page === "home"
            ? home.photos.slice(0, 16).map((photo) => photo.id)
            : [];
    if (ids.length) void ensureThumbs(home, ids, setHome).catch(() => undefined);
    // Re-run when the open set changes, not on every signed-url refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, albumId, home?.photos.length, home?.albums.length]);

  function openFiles(target: "all" | "album" | "new", camera = false) {
    targetRef.current = target;
    const input = camera ? cameraRef.current : fileRef.current;
    input?.click();
  }

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (!files.length) return;
    setError("");
    setUpload({ done: 0, total: files.length, fraction: 0 });
    for (let index = 0; index < files.length; index += 1) {
      try {
        const prepared = await prepareAlbumUpload(files[index]);
        const photo = await uploadPrepared(prepared, (fraction) => {
          setUpload({ done: index, total: files.length, fraction });
        });
        rememberPhoto(setHome, photo);
        if (targetRef.current === "new") {
          setDraft((current) => ({
            ...current,
            photoIds: current.photoIds.includes(photo.id)
              ? current.photoIds
              : [...current.photoIds, photo.id],
            coverId: current.coverId ?? photo.id,
          }));
        } else if (targetRef.current === "album" && albumId) {
          await editAlbumPhotos({ data: { albumId, add: [photo.id] } });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Фото не сохранилось");
      }
      setUpload({ done: index + 1, total: files.length, fraction: 1 });
    }
    setUpload(null);
    void refreshScreen("album");
  }

  function openViewer(ids: string[], id: string) {
    const index = Math.max(0, ids.indexOf(id));
    setViewer({ ids, index });
  }

  function goHome() {
    setPage("home");
    setAlbumId(null);
    setPicked(null);
    setMenu(false);
    setConfirmDelete(false);
  }

  const inputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(event) => void onFiles(event.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void onFiles(event.target.files)}
      />
    </>
  );

  let body: ReactNode = <p className="px-5 pt-16 text-muted">{error || "Собираем альбом…"}</p>;

  if (home && page === "home") {
    body = (
      <AlbumHomePage
        home={home}
        onBack={onBack}
        onAll={() => {
          setPicked(null);
          setPage("all");
        }}
        onAlbum={(id) => {
          setAlbumId(id);
          setPicked(null);
          setPage("album");
        }}
        onSpace={() => setPage("space")}
        onUpload={() => openFiles("all")}
        onCamera={() => openFiles("all", true)}
        onNew={() => {
          setAlbumId(null);
          setDraft({ title: "", photoIds: [], coverId: null });
          setPage("new");
        }}
        onOpen={(id) =>
          openViewer(
            photos.map((photo) => photo.id),
            id,
          )
        }
      />
    );
  }

  if (home && page === "all") {
    body = (
      <PhotoGroups
        title="Все фото"
        back="Альбом"
        photos={photos}
        picked={picked}
        onBack={goHome}
        onOpen={(id) =>
          picked
            ? toggle(setPicked, id)
            : openViewer(
                photos.map((photo) => photo.id),
                id,
              )
        }
        onChoose={() => setPicked(picked ? null : [])}
        onAdd={() => openFiles("all")}
        extra={
          picked ? (
            <ChooseBar
              count={picked.length}
              primary="Удалить"
              onPrimary={() =>
                void run(async () => {
                  await deleteAlbumPhotos({ data: picked });
                  setPicked(null);
                })
              }
            />
          ) : null
        }
      />
    );
  }

  if (home && page === "album" && album) {
    const albumPhotos = album.photoIds
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is AlbumPhoto => Boolean(photo))
      .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
    const cover = photos.find((photo) => photo.id === album.coverPhotoId) ?? albumPhotos[0];
    body = (
      <section className={picked ? "pb-52" : "pb-28"}>
        <div className="relative h-64 overflow-hidden bg-raised">
          {cover?.thumbUrl ? (
            <img src={cover.thumbUrl} alt="" className="size-full object-cover" />
          ) : (
            <Stripes />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-bg" />
          <button
            type="button"
            onClick={goHome}
            className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-black/45"
            aria-label="Назад"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu((open) => !open);
              setRename(album.title);
            }}
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-black/45"
            aria-label="Ещё"
          >
            <MoreHorizontal className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-4 px-5">
            <h1 className="truncate text-[34px] font-semibold tracking-tight">{album.title}</h1>
            <p className="mt-1 text-[15px] text-white/80">
              {photoCountLabel(albumPhotos.length)}
              {albumPhotos.length
                ? ` · ${albumSpan(albumPhotos.map((photo) => photo.takenAt))}`
                : ""}
            </p>
          </div>
        </div>
        {menu ? (
          <div className="mx-4 mt-3 overflow-hidden rounded-2xl bg-raised">
            <label className="block px-4 py-3">
              <span className="text-[12px] tracking-wide text-muted uppercase">Название</span>
              <input
                value={rename}
                onChange={(event) => setRename(event.target.value)}
                className="mt-1 w-full bg-transparent text-[17px] outline-none"
              />
            </label>
            <MenuButton
              label="Сохранить имя"
              onClick={() =>
                void run(async () => {
                  await updateAlbum({ data: { id: album.id, title: rename } });
                  setMenu(false);
                })
              }
            />
            <MenuButton
              label="Сменить обложку"
              onClick={() => {
                setMenu(false);
                setPage("cover");
              }}
            />
            <MenuButton label="Удалить альбом" danger onClick={() => setConfirmDelete(true)} />
          </div>
        ) : null}
        {confirmDelete ? (
          <div className="mx-4 mt-3 rounded-2xl bg-raised p-4">
            <p className="text-[15px]">Альбом удалится. Фото останутся во «Всех фото».</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="min-h-11 flex-1 rounded-full bg-chip"
                onClick={() => setConfirmDelete(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="min-h-11 flex-1 rounded-full bg-cream font-semibold text-cream-fg"
                onClick={() =>
                  void run(async () => {
                    await deleteAlbum({ data: album.id });
                    goHome();
                  })
                }
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex gap-2 px-4">
          <button
            type="button"
            onClick={() => setAddMenu((open) => !open)}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-cream font-semibold text-cream-fg"
          >
            <Plus className="size-4" /> Добавить
          </button>
          <button
            type="button"
            onClick={() => setPicked(picked ? null : [])}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-raised font-semibold"
          >
            <Check className="size-4" /> {picked ? "Готово" : "Выбрать"}
          </button>
        </div>
        {addMenu ? (
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-raised"
              onClick={() => {
                setAddMenu(false);
                openFiles("album");
              }}
            >
              Загрузить
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full bg-raised"
              onClick={() => {
                setAddMenu(false);
                setLibraryIds(album.photoIds);
                setPage("library");
              }}
            >
              Из всех фото
            </button>
          </div>
        ) : null}
        <MonthList
          photos={albumPhotos}
          picked={picked}
          onOpen={(id) =>
            picked
              ? toggle(setPicked, id)
              : openViewer(
                  albumPhotos.map((photo) => photo.id),
                  id,
                )
          }
        />
        {picked ? (
          <ChooseBar
            count={picked.length}
            primary="Удалить"
            secondary="Убрать из альбома"
            onPrimary={() =>
              void run(async () => {
                await deleteAlbumPhotos({ data: picked });
                setPicked(null);
              })
            }
            onSecondary={() => {
              const ids = picked;
              setHome((prev) => (prev ? dropFromAlbum(prev, album.id, ids) : prev));
              setPicked(null);
              void run(async () => {
                await editAlbumPhotos({ data: { albumId: album.id, remove: ids } });
              });
            }}
          />
        ) : null}
      </section>
    );
  }

  if (home && page === "space") {
    body = (
      <SpacePage home={home} onBack={() => setPage("home")} onTrash={() => void openTrash()} />
    );
  }

  if (home && page === "trash") {
    body = (
      <section className={picked ? "px-4 pt-5 pb-52" : "px-4 pt-5 pb-28"}>
        <Back label="Место" onClick={() => setPage("space")} />
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-[32px] font-semibold tracking-tight">Недавно удалённые</h1>
          <button
            type="button"
            className="shrink-0 text-[16px] font-semibold text-blue"
            onClick={() => setPicked(picked ? null : [])}
          >
            {picked ? "Готово" : "Выбрать"}
          </button>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-muted">
          Любой из вас может вернуть фото в течение 30 дней, потом оно удалится навсегда. Место не
          считается.
        </p>
        <div className="mt-6">
          {(trash ?? []).length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {(trash ?? []).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => (picked ? toggle(setPicked, photo.id) : undefined)}
                  className="relative aspect-square overflow-hidden bg-raised"
                >
                  {photo.thumbUrl ? (
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      className="size-full object-cover opacity-80"
                    />
                  ) : null}
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[12px]">
                    {photo.daysLeft} д
                  </span>
                  {picked ? <SelectDot on={picked.includes(photo.id)} /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted">Пусто</p>
          )}
        </div>
        {picked ? (
          <ChooseBar
            count={picked.length}
            primary="Удалить навсегда"
            secondary="Вернуть"
            onPrimary={() =>
              void run(async () => {
                await erasePhotos({ data: picked });
                setPicked(null);
                setTrash(await getAlbumTrash());
              })
            }
            onSecondary={() =>
              void run(async () => {
                await restorePhotos({ data: picked });
                setPicked(null);
                setTrash(await getAlbumTrash());
              })
            }
          />
        ) : null}
      </section>
    );
  }

  if (home && page === "new") {
    const cover = photos.find((photo) => photo.id === draft.coverId);
    body = (
      <section className="px-4 pt-4 pb-16">
        <SheetHeader
          flush
          pad={false}
          title="Новый альбом"
          onCancel={goHome}
          doneDisabled={!draft.title.trim()}
          onDone={() =>
            void run(async () => {
              await createAlbum({
                data: {
                  title: draft.title,
                  photoIds: draft.photoIds,
                  coverPhotoId: draft.coverId,
                },
              });
              goHome();
            })
          }
        />
        <label className="mt-5 block rounded-2xl bg-raised px-4 py-3">
          <span className="text-[11px] tracking-[0.14em] text-muted uppercase">Название</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Название"
            className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
          />
        </label>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-raised p-3">
          <div className="relative size-20 overflow-hidden rounded-xl bg-chip">
            {cover?.thumbUrl ? (
              <img src={cover.thumbUrl} alt="" className="size-full object-cover" />
            ) : (
              <Stripes />
            )}
            <span className="absolute bottom-1 left-1 text-[10px] tracking-wide text-white/80">
              ОБЛОЖКА
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px]">Первое фото альбома</p>
            <p className="text-[14px] text-muted">по умолчанию</p>
            <button
              type="button"
              onClick={() => setPage("cover")}
              className="mt-2 rounded-full bg-chip px-4 py-1.5 text-[14px]"
            >
              Сменить
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setLibraryIds(draft.photoIds);
              setPage("library");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-raised px-3 text-[15px]"
          >
            <ImagePlus className="size-4 shrink-0" /> Из «Всех фото»
          </button>
          <button
            type="button"
            onClick={() => openFiles("new")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-raised px-3 text-[15px]"
          >
            <CloudUpload className="size-4 shrink-0" /> Загрузить
          </button>
        </div>
        <p className="mt-4 text-[14px] leading-snug text-muted">
          Имя, обложку и фото потом может поменять любой из вас
        </p>
      </section>
    );
  }

  if (home && page === "cover") {
    const pool = album ? photos.filter((photo) => album.photoIds.includes(photo.id)) : photos;
    const current = album ? album.coverPhotoId : draft.coverId;
    body = (
      <section className="px-4 pt-4 pb-10">
        <SheetHeader
          flush
          pad={false}
          title="Обложка"
          onCancel={() => setPage(album ? "album" : "new")}
        />
        <div className="mt-4 grid grid-cols-3 gap-0.5">
          {pool.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className={`relative aspect-square overflow-hidden bg-raised ${photo.id === current ? "ring-2 ring-blue" : ""}`}
              onClick={() =>
                void run(async () => {
                  if (album) {
                    await updateAlbum({ data: { id: album.id, coverPhotoId: photo.id } });
                    setPage("album");
                  } else {
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      coverId: photo.id,
                      photoIds: currentDraft.photoIds.includes(photo.id)
                        ? currentDraft.photoIds
                        : [...currentDraft.photoIds, photo.id],
                    }));
                    setPage("new");
                  }
                })
              }
            >
              {photo.thumbUrl ? (
                <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
              ) : (
                <Stripes />
              )}
              <span
                className={`absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border ${
                  photo.id === current
                    ? "border-blue bg-blue text-bg"
                    : "border-white/80 bg-black/30"
                }`}
              >
                {photo.id === current ? <Check className="size-3.5" /> : null}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (home && page === "assign" && assignId) {
    const photo = photos.find((item) => item.id === assignId);
    body = (
      <section className="px-4 pt-5 pb-16">
        <Back label="Фото" onClick={() => setPage("home")} />
        <h1 className="mt-3 text-[32px] font-semibold">В альбом</h1>
        <div className="mt-4 overflow-hidden rounded-[24px] bg-raised">
          {home.albums.map((item, index) => {
            const on = Boolean(photo?.albumIds.includes(item.id));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  void run(async () => {
                    await editAlbumPhotos({
                      data: {
                        albumId: item.id,
                        add: on ? [] : [assignId],
                        remove: on ? [assignId] : [],
                      },
                    });
                    setHome((prev) =>
                      prev
                        ? {
                            ...prev,
                            photos: prev.photos.map((row) =>
                              row.id === assignId
                                ? {
                                    ...row,
                                    albumIds: on
                                      ? row.albumIds.filter((id) => id !== item.id)
                                      : [...row.albumIds, item.id],
                                  }
                                : row,
                            ),
                            albums: prev.albums.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    photoIds: on
                                      ? row.photoIds.filter((id) => id !== assignId)
                                      : [...row.photoIds, assignId],
                                    coverPhotoId: row.coverPhotoId ?? assignId,
                                  }
                                : row,
                            ),
                          }
                        : prev,
                    );
                  })
                }
                className={`flex min-h-14 w-full items-center justify-between px-4 text-left ${index ? "border-t border-line" : ""}`}
              >
                <span className="truncate">{item.title}</span>
                {on ? <Check className="size-5 text-blue" /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setAlbumId(null);
            setDraft({ title: "", photoIds: [assignId], coverId: assignId });
            setPage("new");
          }}
          className="mt-3 min-h-12 w-full rounded-full bg-raised"
        >
          Новый альбом
        </button>
      </section>
    );
  }

  if (home && page === "library") {
    body = (
      <section className="px-4 pt-4 pb-28">
        <SheetHeader
          flush
          pad={false}
          title="Все фото"
          onCancel={() => setPage(album ? "album" : "new")}
          onDone={() =>
            void run(async () => {
              if (album) {
                const have = new Set(album.photoIds);
                const next = new Set(libraryIds);
                const add = [...next].filter((id) => !have.has(id));
                const remove = [...have].filter((id) => !next.has(id));
                if (add.length || remove.length) {
                  await editAlbumPhotos({ data: { albumId: album.id, add, remove } });
                }
                setPage("album");
              } else {
                setDraft((current) => ({
                  ...current,
                  photoIds: libraryIds,
                  coverId:
                    current.coverId && libraryIds.includes(current.coverId)
                      ? current.coverId
                      : (libraryIds[0] ?? null),
                }));
                setPage("new");
              }
            })
          }
        />
        <div className="mt-4 grid grid-cols-3 gap-0.5">
          {photos.map((photo) => {
            const on = libraryIds.includes(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                className="relative aspect-square overflow-hidden bg-raised"
                onClick={() =>
                  setLibraryIds((ids) =>
                    on ? ids.filter((id) => id !== photo.id) : [...ids, photo.id],
                  )
                }
              >
                {photo.thumbUrl ? (
                  <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Stripes />
                )}
                <SelectDot on={on} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  async function openTrash() {
    setPicked(null);
    setPage("trash");
    try {
      setTrash(await getAlbumTrash());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вышло");
    }
  }

  async function run(action: () => Promise<unknown>) {
    ++epoch.current;
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вышло");
    }
    const ticket = ++epoch.current;
    try {
      const next = await getAlbumHome();
      if (ticket !== epoch.current) return;
      setHome((prev) =>
        prev ? { ...next, photos: mergeFreshUrls(prev.photos, next.photos, Date.now()) } : next,
      );
      if (pageRef.current === "trash") setTrash(await getAlbumTrash());
    } catch (err) {
      if (ticket === epoch.current) setError(err instanceof Error ? err.message : "Не вышло");
    }
  }

  const current = viewer ? photos.find((photo) => photo.id === viewer.ids[viewer.index]) : null;

  return (
    <section className="min-w-0 overflow-x-hidden">
      {inputs}
      {error ? <ErrorToast message={error} onClose={() => setError("")} /> : null}
      {body}
      {upload ? (
        <UploadToast done={upload.done} total={upload.total} fraction={upload.fraction} />
      ) : null}
      {viewer && current ? (
        <Viewer
          photo={current}
          index={viewer.index}
          total={viewer.ids.length}
          name={current.authorUserId === myUserId ? myName : partnerName}
          color={current.authorUserId === myUserId ? colors.me : colors.partner}
          onClose={() => setViewer(null)}
          onStep={(delta) =>
            setViewer((currentViewer) => {
              if (!currentViewer) return currentViewer;
              const index = currentViewer.index + delta;
              if (index < 0 || index >= currentViewer.ids.length) return currentViewer;
              return { ...currentViewer, index };
            })
          }
          onLike={() =>
            void run(async () => {
              const liked = !current.likedByMe;
              await likeAlbumPhoto({ data: { id: current.id, liked } });
              setHome((prev) =>
                prev
                  ? {
                      ...prev,
                      photos: prev.photos.map((photo) =>
                        photo.id === current.id ? { ...photo, likedByMe: liked } : photo,
                      ),
                    }
                  : prev,
              );
            })
          }
          onSave={() =>
            void run(async () => {
              const file = await openAlbumPhoto({ data: { id: current.id } });
              await saveAlbumPhoto(file.url);
            })
          }
          onAlbum={() => {
            setAssignId(current.id);
            setViewer(null);
            setPage("assign");
          }}
          onDelete={() =>
            void run(async () => {
              await deleteAlbumPhotos({ data: [current.id] });
              setViewer(null);
            })
          }
        />
      ) : null}
    </section>
  );
}

function AlbumHomePage({
  home,
  onBack,
  onAll,
  onAlbum,
  onSpace,
  onUpload,
  onCamera,
  onNew,
  onOpen,
}: {
  home: AlbumHome;
  onBack: () => void;
  onAll: () => void;
  onAlbum: (id: string) => void;
  onSpace: () => void;
  onUpload: () => void;
  onCamera: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const recent = home.photos.slice(0, 12);
  if (!home.photos.length && !home.albums.length) {
    return (
      <section className="flex min-h-[70dvh] flex-col px-4 pt-5">
        <Back label="Ещё" onClick={onBack} />
        <h1 className="mt-3 text-[34px] font-semibold tracking-tight">Альбом</h1>
        <div className="flex flex-1 flex-col items-center justify-center px-2 pb-16 text-center">
          <EmptyStack />
          <h2 className="mt-8 text-[26px] leading-tight font-semibold">Фото будут жить здесь</h2>
          <p className="mt-3 max-w-[320px] text-[16px] leading-snug text-muted">
            Одно место на двоих: что загрузит один, второй увидит сразу. Альбомы для поездок и «в
            этот день» через год.
          </p>
          <button
            type="button"
            onClick={onUpload}
            className="mt-7 flex min-h-14 w-full max-w-[340px] items-center justify-center gap-2 rounded-full bg-cream text-[17px] font-semibold text-cream-fg"
          >
            <Plus className="size-5" /> Добавить фото
          </button>
          <button type="button" onClick={onCamera} className="mt-4 min-h-11 text-[15px] text-muted">
            или снять на камеру
          </button>
        </div>
        <button type="button" onClick={onSpace} className="pb-8 text-center text-[13px] text-muted">
          {formatBytes(home.quota.limit)} на пару
        </button>
      </section>
    );
  }
  return (
    <section className="px-4 pt-5 pb-28">
      <Back label="Ещё" onClick={onBack} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[32px] font-semibold tracking-tight sm:text-[34px]">Альбом</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSpace}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-raised px-2.5 py-2 text-[12px]"
          >
            <span className="size-3.5 shrink-0 rounded-full border border-muted" />
            <span className="truncate">
              {formatBytes(home.quota.used)} / {formatBytes(home.quota.limit)}
            </span>
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-raised"
            aria-label="Добавить фото"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold">Все фото</h2>
        <button type="button" onClick={onAll} className="text-[15px] text-muted">
          {home.quota.photoCount} ›
        </button>
      </div>
      <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1">
        {recent.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className="size-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-raised"
          >
            {photo.thumbUrl ? (
              <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold">Альбомы</h2>
        <span className="text-[15px] text-muted">все {home.albums.length} ›</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={onNew} className="text-left">
          <span className="grid aspect-[1.15] w-full place-items-center rounded-2xl border border-dashed border-white/20">
            <Plus className="size-6 text-muted" />
          </span>
          <span className="mt-2 block text-[15px]">Новый альбом</span>
        </button>
        {home.albums.map((item) => {
          const cover = home.photos.find((photo) => photo.id === item.coverPhotoId);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onAlbum(item.id)}
              className="min-w-0 text-left"
            >
              <span className="block aspect-[1.15] overflow-hidden rounded-2xl bg-raised">
                {cover?.thumbUrl ? (
                  <img src={cover.thumbUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Stripes />
                )}
              </span>
              <span className="mt-2 block truncate text-[15px]">{item.title}</span>
              <span className="block text-[13px] text-muted">
                {photoCountLabel(item.photoIds.length)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PhotoGroups({
  title,
  back,
  photos,
  picked,
  onBack,
  onOpen,
  onChoose,
  onAdd,
  extra,
}: {
  title: string;
  back: string;
  photos: AlbumPhoto[];
  picked: string[] | null;
  onBack: () => void;
  onOpen: (id: string) => void;
  onChoose: () => void;
  onAdd: () => void;
  extra?: ReactNode;
}) {
  return (
    <section className={picked ? "pb-52" : "pb-28"}>
      <div className="px-4 pt-5">
        <Back label={back} onClick={onBack} />
        <div className="mt-3 flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-[32px] font-semibold">{title}</h1>
          <button
            type="button"
            className="shrink-0 text-[16px] font-semibold text-blue"
            onClick={onChoose}
          >
            {picked ? "Готово" : "Выбрать"}
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cream font-semibold text-cream-fg"
        >
          <Plus className="size-4" /> Добавить
        </button>
      </div>
      <MonthList photos={photos} picked={picked} onOpen={onOpen} />
      {extra}
    </section>
  );
}

function MonthList({
  photos,
  picked,
  onOpen,
}: {
  photos: AlbumPhoto[];
  picked: string[] | null;
  onOpen: (id: string) => void;
}) {
  const groups = groupByMonth(photos);
  if (!photos.length) return <p className="px-4 pt-8 text-muted">Пока пусто</p>;
  return (
    <div>
      {groups.map((group) => (
        <section key={group.key} className="mt-6">
          <div className="mb-2 flex items-baseline justify-between px-4">
            <h2 className="text-[22px] font-semibold">{group.label}</h2>
            <span className="text-[14px] text-muted">{group.photos.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {group.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                aria-pressed={picked ? picked.includes(photo.id) : undefined}
                onClick={() => onOpen(photo.id)}
                className={`relative aspect-square overflow-hidden bg-raised ${
                  picked?.includes(photo.id) ? "ring-2 ring-blue ring-inset" : ""
                }`}
              >
                {photo.thumbUrl ? (
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    className={`size-full object-cover ${picked?.includes(photo.id) ? "brightness-75" : ""}`}
                  />
                ) : (
                  <Stripes />
                )}
                {picked ? <SelectDot on={picked.includes(photo.id)} /> : null}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SpacePage({
  home,
  onBack,
  onTrash,
}: {
  home: AlbumHome;
  onBack: () => void;
  onTrash: () => void;
}) {
  const ratio = usedRatio(home.quota.used, home.quota.limit);
  return (
    <section className="px-4 pt-5 pb-16">
      <Back label="Альбом" onClick={onBack} />
      <h1 className="mt-3 text-[34px] font-semibold tracking-tight">Место</h1>
      <div className="mt-5 rounded-[28px] bg-raised px-5 py-5">
        <p className="text-[34px] leading-none font-semibold">
          {formatBytes(home.quota.used)}{" "}
          <span className="text-[16px] font-medium text-muted">
            из {formatBytes(home.quota.limit)}
          </span>
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue"
            style={{ width: `${Math.max(ratio * 100, ratio ? 2 : 0)}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-[14px] text-muted">
          <span>{photoCountLabel(home.quota.photoCount)}</span>
          <span>{formatBytes(home.quota.free)} свободно</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onTrash}
        className="mt-3 flex w-full items-center gap-3 rounded-[24px] bg-raised px-4 py-4 text-left"
      >
        <Trash2 className="size-5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px]">Недавно удалённые</span>
          <span className="block text-[13px] text-muted">не считаются в лимит</span>
        </span>
        <span className="text-[14px] text-muted">{formatBytes(home.quota.trashBytes)} ›</span>
      </button>
    </section>
  );
}

function Viewer({
  photo,
  index,
  total,
  name,
  color,
  onClose,
  onStep,
  onLike,
  onSave,
  onAlbum,
  onDelete,
}: {
  photo: AlbumPhoto;
  index: number;
  total: number;
  name: string;
  color: "blue" | "pink";
  onClose: () => void;
  onStep: (delta: number) => void;
  onLike: () => void;
  onSave: () => void;
  onAlbum: () => void;
  onDelete: () => void;
}) {
  const [full, setFull] = useState("");
  const startX = useRef(0);
  useEffect(() => {
    let cancel = false;
    setFull("");
    void openAlbumPhoto({ data: { id: photo.id } })
      .then((file) => {
        if (!cancel) setFull(file.url);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [photo.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onStep(-1);
      if (event.key === "ArrowRight") onStep(1);
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);
  const colors = usePlayerColors();
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-black"
      onTouchStart={(event) => {
        startX.current = event.changedTouches[0]?.clientX ?? 0;
      }}
      onTouchEnd={(event) => {
        const dx = (event.changedTouches[0]?.clientX ?? 0) - startX.current;
        if (dx > 48) onStep(-1);
        if (dx < -48) onStep(1);
      }}
    >
      <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 place-items-center"
          aria-label="Закрыть"
        >
          <X className="size-6" />
        </button>
        <p className="text-[15px] text-white/80">
          {index + 1} из {total}
        </p>
        <span className="size-11" />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {full || photo.thumbUrl ? (
          <img
            src={full || photo.thumbUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-muted">Открываем…</p>
        )}
        <button
          type="button"
          className="absolute top-0 left-0 h-full w-1/4"
          aria-label="Предыдущее"
          onClick={() => onStep(-1)}
        />
        <button
          type="button"
          className="absolute top-0 right-0 h-full w-1/4"
          aria-label="Следующее"
          onClick={() => onStep(1)}
        />
      </div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="flex min-w-0 items-center gap-2 text-[13px] tracking-wide uppercase">
          <span className={`size-2.5 shrink-0 rounded-full ${pieceBg(color)}`} />
          <span className="truncate">{name}</span>
        </p>
        <p className="mt-1 text-[13px] text-muted">{viewerStamp(photo.takenAt)}</p>
        {photo.likedByPartner && !photo.likedByMe ? (
          <p className={`mt-1 text-[13px] ${pieceText(colors.partner)}`}>нравится партнёру</p>
        ) : null}
        <div className="mt-4 grid grid-cols-4 text-center text-[12px] text-white/80">
          <button
            type="button"
            onClick={onLike}
            className="flex min-h-14 flex-col items-center gap-1"
          >
            <Heart
              className={`size-6 ${photo.likedByMe ? "fill-current text-cream" : photo.likedByPartner ? pieceText(colors.partner) : ""}`}
            />
            Нравится
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex min-h-14 flex-col items-center gap-1"
          >
            <Download className="size-6" />
            Сохранить
          </button>
          <button
            type="button"
            onClick={onAlbum}
            className="flex min-h-14 flex-col items-center gap-1"
          >
            <ImagePlus className="size-6" />В альбом
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-14 flex-col items-center gap-1"
          >
            <Trash2 className="size-6" />
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadToast({ done, total, fraction }: { done: number; total: number; fraction: number }) {
  const pct = Math.round(((done + fraction) / Math.max(total, 1)) * 100);
  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-[24px] bg-[#1a1c22] px-4 py-3 shadow-2xl">
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 size-6 shrink-0 text-blue" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[16px] font-semibold">
              Загрузка {done} из {total}
            </p>
            <p className="text-[13px] text-muted">{pct}%</p>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            не сворачивай — загрузка идёт, только пока приложение открыто
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-white/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChooseBar({
  count,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  count: number;
  primary: string;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {secondary && onSecondary ? (
        <button
          type="button"
          disabled={!count}
          onClick={onSecondary}
          className="min-h-12 flex-1 rounded-full bg-raised text-[15px] disabled:opacity-40"
        >
          {secondary}
        </button>
      ) : null}
      <button
        type="button"
        disabled={!count}
        onClick={onPrimary}
        className="min-h-12 flex-1 rounded-full bg-cream font-semibold text-cream-fg disabled:opacity-40"
      >
        {primary}
        {count ? ` · ${count}` : ""}
      </button>
    </div>
  );
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 text-left text-[17px] text-muted">
      ‹ {label}
    </button>
  );
}

function MenuButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block min-h-11 w-full border-t border-line px-4 text-left text-[16px] ${danger ? "text-move" : ""}`}
    >
      {label}
    </button>
  );
}

function SelectDot({ on }: { on: boolean }) {
  return (
    <span
      className={`absolute top-1.5 right-1.5 z-10 grid size-7 place-items-center rounded-full border-2 shadow-md ${
        on ? "border-white bg-blue text-white" : "border-white bg-black/45 text-transparent"
      }`}
    >
      <Check className="size-4" strokeWidth={3} />
    </span>
  );
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex items-start gap-3 rounded-2xl bg-raised px-4 py-3 text-[15px] shadow-2xl">
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <button type="button" onClick={onClose} className="shrink-0 text-muted" aria-label="Закрыть">
        <X className="size-4" />
      </button>
    </div>
  );
}

function dropFromAlbum(home: AlbumHome, albumId: string, ids: string[]): AlbumHome {
  const drop = new Set(ids);
  return {
    ...home,
    photos: home.photos.map((photo) =>
      drop.has(photo.id)
        ? { ...photo, albumIds: photo.albumIds.filter((id) => id !== albumId) }
        : photo,
    ),
    albums: home.albums.map((album) =>
      album.id === albumId ? { ...album, ...albumAfterRemoval(album, ids) } : album,
    ),
  };
}

function Stripes() {
  return (
    <span
      className="block size-full"
      style={{
        background: "repeating-linear-gradient(135deg, #17181c 0 8px, #22242a 8px 16px)",
      }}
    />
  );
}

function EmptyStack() {
  return (
    <div className="relative h-36 w-44">
      <span
        className="absolute top-6 left-2 h-28 w-24 -rotate-12 rounded-2xl bg-[#243044]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0 7px, rgba(255,255,255,0.04) 7px 8px)",
        }}
      />
      <span
        className="absolute top-6 right-2 h-28 w-24 rotate-12 rounded-2xl bg-[#3a2433]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0 7px, rgba(255,255,255,0.04) 7px 8px)",
        }}
      />
      <span className="absolute top-2 left-1/2 grid h-32 w-24 -translate-x-1/2 place-items-center rounded-2xl border border-white/10 bg-[#16181d] shadow-xl">
        <ImagePlus className="size-8 text-muted" />
      </span>
    </div>
  );
}

function toggle(
  setPicked: (value: string[] | null | ((current: string[] | null) => string[] | null)) => void,
  id: string,
) {
  setPicked((current) => {
    const list = current ?? [];
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  });
}

function rememberPhoto(
  setHome: (value: AlbumHome | null | ((current: AlbumHome | null) => AlbumHome | null)) => void,
  photo: AlbumPhoto,
) {
  setHome((prev) => {
    if (!prev || prev.photos.some((item) => item.id === photo.id)) return prev;
    return {
      ...prev,
      photos: [photo, ...prev.photos],
      quota: {
        ...prev.quota,
        used: prev.quota.used + photo.byteSize,
        free: Math.max(0, prev.quota.free - photo.byteSize),
        photoCount: prev.quota.photoCount + 1,
      },
    };
  });
}

async function ensureThumbs(
  home: AlbumHome,
  ids: string[],
  setHome: (value: AlbumHome | null | ((current: AlbumHome | null) => AlbumHome | null)) => void,
) {
  const now = Date.now();
  const need = ids.filter((id) => {
    const photo = home.photos.find((item) => item.id === id);
    return photo && (!photo.thumbUrl || photo.expiresAt < now + URL_REFRESH_MS);
  });
  for (let index = 0; index < need.length; index += 80) {
    const batch = await signAlbumPhotos({ data: { ids: need.slice(index, index + 80) } });
    if (!batch.length) continue;
    const map = new Map(batch.map((item) => [item.id, item]));
    setHome((prev) =>
      prev
        ? {
            ...prev,
            photos: prev.photos.map((photo) => {
              const hit = map.get(photo.id);
              return hit ? { ...photo, thumbUrl: hit.thumbUrl, expiresAt: hit.expiresAt } : photo;
            }),
          }
        : prev,
    );
  }
}
