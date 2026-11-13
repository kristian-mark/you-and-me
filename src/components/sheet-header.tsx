/**
 * Отмена / title / Готово. The title sits in a shrinkable middle column
 * so at 320px it truncates instead of covering the actions.
 */
export function SheetHeader({
  title,
  onCancel,
  cancelLabel = "Отмена",
  onDone,
  doneLabel = "Готово",
  doneDisabled = false,
  doneMuted = false,
  doneTone = "blue",
  flush = false,
  pad = true,
}: {
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  /** Muted action that can still be tapped. */
  doneMuted?: boolean;
  doneTone?: "blue" | "fg";
  /** Parent already has horizontal padding. */
  flush?: boolean;
  /** Parent already has top padding. */
  pad?: boolean;
}) {
  const tone = doneDisabled || doneMuted ? "text-muted" : doneTone === "fg" ? "text-fg" : "text-blue";
  const side = "min-h-11 shrink-0 whitespace-nowrap text-[17px]";
  return (
    <header
      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 ${pad ? "pt-5" : ""} pb-3 ${
        flush ? "" : "px-4"
      }`}
    >
      <button type="button" onClick={onCancel} className={`${side} text-left text-muted`}>
        {cancelLabel}
      </button>
      <h2 className="min-w-0 truncate text-center text-[17px] font-semibold">{title}</h2>
      {onDone ? (
        <button type="button" onClick={onDone} disabled={doneDisabled} className={`${side} text-right ${tone}`}>
          {doneLabel}
        </button>
      ) : (
        <span className={`${side} invisible`} aria-hidden>
          {cancelLabel}
        </span>
      )}
    </header>
  );
}
