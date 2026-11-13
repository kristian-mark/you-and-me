import { useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";

export function InChatRow({
  className = "mt-3",
  label = "В чат",
  onSend,
}: {
  className?: string;
  label?: string;
  onSend: () => Promise<unknown>;
}) {
  const [text, setText] = useState(label);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void onSend()
          .then(() => setText("Отправлено в чат"))
          .catch((error: unknown) => {
            setText(error instanceof Error ? error.message : "Не ушло");
          })
          .finally(() => setBusy(false));
      }}
      className={`${className} flex min-h-11 w-full items-center gap-3 rounded-2xl bg-raised px-4 py-4 text-left disabled:opacity-60`}
    >
      <MessageCircle className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </button>
  );
}
