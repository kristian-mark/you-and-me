import { useState } from "react";
import { Bell, CircleHelp } from "lucide-react";
import { SheetHeader } from "@/components/sheet-header";
import { markActivitySeen, markAllPairActivity } from "@/lib/activity-server";
import { activityPreview, activityText, bellTotal, type ActivityItem } from "@/lib/activity-model";
import { openActivity } from "@/lib/activity-nav";
import { badgeLabel } from "@/lib/chat-model";
import { useCouple, usePlayerColors } from "@/lib/couple-store";
import { formatRuNoteStamp } from "@/lib/dates";
import { pieceBg, pieceText } from "@/lib/pair-color";

function ActivitySheet({ onClose }: { onClose: () => void }) {
  const activity = useCouple((s) => s.activity);
  const chatUnread = useCouple((s) => s.chatUnread);
  const partnerName = useCouple((s) => s.partnerName);
  const colors = usePlayerColors();
  const total = bellTotal(chatUnread, activity.counts);
  const accent = pieceText(colors.partner);

  const readAll = () => {
    useCouple.getState().clearActivity();
    onClose();
    void markAllPairActivity().catch(() => undefined);
  };

  const openItem = (item: ActivityItem) => {
    useCouple.getState().forgetActivityItem(item.id);
    onClose();
    openActivity(item);
    if (item.section !== "chat") {
      void markActivitySeen({ data: { section: item.section, targetId: item.targetId } }).catch(() => undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50">
      <button type="button" className="min-h-12 flex-1" aria-label="Закрыть" onClick={onClose} />
      <section className="app-sheet flex max-h-[min(80dvh,40rem)] min-w-0 flex-col overflow-hidden rounded-t-[28px] bg-bg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="px-4">
          <SheetHeader title="Новое" onCancel={onClose} cancelLabel="Закрыть" />
        </div>
        {total > 0 ? (
          <button type="button" onClick={readAll} className={`min-h-11 px-4 text-left text-[16px] ${accent}`}>
            Прочитать все
          </button>
        ) : null}
        {activity.items.length === 0 ? (
          <p className="px-5 pt-2 pb-8 text-[16px] leading-6 break-words text-muted">
            Пока тихо. Здесь появится то, что сделает {partnerName}.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {activity.items.map((item) => {
              const preview = activityPreview(item);
              const when = formatRuNoteStamp(item.at);
              return (
                <li key={item.id} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex w-full min-w-0 gap-3 px-4 py-3 text-left"
                  >
                    <span className={`mt-2 size-2 shrink-0 rounded-full ${pieceBg(colors.partner)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] leading-5 break-words">{activityText(partnerName, item)}</span>
                      {preview ? (
                        <span className="mt-1 block text-[14px] leading-5 break-words text-muted">{preview}</span>
                      ) : null}
                      {when ? <span className="mt-1 block text-[13px] text-muted">{when}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ActivityBell() {
  const [open, setOpen] = useState(false);
  const activity = useCouple((s) => s.activity);
  const chatUnread = useCouple((s) => s.chatUnread);
  const count = bellTotal(chatUnread, activity.counts);
  const label = badgeLabel(count);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-11 shrink-0 place-items-center rounded-full"
        aria-label={label ? `Уведомления, ${label} новых` : "Уведомления"}
      >
        <Bell className="size-5" />
        {label ? (
          <span className="absolute top-1 right-0.5 min-w-4 rounded-full bg-cream px-1 text-center text-[10px] leading-4 font-semibold text-cream-fg">
            {label}
          </span>
        ) : null}
      </button>
      {open ? <ActivitySheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Top corner on screens that do not already keep a bell in the header row. */
export function ActivityFloat() {
  const tab = useCouple((s) => s.tab);
  const moreOpen = useCouple((s) => s.moreOpen);
  if (tab !== "more" || !moreOpen || moreOpen === "chat" || moreOpen === "games") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="app-frame safe-pad flex justify-end pr-1">
        <div className="pointer-events-auto">
          <ActivityBell />
        </div>
      </div>
    </div>
  );
}

export function GameTools({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-self-end">
      <ActivityBell />
      <button
        type="button"
        onClick={onHelp}
        className="grid size-11 place-items-center text-[#e6e1d6]"
        aria-label="Правила"
      >
        <CircleHelp className="size-5" />
      </button>
    </div>
  );
}
