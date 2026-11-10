import { useEffect, useState } from "react";
import { authClient, clearBearerToken } from "@/lib/auth/client";
import { userMessage } from "@/lib/user-message";

function passwordError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  if (/invalid password/i.test(message)) return "Неверный текущий пароль";
  if (/too short/i.test(message)) return "Пароль слишком короткий";
  if (/too long/i.test(message)) return "Пароль слишком длинный";
  if (/credential account not found/i.test(message)) return "Для этой почты нет входа по паролю";
  return userMessage(error, "Не вышло сменить пароль");
}

export function PasswordSettings() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [revoke, setRevoke] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submit = async () => {
    if (next.length < 8) {
      setError("Пароль слишком короткий");
      return;
    }
    if (next !== again) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    setError("");
    const { error: fail } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revoke,
    });
    setBusy(false);
    if (fail) {
      setError(passwordError(fail));
      return;
    }
    if (revoke) clearBearerToken();
    setCurrent("");
    setNext("");
    setAgain("");
    setOpen(false);
    setToast(true);
  };

  return (
    <div className="mt-4 rounded-[22px] bg-raised px-5 py-5">
      <p className="text-[13px] text-muted">Пароль</p>
      {open ? (
        <div className="mt-3 space-y-2">
          <Field value={current} onChange={setCurrent} placeholder="Текущий пароль" autoComplete="current-password" />
          <Field value={next} onChange={setNext} placeholder="Новый пароль" autoComplete="new-password" />
          <Field value={again} onChange={setAgain} placeholder="Повторите пароль" autoComplete="new-password" />
          <label className="flex items-start gap-3 pt-1 text-[15px] leading-5">
            <input
              type="checkbox"
              checked={revoke}
              onChange={(event) => setRevoke(event.target.checked)}
              className="mt-1 size-4 shrink-0"
            />
            <span>Выйти на других устройствах</span>
          </label>
          {error ? <p className="text-[14px] leading-5 text-[#e07a72]">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-11 w-full rounded-full bg-cream py-3 text-[16px] font-semibold text-cream-fg disabled:opacity-40"
          >
            {busy ? "Сохраняем…" : "Сохранить пароль"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
          className="mt-3 min-h-11 w-full rounded-full bg-bg text-[16px] font-semibold"
        >
          Сменить пароль
        </button>
      )}
      {toast ? (
        <p className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-full bg-cream px-4 py-3 text-center text-[15px] font-semibold text-cream-fg">
          Пароль обновлён
        </p>
      ) : null}
    </div>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <input
      type="password"
      autoComplete={autoComplete}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 w-full rounded-2xl bg-bg px-4 text-[16px] outline-none"
    />
  );
}
