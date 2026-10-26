import { Eye, EyeOff, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  authClient,
  cloudConfigurationError,
  supabase,
} from "../../cloud/client";
import { authError, safeReturnTo, useAccount } from "../../cloud/auth";
import { completeEmailCallback } from "../../cloud/authCallback";
const exchanges = new Map<string, Promise<{ recovery: boolean }>>();
type Mode =
  "login" | "register" | "forgot-password" | "reset-password" | "callback";
export function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const tabs = useRef<HTMLElement>(null);
  const requestEpoch = useRef(0);
  const [indicatorX, setIndicatorX] = useState<number | null>(null);
  useLayoutEffect(() => {
    const nav = tabs.current;
    if (!nav) return;
    const update = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!active) {
        setIndicatorX(null);
        return;
      }
      const navBox = nav.getBoundingClientRect(),
        activeBox = active.getBoundingClientRect();
      setIndicatorX(activeBox.left - navBox.left + (activeBox.width - 28) / 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    nav.querySelectorAll("a").forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [mode]);
  useEffect(() => {
    requestEpoch.current++;
    setError("");
    setMessage("");
    setSent(false);
    setBusy(false);
    setResendAfter(0);
    return () => {
      requestEpoch.current++;
    };
  }, [mode]);
  const navigate = useNavigate(),
    location = useLocation();
  const recovery = useAccount((s) => s.recovery);
  const user = useAccount((s) => s.user);
  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get("next"),
  );
  useEffect(() => {
    if (mode !== "callback" || !supabase) return;
    const url = new URL(
      location.pathname + location.search + location.hash,
      window.location.origin,
    );
    const callbackKey = url.search + url.hash;
    let active = true;
    let exchange = exchanges.get(callbackKey);
    if (!exchange) {
      exchange = completeEmailCallback(supabase, url);
      exchanges.set(callbackKey, exchange);
    }
    // Remove credentials immediately, including failed links, from browser history.
    window.history.replaceState(window.history.state, "", url.pathname);
    void exchange
      .then(({ recovery: recovering }) => {
        if (!active) return;
        if (recovering) useAccount.setState({ recovery: true });
        navigate(
          recovering || useAccount.getState().recovery
            ? "/reset-password"
            : returnTo,
          { replace: true },
        );
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Не удалось подтвердить ссылку.",
          );
      });
    return () => {
      active = false;
    };
  }, [
    mode,
    location.pathname,
    location.search,
    location.hash,
    navigate,
    returnTo,
  ]);
  useEffect(() => {
    if (user && !recovery && (mode === "login" || mode === "register"))
      navigate(returnTo, { replace: true });
  }, [user, recovery, mode, navigate, returnTo]);
  const title = {
    login: "Войти",
    register: "Регистрация",
    "forgot-password": "Восстановить пароль",
    "reset-password": "Новый пароль",
    callback: "Подтверждение почты",
  }[mode];
  const callback = `${window.location.origin}/auth/callback`;
  async function submit() {
    const epoch = requestEpoch.current;
    setError("");
    setMessage("");
    if (mode === "register" && !name.trim()) {
      setError("Введите имя.");
      return;
    }
    if (mode === "reset-password" && password !== confirmation) {
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
        if (epoch !== requestEpoch.current) return;
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
        if (epoch !== requestEpoch.current) return;
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
        if (epoch !== requestEpoch.current) return;
        if (error) throw error;
        setMessage(
          "Если для этого адреса доступно восстановление, вы получите письмо с инструкцией.",
        );
      } else if (mode === "reset-password") {
        if (!recovery) throw new Error("recovery required");
        const { error } = await client.auth.updateUser({ password });
        if (epoch !== requestEpoch.current) return;
        if (error) throw error;
        useAccount.setState({ recovery: false });
        setPassword("");
        setConfirmation("");
        navigate("/settings", { replace: true });
      }
    } catch (e) {
      if (epoch === requestEpoch.current) setError(authError(e));
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  }
  const loginURL = `/login?next=${encodeURIComponent(returnTo)}`;
  const registerURL = `/register?next=${encodeURIComponent(returnTo)}`;
  const standardForm = mode === "login" || mode === "register";
  return (
    <main className={`auth-screen auth-entry auth-entry--${mode}`}>
      <aside className="auth-visual" aria-label="Easy Learn">
        <picture>
          <source media="(min-width: 901px)" srcSet="/images/auth-study.webp" />
          <img
            className="auth-visual-image"
            src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
            alt=""
            fetchPriority="high"
          />
        </picture>
        <h2 className="auth-visual-headline">
          <span className="auth-headline-copy" key={mode}>
            {mode === "register" ? (
              <>
                Лучший способ учиться.
                <br />
                Начните бесплатно.
              </>
            ) : (
              <>
                Учитесь с комфортом.
                <br />В своём ритме.
              </>
            )}
          </span>
        </h2>
        <span className="auth-visual-brand">Easy Learn</span>
      </aside>
      <div className="auth-form-panel">
        <button
          className="auth-close"
          type="button"
          aria-label="Закрыть"
          title="Вернуться назад"
          disabled={window.history.length < 2}
          onClick={() => navigate(-1)}
        >
          <X size={23} strokeWidth={1.8} />
        </button>
        <section className="auth-card" aria-labelledby="auth-title">
          <Link className="auth-mobile-brand" to={loginURL}>
            Easy Learn
          </Link>
          <nav ref={tabs} className="auth-tabs" aria-label="Вход и регистрация">
            <Link
              to={registerURL}
              aria-current={mode === "register" ? "page" : undefined}
            >
              Регистрация
            </Link>
            <Link
              to={loginURL}
              aria-current={mode === "login" ? "page" : undefined}
            >
              Вход
            </Link>
            <span
              className="auth-tabs-indicator"
              aria-hidden="true"
              style={{
                transform: `translateX(${indicatorX ?? 0}px)`,
                opacity: indicatorX === null ? 0 : 1,
              }}
            />
          </nav>
          <h1
            id="auth-title"
            className={
              standardForm ? "auth-title-visually-hidden" : "auth-title"
            }
          >
            {title}
          </h1>
          {cloudConfigurationError && (
            <p className="auth-notice">{cloudConfigurationError}</p>
          )}
          {message && (
            <p className="auth-notice auth-notice--success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="auth-notice auth-notice--error" role="alert">
              {error}
            </p>
          )}
          {mode === "reset-password" && !recovery && (
            <p className="auth-notice" role="alert">
              Откройте действительную ссылку восстановления из письма.
            </p>
          )}
          {mode !== "callback" && !sent && (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="auth-form-fields">
                {standardForm && (
                  <div
                    className="auth-name-slot"
                    inert={mode !== "register"}
                    aria-hidden={mode !== "register"}
                  >
                    <div className="auth-name-inner">
                      <div className="auth-field">
                        <label htmlFor="auth-name">Имя</label>
                        <input
                          id="auth-name"
                          name="name"
                          required={mode === "register"}
                          disabled={mode !== "register"}
                          maxLength={80}
                          autoComplete="name"
                          placeholder="Ваше имя"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {mode !== "reset-password" && (
                  <div className="auth-field">
                    <label htmlFor="auth-email">Email</label>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      placeholder="user@email.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                )}
                {mode !== "forgot-password" && (
                  <>
                    <PasswordField
                      label="Пароль"
                      value={password}
                      onChange={setPassword}
                      newPassword={mode !== "login"}
                      recoveryURL={
                        mode === "login"
                          ? `/forgot-password?next=${encodeURIComponent(returnTo)}`
                          : undefined
                      }
                    />
                    {mode === "reset-password" && (
                      <PasswordField
                        label="Повторите пароль"
                        value={confirmation}
                        onChange={setConfirmation}
                        newPassword
                      />
                    )}
                  </>
                )}
              </div>
              <button
                className="auth-primary button"
                disabled={
                  busy || !supabase || (mode === "reset-password" && !recovery)
                }
              >
                <span className="auth-action-label" key={mode}>
                  {busy ? "Подождите…" : title}
                </span>
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
                const epoch = requestEpoch.current;
                setBusy(true);
                setError("");
                void authClient()
                  .auth.resend({
                    type: "signup",
                    email: email.trim(),
                    options: { emailRedirectTo: callback },
                  })
                  .then(({ error }) => {
                    if (epoch !== requestEpoch.current) return;
                    if (error) setError(authError(error));
                    else {
                      setResendAfter(Date.now() + 60000);
                      setMessage(
                        "Письмо отправлено повторно. Проверьте почту.",
                      );
                    }
                  })
                  .catch((e) => {
                    if (epoch === requestEpoch.current) setError(authError(e));
                  })
                  .finally(() => {
                    if (epoch === requestEpoch.current) setBusy(false);
                  });
              }}
            >
              Отправить письмо ещё раз
            </button>
          )}

          <nav className="auth-alternative" aria-label="Аккаунт">
            {mode !== "login" && (
              <Link className="auth-secondary" to={loginURL}>
                <span className="auth-action-label" key={mode}>
                  Уже есть аккаунт? Войти
                </span>
              </Link>
            )}
            {mode !== "register" && (
              <Link className="auth-secondary" to={registerURL}>
                <span className="auth-action-label" key={mode}>
                  Новый аккаунт? Создать аккаунт
                </span>
              </Link>
            )}
          </nav>
        </section>
      </div>
    </main>
  );
}
function PasswordField({
  label,
  value,
  onChange,
  newPassword = false,
  recoveryURL,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  newPassword?: boolean;
  recoveryURL?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const confirmation = label === "Повторите пароль";
  return (
    <div className="auth-field">
      <div className="auth-field-heading">
        <label htmlFor={id}>{label}</label>
        {recoveryURL && <Link to={recoveryURL}>Забыли пароль?</Link>}
      </div>
      <div className="auth-password-control">
        <input
          id={id}
          name={confirmation ? "password-confirmation" : "password"}
          type={visible ? "text" : "password"}
          required
          minLength={newPassword ? 8 : 1}
          maxLength={128}
          autoComplete={newPassword ? "new-password" : "current-password"}
          placeholder={newPassword ? "Не менее 8 символов" : "Введите пароль"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="auth-password-toggle"
          type="button"
          aria-pressed={visible}
          aria-label={`${visible ? "Скрыть" : "Показать"} ${confirmation ? "повтор пароля" : "пароль"}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff size={20} strokeWidth={2} />
          ) : (
            <Eye size={20} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
