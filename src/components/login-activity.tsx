import { useEffect, useState } from "react";
import { finishLoginSession, finishOtherLoginSessions, loadLoginActivity } from "@/lib/login-server";
import { formatLoginWhen } from "@/lib/login-device";

type Activity = Awaited<ReturnType<typeof loadLoginActivity>>;

function line(item: { device: string; city: string | null; country: string | null; ip: string | null; createdAt: string }) {
  const place = item.city || item.country || "";
  return [item.device, place, item.ip ? `IP ${item.ip}` : "", formatLoginWhen(item.createdAt)].filter(Boolean).join(", ");
}

export function LoginActivity() {
  const [data, setData] = useState<Activity | null>(null);
  const [busy, setBusy] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);

  const reload = () => {
    void loadLoginActivity()
      .then(setData)
      .catch(() => setData({ active: [], history: [] }));
  };

  useEffect(() => {
    reload();
  }, []);

  const others = data?.active.filter((item) => !item.current) ?? [];

  return (
    <div className="mt-4 rounded-[22px] bg-raised px-5 py-5">
      <p className="text-[13px] text-muted">Активные входы</p>
      {!data ? <p className="mt-3 text-[15px] text-muted">Загрузка…</p> : null}
      {data?.active.length === 0 ? <p className="mt-3 text-[15px] text-muted">Нет активных входов</p> : null}
      <ul className="mt-2">
        {data?.active.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-words text-[15px] leading-5">
              {line(item)}
              {item.current ? <span className="mt-1 block text-[13px] text-muted">Это устройство</span> : null}
            </p>
            {item.current ? null : (
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => {
                  setBusy(item.id);
                  void finishLoginSession({ data: item.id })
                    .then(reload)
                    .finally(() => setBusy(""));
                }}
                className="min-h-11 shrink-0 rounded-full bg-bg px-4 text-[15px]"
              >
                Завершить
              </button>
            )}
          </li>
        ))}
      </ul>
      {confirmAll ? (
        <div className="mt-3 rounded-2xl bg-bg px-4 py-4">
          <p className="text-[15px] leading-5">Выйти на всех других устройствах? Этот останется в аккаунте.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmAll(false)}
              className="min-h-11 rounded-full border border-line text-[15px]"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={busy === "all"}
              onClick={() => {
                setBusy("all");
                void finishOtherLoginSessions()
                  .then(() => {
                    setConfirmAll(false);
                    reload();
                  })
                  .finally(() => setBusy(""));
              }}
              className="min-h-11 rounded-full bg-cream text-[15px] font-semibold text-cream-fg disabled:opacity-40"
            >
              Выйти
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!others.length}
          onClick={() => setConfirmAll(true)}
          className="mt-2 min-h-11 w-full rounded-full bg-bg text-[15px] font-semibold disabled:opacity-40"
        >
          Выйти со всех других устройств
        </button>
      )}
      <p className="mt-3 text-[13px] leading-5 text-muted">Не вы? Смените пароль</p>

      <p id="login-history" className="mt-6 text-[13px] text-muted">История входов</p>
      {data && data.history.length === 0 ? <p className="mt-3 text-[15px] text-muted">Пока пусто</p> : null}
      <ul className="mt-2">
        {data?.history.map((item) => (
          <li key={item.id} className="border-t border-line py-3 text-[15px] leading-5 break-words first:border-t-0">
            {line(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
