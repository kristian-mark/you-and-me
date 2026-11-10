import { useEffect, useState } from "react";
import { loadLoginNotice } from "@/lib/login-server";
import { formatLoginWhen, loginBannerText } from "@/lib/login-device";
import { authEnabled } from "@/lib/auth/client";

type Notice = Awaited<ReturnType<typeof loadLoginNotice>>[number];

/** Other sessions only. Runs on open and when the tab becomes visible, not on the game poll. */
export function LoginNotice() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    if (!authEnabled) return;
    let stop = false;
    let timer = 0;
    const load = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadLoginNotice()
          .then((rows) => {
            if (!stop && rows.length) setItems(rows);
          })
          .catch(() => undefined);
      }, 400);
    };
    load();
    const onShow = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-lg flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-[22px] bg-raised px-4 py-3 shadow-lg">
          <p className="text-[14px] leading-5 break-words">
            {loginBannerText({
              device: item.device,
              city: item.city,
              country: item.country,
              ip: item.ip,
              when: formatLoginWhen(item.createdAt),
            })}
          </p>
          <button
            type="button"
            onClick={() => setItems((list) => list.filter((row) => row.id !== item.id))}
            className="mt-2 min-h-11 text-[14px] text-muted"
          >
            Скрыть
          </button>
        </div>
      ))}
    </div>
  );
}
