import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { SheetHeader } from "@/components/sheet-header";
import { formatRuDay, toIsoDate } from "@/lib/dates";
import { useCouple, viewedOwner, type RepeatKind, type Subtask, type Task, type TaskOwner } from "@/lib/couple-store";

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
  const myUserId = useCouple((s) => s.myUserId);
  const [title, setTitle] = useState(task?.title ?? "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => asSubtasks(task?.subtasks));
  const [draftSub, setDraftSub] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [owner, setOwner] = useState<TaskOwner>(task ? viewedOwner(task, myUserId) : "free");
  const [dueOn, setDueOn] = useState(Boolean(task?.dueDate));
  const [dueDate, setDueDate] = useState(task?.dueDate ?? toIsoDate(new Date()));
  const [pickDate, setPickDate] = useState(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full min-w-0 max-w-md flex-col overflow-x-hidden">
        <SheetHeader
          title={task ? "Изменить" : "Новая задача"}
          onCancel={onClose}
          onDone={save}
          doneMuted={!title.trim()}
          doneTone="fg"
        />

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
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-1 rounded-2xl bg-bg p-1">
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
                  className={`min-w-0 rounded-xl px-2 py-2 text-[13px] leading-4 break-words ${
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
                onClick={() => setPickDate(true)}
                className="flex w-full items-center justify-between rounded-2xl bg-raised px-4 py-4"
              >
                <span className="text-[16px]">Когда</span>
                <span className="rounded-full bg-chip px-3 py-1 text-[14px]">
                  {formatRuDay(dueDate, "long")}
                </span>
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
      {pickDate ? (
        <DatePicker
          mode="any"
          label="Срок"
          value={dueDate}
          onPick={(day) => {
            setDueDate(day);
            setPickDate(false);
          }}
          onClose={() => setPickDate(false)}
        />
      ) : null}
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
