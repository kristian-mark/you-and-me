import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.2 3-7.2 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.7 8 22 12 22z" />
      <path fill="#FBBC05" d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 9 2 10.4 2 12s.3 3 1 4.4l3.2-2.6z" />
      <path fill="#4285F4" d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2 8 2 4.6 4.3 2.9 7.6l3.3 2.6C7 7.6 9.3 5.8 12 5.8z" />
    </svg>
  );
}

function Field({
  type,
  value,
  onChange,
  placeholder,
}: {
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full bg-transparent px-1 text-[17px] outline-none placeholder:text-muted"
    />
  );
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const google = GROK_PROVIDERS.find((p) => p.idp === "google");

  const submitEmail = async () => {
    if (!email.trim() || password.length < 8) {
      setError("Почта и пароль от 8 символов");
      return;
    }
    if (mode === "up" && password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    setError("");
    const run =
      mode === "up"
        ? authClient.signUp.email({ email: email.trim(), password, name: email.split("@")[0] ?? "я" })
        : authClient.signIn.email({ email: email.trim(), password });
    const { error: fail } = await run;
    setBusy(false);
    if (fail) {
      setError(fail.message ?? "Не вышло");
      return;
    }
    void navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-14">
      <div className="flex items-center gap-2">
        <span className="relative h-4 w-7">
          <span className="absolute top-0 left-0 size-4 rounded-full bg-blue" />
          <span className="absolute top-0 right-0 size-4 rounded-full bg-pink" />
        </span>
        <p className="text-[12px] tracking-[0.18em] text-muted uppercase">только двое</p>
      </div>
      <h1 className="mt-5 text-[40px] font-semibold tracking-tight">Мы</h1>
      <p className="mt-2 max-w-[260px] text-[16px] leading-6 text-muted">Войди — после этого появится твой постоянный код.</p>

      {authEnabled ? (
        <div className="mt-10 flex flex-1 flex-col">
          {google ? (
            <button
              type="button"
              onClick={() => void signIn(google.providerId, { callbackURL: "/" })}
              className="flex h-14 items-center justify-center rounded-[22px] bg-raised"
              aria-label="Войти через Google"
            >
              <GoogleMark />
            </button>
          ) : null}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] tracking-[0.16em] text-muted uppercase">почта</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="rounded-[24px] bg-raised px-4">
            <Field type="email" value={email} onChange={setEmail} placeholder="Почта" />
            <div className="h-px bg-line" />
            <Field type="password" value={password} onChange={setPassword} placeholder="Пароль" />
            {mode === "up" ? (
              <>
                <div className="h-px bg-line" />
                <Field type="password" value={confirm} onChange={setConfirm} placeholder="Повтори пароль" />
              </>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-[14px] text-[#e07a72]">{error}</p> : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submitEmail()}
            className="mt-5 h-14 w-full rounded-full bg-cream text-[17px] font-semibold text-cream-fg disabled:opacity-40"
          >
            {mode === "up" ? "Создать аккаунт" : "Войти"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "up" ? "in" : "up");
              setError("");
            }}
            className="mt-3 h-12 w-full text-[15px] text-muted"
          >
            {mode === "up" ? "Уже есть аккаунт" : "Нет аккаунта — создать"}
          </button>
        </div>
      ) : (
        <p className="mt-10 text-muted">Вход выключен.</p>
      )}
    </main>
  );
}
