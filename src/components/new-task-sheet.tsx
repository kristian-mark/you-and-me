import { useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Eye, Plus } from "lucide-react";
import { useCouple, type RepeatKind, type Subtask, type Task, type TaskOwner } from "@/lib/couple-store";

const REPEATS: { id: RepeatKind; label: string }[] = [
  { id: "none", label: "Не повторять" },
  { id: "daily", label: "Каждый день" },
  { id: "weekly", label: "Каждую неделю" },
  { id: "monthly", label: "Каждый месяц" },
];

function asSubtasks(raw: Task["subtasks"] | string[] | undefined): Subtask[] {
  return (raw ?? []).map((s) =>
    typeof s === "string" ? { id: crypto.randomUUID(), text: s, done: false } : s,
  );
}

export function NewTaskSheet({ task, onClose }: { task?: Task; onClose: () => void }) {
  const addTask = useCouple((s) => s.addTask);
  const updateTask = useCouple((s) => s.updateTask);
  const partnerName = useCouple((s) => s.partnerName);
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => asSubtasks(task?.subtasks));
  const [draftSub, setDraftSub] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [owner, setOwner] = useState<TaskOwner>(task?.owner ?? "free");
  const [dueOn, setDueOn] = useState(Boolean(task?.dueDate));
  const [dueDate, setDueDate] = useState(task?.dueDate ?? format(new Date(), "yyyy-MM-dd"));
  const [repeat, setRepeat] = useState<RepeatKind>(task?.repeat ?? "none");
  const [showRepeat, setShowRepeat] = useState(false);
  const [inCalendar, setInCalendar] = useState(Boolean(task?.showInCalendar));
  const [note, setNote] = useState(task?.note ?? "");

  const save = () => {
    const name = title.trim();
    if (!name) return;
    const payload = {
      title: name,
      owner,
      subtasks,
      note: note.trim(),
      dueDate: dueOn ? dueDate : undefined,
      repeat: dueOn ? repeat : ("none" as const),
      showInCalendar: dueOn && inCalendar,
    };
    if (task) updateTask(task.id, payload);
    else addTask(payload);
    onClose();
  };

  const openDate = () => {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-5 pb-3">
          <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-muted">
            Отмена
          </button>
          <h2 className="whitespace-nowrap text-center text-[17px] font-semibold">
            {task ? "Изменить" : "Новая задача"}
          </h2>
          <button
            type="button"
            onClick={save}
            className={`justify-self-end text-[17px] ${title.trim() ? "text-fg" : "text-muted"}`}
          >
            Готово
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">ЧТО СДЕЛАТЬ</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заказать, купить, забрать"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>

          <div className="rounded-2xl bg-raised px-4 py-3">
            {subtasks.map((item) => (
              <p key={item.id} className="py-1 text-[15px] text-fg">
                {item.text}
              </p>
            ))}
            {addingSub ? (
              <input
                autoFocus
                value={draftSub}
                onChange={(e) => setDraftSub(e.target.value)}
                onBlur={() => {
                  if (draftSub.trim()) {
                    setSubtasks((s) => [
                      ...s,
                      { id: crypto.randomUUID(), text: draftSub.trim(), done: false },
                    ]);
                  }
                  setDraftSub("");
                  setAddingSub(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="Подзадача"
                className="w-full bg-transparent py-1 text-[15px] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingSub(true)}
                className="flex items-center gap-2 py-1 text-[16px] text-muted"
              >
                <Plus className="size-4" /> Подзадача
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-raised px-4 py-3">
            <p className="text-[11px] tracking-wider text-muted">КОМУ</p>
            <div className="mt-3 flex rounded-2xl bg-bg p-1">
              {(
                [
                  ["free", "Никому"],
                  ["me", "Мне"],
                  ["partner", partnerName],
                  ["both", "Обоим"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOwner(id)}
                  className={`min-w-0 flex-1 truncate rounded-xl px-1 py-2 text-[13px] ${
                    owner === id ? "bg-chip text-fg" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-snug text-muted">
              «Никому» — свободная задача, кто первый взял, тот и делает
            </p>
          </div>

          <div className="rounded-2xl bg-raised px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[16px]">Срок</span>
              <Switch on={dueOn} onChange={setDueOn} />
            </div>
          </div>

          {dueOn ? (
            <>
              <button
                type="button"
                onClick={openDate}
                className="relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-raised px-4 py-4"
              >
                <span className="text-[16px]">Когда</span>
                <span className="rounded-full bg-chip px-3 py-1 text-[14px]">
                  {format(new Date(`${dueDate}T12:00:00`), "d MMM yyyy", { locale: ru })}
                </span>
                <input
                  ref={dateRef}
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    if (e.target.value) setDueDate(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </button>

              <button
                type="button"
                onClick={() => setShowRepeat((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl bg-raised px-4 py-4"
              >
                <span className="text-[16px]">Повтор</span>
                <span className="text-[15px] text-muted">
                  {REPEATS.find((r) => r.id === repeat)?.label} ›
                </span>
              </button>
              {showRepeat
                ? REPEATS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRepeat(r.id);
                        setShowRepeat(false);
                      }}
                      className="w-full rounded-2xl bg-raised px-4 py-3 text-left text-[15px]"
                    >
                      {r.label}
                    </button>
                  ))
                : null}

              <div className="rounded-2xl bg-raised px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 text-[16px]">Показать в календаре</span>
                  <Switch on={inCalendar} onChange={setInCalendar} />
                </div>
                <p className="mt-2 text-[13px] text-muted">задача встанет на дату срока</p>
              </div>
            </>
          ) : null}

          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">ЗАМЕТКА</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Телефон, адрес, о чём спросить"
              rows={3}
              className="mt-1 w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-muted"
            />
          </label>

          <div className="flex gap-3 rounded-2xl bg-raised px-4 py-4 text-[14px] leading-snug text-muted">
            <Eye className="mt-0.5 size-5 shrink-0" />
            <p>
              {partnerName} сразу видит задачу и может вернуть назначенную ей обратно в свободные.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full ${on ? "bg-blue" : "bg-chip"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-fg ${on ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}
