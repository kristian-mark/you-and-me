import { useEffect, useRef } from "react";
import { sendChatCard } from "@/lib/chat-server";
import { eventDateOf, type ChatCardKind, type ChatTarget } from "@/lib/chat-model";
import { useCouple } from "@/lib/couple-store";

export function shareToChat(input: {
  kind: ChatCardKind;
  id: string;
  title: string;
  subtitle?: string;
}) {
  return sendChatCard({
    data: {
      kind: input.kind,
      id: input.id,
      title: input.title,
      subtitle: input.subtitle ?? "",
    },
  });
}

export function openChatCard(message: { kind: ChatCardKind; id: string; subtitle?: string }) {
  const target: ChatTarget = {
    kind: message.kind,
    id: message.id,
    date: message.kind === "event" ? eventDateOf(message.subtitle ?? "") : undefined,
  };
  const store = useCouple.getState();
  store.setChatTarget(target);
  if (target.kind === "wish") {
    store.setTab("wishes");
    store.setMore(null);
    return;
  }
  if (target.kind === "task") {
    store.setTab("tasks");
    store.setMore(null);
    return;
  }
  if (target.kind === "event") {
    store.setTab("calendar");
    store.setMore(null);
    return;
  }
  if (target.kind === "list") {
    store.setTab("lists");
    store.setMore(null);
    return;
  }
  store.setTab("more");
  store.setMore(target.kind === "note" ? "notes" : target.kind === "loyalty" ? "cards" : "album");
}

export function useOpenChatTarget(kind: ChatCardKind, onOpen: (target: ChatTarget) => void) {
  const target = useCouple((s) => s.chatTarget);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  useEffect(() => {
    if (!target || target.kind !== kind) return;
    useCouple.getState().setChatTarget(null);
    onOpenRef.current(target);
  }, [target, kind]);
}
