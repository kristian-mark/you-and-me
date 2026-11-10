import { useEffect, useRef, useState } from "react";
import { dismissLoginNotice, loadLoginNotice } from "@/lib/login-server";
import { formatLoginWhen, loginBannerText, loginDetailText, loginGroupTitle } from "@/lib/login-device";
import { authEnabled } from "@/lib/auth/client";

type Notice = Awaited<ReturnType<typeof loadLoginNotice>>[number];

/** Other sessions only, and only logins newer than this one. Open and focus, not the game poll. */
export function LoginNotice({
  onOpenHistory,
  className = "px-5 pt-3",
}: {
  onOpenHistory?: () => void;
  className?: string;
}) {
  const [items, setItems] = useState<Notice[]>([]);
  const hidden = useRef(new Set<string>());

  useEffect(() => {
    if (!authEnabled) return;
    let stop = false;
    let timer = 0;
    const load = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadLoginNotice()
          .then((rows) => {
            if (stop) return;
            setItems(rows.filter((row) => !hidden.current.has(row.id)));
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
  const latest = items[0];
  const when = formatLoginWhen(latest.createdAt);
  const detail = { device: latest.device, city: latest.city, country: latest.country, ip: latest.ip, when };
  const hide = () => {
    const ids = items.map((item) => item.id);
    ids.forEach((id) => hidden.current.add(id));
    setItems([]);
    void dismissLoginNotice({ data: ids }).catch(() => undefined);
  };

  return (
    <div className={className}>
      <div className="rounded-[22px] bg-raised px-4 py-3">
        <p className="text-[15px] leading-5 font-semibold break-words">
          {items.length > 1 ? loginGroupTitle(items.length) : loginBannerText(detail)}
        </p>
        {items.length > 1 ? <p className="mt-1 text-[14px] leading-5 break-words text-[#e6e1d6]">{loginDetailText(detail)}</p> : null}
        <div className="mt-1 flex flex-wrap gap-x-4">
          {items.length > 1 && onOpenHistory ? (
            <button
              type="button"
              onClick={() => {
                hide();
                onOpenHistory();
              }}
              className="min-h-11 text-[15px] text-cream"
            >
              Подробнее
            </button>
          ) : null}
          <button type="button" onClick={hide} className="min-h-11 text-[15px] text-muted">
            Скрыть
          </button>
        </div>
      </div>
    </div>
  );
}
