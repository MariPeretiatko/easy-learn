import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  authClient,
  cloudConfigurationError,
  supabase,
} from "../../cloud/client";
import { authError, safeReturnTo, useAccount } from "../../cloud/auth";
const exchanges = new Map<
  string,
  ReturnType<ReturnType<typeof authClient>["auth"]["exchangeCodeForSession"]>
>();
type Mode =
  "login" | "register" | "forgot-password" | "reset-password" | "callback";
export function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const navigate = useNavigate(),
    location = useLocation();
  const recovery = useAccount((s) => s.recovery);
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get("next"),
  );
  useEffect(() => {
    if (mode !== "callback" || !supabase) return;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code || params.has("error")) {
      setError("Ссылка недействительна или истекла. Запросите новое письмо.");
      return;
    }
    let active = true;
    // Strip the authorization code from history as soon as it has been consumed.
    let exchange = exchanges.get(code);
    if (!exchange) {
      exchange = supabase.auth.exchangeCodeForSession(code);
      exchanges.set(code, exchange);
    }
    void exchange.then(({ error }) => {
      if (!active) return;
      if (error)
        setError("Ссылка недействительна или истекла. Запросите новое письмо.");
      else
        navigate(
          params.get("type") === "recovery" || useAccount.getState().recovery
            ? "/reset-password"
            : returnTo,
          { replace: true },
        );
    });
    return () => {
      active = false;
    };
  }, [mode, location.search, navigate, returnTo]);
  const title = {
    login: "Войти",
    register: "Регистрация",
    "forgot-password": "Восстановить пароль",
    "reset-password": "Новый пароль",
    callback: "Подтверждение почты",
  }[mode];
  const callback = `${window.location.origin}/auth/callback`;
  async function submit() {
    setError("");
    setMessage("");
    if (mode === "register" && !name.trim()) {
      setError("Введите имя.");
      return;
    }
    if (
      (mode === "register" || mode === "reset-password") &&
      password !== confirmation
    ) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      const client = authClient();
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate(returnTo, { replace: true });
      } else if (mode === "register") {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: callback,
          },
        });
        if (error) throw error;
        setPassword("");
        setConfirmation("");
        if (data.session) navigate(returnTo, { replace: true });
        else {
          setSent(true);
          setResendAfter(Date.now() + 60000);
          setMessage("Проверьте почту и подтвердите адрес по ссылке в письме.");
        }
      } else if (mode === "forgot-password") {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${callback}?type=recovery` },
        );
        if (error) throw error;
        setMessage(
          "Если для этого адреса доступно восстановление, вы получите письмо с инструкцией.",
        );
      } else if (mode === "reset-password") {
        if (!recovery) throw new Error("recovery required");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        useAccount.setState({ recovery: false });
        setPassword("");
        setConfirmation("");
        navigate("/settings", { replace: true });
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page panel">
      <h1>{title}</h1>
      {cloudConfigurationError && (
        <p className="notice">{cloudConfigurationError}</p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {mode === "reset-password" && !recovery && (
        <p role="alert">
          Откройте действительную ссылку восстановления из письма.
        </p>
      )}
      {mode !== "callback" && !sent && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "register" && (
            <label>
              Имя
              <input
                required
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset-password" && (
            <label>
              Email
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "forgot-password" && (
            <>
              <label>
                Пароль
                <input
                  type={visible ? "text" : "password"}
                  required
                  minLength={mode === "login" ? 1 : 8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {mode !== "login" && (
                <label>
                  Повторите пароль
                  <input
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Показать пароль
              </label>
              {mode !== "login" && <p className="hint">Не менее 8 символов.</p>}
            </>
          )}
          <button
            className="button"
            disabled={
              busy || !supabase || (mode === "reset-password" && !recovery)
            }
          >
            {busy ? "Подождите…" : title}
          </button>
        </form>
      )}
      {sent && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (Date.now() < resendAfter) {
              setError("Повторное письмо можно запросить через минуту.");
              return;
            }
            setBusy(true);
            setError("");
            void authClient()
              .auth.resend({
                type: "signup",
                email: email.trim(),
                options: { emailRedirectTo: callback },
              })
              .then(({ error }) => {
                if (error) setError(authError(error));
                else {
                  setResendAfter(Date.now() + 60000);
                  setMessage("Письмо отправлено повторно. Проверьте почту.");
                }
              })
              .catch((e) => setError(authError(e)))
              .finally(() => setBusy(false));
          }}
        >
          Отправить письмо ещё раз
        </button>
      )}
      <nav aria-label="Аккаунт">
        {mode !== "login" && <Link to="/login">Уже есть аккаунт? Войти</Link>}
        {mode !== "register" && <Link to="/register">Создать аккаунт</Link>}
        {mode === "login" && <Link to="/forgot-password">Забыли пароль?</Link>}
        <Link to="/library">Локальная библиотека</Link>
      </nav>
    </div>
  );
}
