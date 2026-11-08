import { useState, useSyncExternalStore } from "react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";

function subscribeToNothing() {
  return () => undefined;
}

/**
 * Account sign-out, separate from leaving the pair. Hidden when auth is off
 * and when the session is only a Grok gate session (signing out would sign
 * straight back in).
 */
export function AccountLogoutButton() {
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, () => false);
  if (gateSession) return null;
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          setFailed(false);
          void signOut().catch(() => {
            setSigningOut(false);
            setFailed(true);
          });
        }}
        className="min-h-11 w-full rounded-full border border-line text-[16px] font-semibold"
      >
        {signingOut ? "Выходим…" : "Выйти из аккаунта"}
      </button>
      <p className="mt-2 text-center text-[13px] text-[#e6e1d6]">
        {failed ? "Не вышло выйти — попробуй ещё раз." : "Закроется только этот аккаунт. Пара и общие данные останутся."}
      </p>
    </div>
  );
}
