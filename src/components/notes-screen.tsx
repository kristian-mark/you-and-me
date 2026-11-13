import { useMemo, useState } from "react";
import { Check, Folder, FolderMinus, Plus, Search } from "lucide-react";
import { SheetHeader } from "@/components/sheet-header";
import { EmptyState, UsBadge } from "@/components/ui/shell";
import { formatRuNoteStamp } from "@/lib/dates";
import { useCouple, usePlayerColors, type Note } from "@/lib/couple-store";
import { pieceText } from "@/lib/pair-color";

const FOLDER_COLORS = ["#e58aae", "#4aa3e8", "#2cb5b0", "#5dce8a", "#8b8b92"];

export function NotesScreen({ onBack }: { onBack: () => void }) {
  const notes = useCouple((s) => s.notes);
  const folders = useCouple((s) => s.noteFolders);
  const [sheet, setSheet] = useState<"new" | Note | null>(null);
  const [folderView, setFolderView] = useState<string | "all" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [query, setQuery] = useState("");
  const selected = notes.find((n) => n.id === openId);

  if (sheet) {
    return (
      <NoteEditor
        note={sheet === "new" ? undefined : sheet}
        onClose={() => setSheet(null)}
      />
    );
  }
  if (newFolder) {
    return <FolderEditor onClose={() => setNewFolder(false)} />;
  }
  if (selected) {
    return (
      <NoteDetail
        note={selected}
        onBack={() => setOpenId(null)}
        onEdit={() => setSheet(selected)}
      />
    );
  }
  if (folderView !== null) {
    const folder = folderView === "all" ? null : folders.find((f) => f.id === folderView);
    const items = notes.filter((n) => {
      if (folderView === "all") return true;
      return n.folderId === folderView;
    });
    return (
      <FolderNotes
        title={folder?.title ?? "Все заметки"}
        notes={items}
        onBack={() => setFolderView(null)}
        onOpen={setOpenId}
        onAdd={() => setSheet("new")}
      />
    );
  }

  const filtered = notes.filter((n) =>
    !query.trim() || n.title.toLowerCase().includes(query.toLowerCase()) || n.body.toLowerCase().includes(query.toLowerCase()),
  );
  const tags = [...new Set(notes.flatMap((n) => n.tags))];

  if (notes.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col px-5">
        <button type="button" onClick={onBack} className="pt-5 text-left text-muted">
          ‹ Ещё
        </button>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-[32px] font-semibold">Заметки</h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setSheet("new")} className="grid size-10 place-items-center rounded-xl bg-raised">
              <Plus className="size-5" />
            </button>
            <UsBadge />
          </div>
        </div>
        <EmptyState
          icon={<Folder className="size-16" strokeWidth={1.2} />}
          title="Общий блокнот"
          body="Рецепты, пароль от дачи, что спросить у врача. Текст видите оба."
          action="Написать заметку"
          hint="папки и теги — чтобы не потерять"
          onAction={() => setSheet("new")}
        />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <button type="button" onClick={onBack} className="pt-5 text-left text-muted">
        ‹ Ещё
      </button>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-[32px] font-semibold">Заметки</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setSheet("new")} className="grid size-10 place-items-center rounded-xl bg-raised">
            <Plus className="size-5" />
          </button>
          <UsBadge />
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 rounded-2xl bg-raised px-4 py-3">
        <Search className="size-4 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск заметок"
          className="w-full bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      <button
        type="button"
        onClick={() => setFolderView("all")}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-raised px-4 py-4"
      >
        <Folder className="size-5" />
        <span className="flex-1 text-left">Все заметки</span>
        <span className="text-muted">{filtered.length}</span>
        <span className="text-muted">›</span>
      </button>
      {folders.length ? (
        <>
          <p className="mt-6 text-[11px] tracking-widest text-muted">ПАПКИ</p>
          <div className="mt-2 overflow-hidden rounded-2xl bg-raised">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderView(f.id)}
                className="flex w-full items-center gap-3 border-b border-line px-4 py-4 last:border-0"
              >
                <span className="size-5 rounded-sm" style={{ background: f.color }} />
                <span className="flex-1 text-left">{f.title}</span>
                <span className="text-muted">{notes.filter((n) => n.folderId === f.id).length}</span>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {tags.length ? (
        <>
          <p className="mt-6 text-[11px] tracking-widest text-muted">ТЕГИ</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-raised px-3 py-2 text-[13px]">
                #{tag} · {notes.filter((n) => n.tags.includes(tag)).length}
              </span>
            ))}
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setNewFolder(true)}
        className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-4 text-muted"
      >
        <Plus className="size-4" /> Новая папка
      </button>
    </section>
  );
}

function FolderNotes({
  title,
  notes,
  onBack,
  onOpen,
  onAdd,
}: {
  title: string;
  notes: Note[];
  onBack: () => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const myName = useCouple((s) => s.myName);
  const colors = usePlayerColors();
  const [tag, setTag] = useState<string | "all">("all");
  const tags = [...new Set(notes.flatMap((n) => n.tags))];
  const visible = tag === "all" ? notes : notes.filter((n) => n.tags.includes(tag));

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-5 pb-28">
      <div className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Заметки
        </button>
        <button type="button" onClick={onAdd} className="grid size-10 place-items-center rounded-xl bg-raised">
          <Plus className="size-5" />
        </button>
      </div>
      <h1 className="mt-4 text-[32px] font-semibold">{title}</h1>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTag("all")}
          className={`max-w-full rounded-full px-3 py-2 text-[13px] break-words ${tag === "all" ? "bg-chip" : "bg-raised text-muted"}`}
        >
          Все · {notes.length}
        </button>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t)}
            className={`max-w-full rounded-full px-3 py-2 text-[13px] break-words ${tag === t ? "bg-chip" : "bg-raised text-muted"}`}
          >
            #{t}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {visible.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => onOpen(note.id)}
              className="w-full rounded-2xl bg-raised p-4 text-left"
            >
              <p className="text-[17px] font-medium">{note.title}</p>
              <p className="mt-2 text-[13px] text-muted">
                {noteStamp(note.createdAt)} · <span className={pieceText(colors.me)}>●</span> {myName}
                {note.tags[0] ? ` · #${note.tags[0]}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteDetail({
  note,
  onBack,
  onEdit,
}: {
  note: Note;
  onBack: () => void;
  onEdit: () => void;
}) {
  const folders = useCouple((s) => s.noteFolders);
  const deleteNote = useCouple((s) => s.deleteNote);
  const myName = useCouple((s) => s.myName);
  const folder = folders.find((f) => f.id === note.folderId);
  const [menu, setMenu] = useState(false);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-28">
      <header className="flex items-center justify-between pt-5">
        <button type="button" onClick={onBack} className="text-muted">
          ‹ Заметки
        </button>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onEdit} className="text-blue">
            Изменить
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} className="text-muted">
              ⋯
            </button>
            {menu ? (
              <button
                type="button"
                onClick={() => {
                  deleteNote(note.id);
                  onBack();
                }}
                className="absolute top-8 right-0 rounded-xl bg-raised px-4 py-3 text-pink"
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <h1 className="mt-6 text-[32px] font-semibold">{note.title}</h1>
      <p className="mt-2 text-[14px] text-muted">
        {folder?.title ?? "Без папки"} · {myName} · {noteStamp(note.createdAt)}
      </p>
      {note.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-raised px-3 py-1 text-[13px]">
              #{t}
            </span>
          ))}
        </div>
      ) : null}
      {note.body ? <p className="mt-6 whitespace-pre-wrap text-[16px] leading-relaxed">{note.body}</p> : null}
    </section>
  );
}

function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const addNote = useCouple((s) => s.addNote);
  const updateNote = useCouple((s) => s.updateNote);
  const folders = useCouple((s) => s.noteFolders);
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [folderId, setFolderId] = useState(note?.folderId);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [pickFolder, setPickFolder] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const folder = folders.find((f) => f.id === folderId);

  const save = () => {
    const name = title.trim();
    if (!name) return;
    const payload = { title: name, body: body.trim(), folderId, tags };
    if (note) updateNote(note.id, payload);
    else addNote(payload);
    onClose();
  };

  if (pickFolder) {
    return (
      <FolderPicker
        value={folderId}
        onPick={(id) => {
          setFolderId(id);
          setPickFolder(false);
        }}
        onClose={() => setPickFolder(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col px-4">
        <SheetHeader
          flush
          title={note ? "Заметка" : "Новая заметка"}
          onCancel={onClose}
          onDone={save}
          doneMuted={!title.trim()}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickFolder(true)}
            className="flex items-center gap-2 rounded-full bg-raised px-3 py-2 text-[13px]"
          >
            <span className="size-3 rounded-sm" style={{ background: folder?.color ?? "transparent" }} />
            {folder?.title ?? "Без папки"}
          </button>
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-raised px-3 py-2 text-[13px]">
              #{t}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setTagOpen(true)}
            className="rounded-full border border-dashed border-line px-3 py-2 text-[13px] text-muted"
          >
            + тег
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название заметки"
          className="mt-5 bg-transparent text-[28px] font-semibold outline-none placeholder:text-muted"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Текст"
          className="mt-4 min-h-40 flex-1 resize-none bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
      </div>
      {tagOpen ? (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/50 px-8">
          <div className="w-full max-w-sm rounded-3xl bg-raised p-5">
            <p className="text-center text-[17px]">Новый тег</p>
            <input
              autoFocus
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="например, ужин"
              className="mt-4 w-full rounded-2xl bg-chip px-4 py-3 outline-none"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setTagOpen(false)} className="rounded-2xl bg-chip py-3 text-blue">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = tagDraft.trim().replace(/^#/, "");
                  if (t && !tags.includes(t)) setTags([...tags, t]);
                  setTagDraft("");
                  setTagOpen(false);
                }}
                className="rounded-2xl bg-chip py-3 text-blue"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FolderPicker({
  value,
  onPick,
  onClose,
}: {
  value?: string;
  onPick: (id?: string) => void;
  onClose: () => void;
}) {
  const folders = useCouple((s) => s.noteFolders);
  const [creating, setCreating] = useState(false);
  if (creating) {
    return (
      <FolderEditor
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          onPick(id);
        }}
      />
    );
  }
  return (
    <div className="fixed inset-0 z-50 bg-bg px-5">
      <header className="pt-5">
        <button type="button" onClick={onClose} className="text-muted">
          Отмена
        </button>
        <h2 className="mt-6 text-[28px] font-semibold">Папка заметки</h2>
      </header>
      <div className="mt-6 overflow-hidden rounded-2xl bg-raised">
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
          >
            <span className="size-5 rounded-sm" style={{ background: f.color }} />
            <span className="flex-1 text-left">{f.title}</span>
            {value === f.id ? <Check className="size-4 text-blue" /> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPick(undefined)}
          className="flex w-full items-center gap-3 px-4 py-4"
        >
          <FolderMinus className="size-5 text-muted" />
          <span className="flex-1 text-left">Без папки</span>
          {!value ? <Check className="size-4 text-blue" /> : null}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-4 text-muted"
      >
        <Plus className="size-4" /> Новая папка
      </button>
    </div>
  );
}

function FolderEditor({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addNoteFolder = useCouple((s) => s.addNoteFolder);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  const save = () => {
    const name = title.trim();
    if (!name) return;
    const id = addNoteFolder(name, color);
    onCreated?.(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto max-w-md px-4">
        <SheetHeader flush title="Новая папка" onCancel={onClose} onDone={save} doneMuted={!title.trim()} />
        <label className="mt-6 block rounded-2xl bg-raised px-4 py-3">
          <span className="text-[11px] tracking-wider text-muted">НАЗВАНИЕ</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="например, Рецепты"
            className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
          />
        </label>
        <div className="mt-3 rounded-2xl bg-raised px-4 py-4">
          <p className="text-[11px] tracking-wider text-muted">ЦВЕТ</p>
          <div className="mt-3 flex gap-4">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-8 rounded-full ${color === c ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function noteStamp(iso: string) {
  return formatRuNoteStamp(iso);
}
