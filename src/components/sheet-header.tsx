/**
 * Отмена / title / Готово. Actions keep their width. A normal title wraps
 * onto a second line at 320px; only a very long title is clamped.
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
  const side = "min-h-11 shrink-0 whitespace-nowrap px-0.5 text-[16px] min-[400px]:text-[17px]";
  return (
    <header
      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 ${pad ? "pt-5" : ""} pb-3 ${
        flush ? "" : "px-1"
      }`}
    >
      <button type="button" onClick={onCancel} className={`${side} text-left text-muted`}>
        {cancelLabel}
      </button>
      <h2 className="line-clamp-2 min-w-0 text-center text-[15px] leading-tight font-semibold break-words min-[400px]:text-[17px]">
        {title}
      </h2>
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
