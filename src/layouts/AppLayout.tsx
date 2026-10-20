import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  House,
  Layers,
  BookOpen,
  Play,
  ChartNoAxesCombined,
  Settings,
  GraduationCap,
  X,
  LibraryBig,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSettings } from "../store/useSettings";
import { Toasts } from "../components/UI";
import { WordEditorHost } from "../features/vocabulary/WordEditor";
import { OfflineStatus } from "../components/OfflineStatus";
import { WorkspaceHeader } from "./WorkspaceHeader";
const navigation = [
  ["/", "Главная", House],
  ["/learn", "Практика", GraduationCap],
  ["/vocabulary", "Словарь", BookOpen],
  ["/decks", "Колоды", Layers],
  ["/reader", "Чтение", LibraryBig],
  ["/videos", "Видео", Play],
  ["/progress", "Прогресс", ChartNoAxesCombined],
] as const;
export function AppLayout() {
  const [mobile, setMobile] = useState(false);
  const { settings } = useSettings();
  const location = useLocation();
  useEffect(() => {
    setMobile(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  return (
    <div className="app-shell">
      <WorkspaceHeader onMenu={() => setMobile(true)} />
      <nav className="workspace-nav" aria-label="Основная навигация">
        <div>
          {navigation.map(([to, label, Icon]) => (
            <NavLink key={to} end={to === "/"} to={to}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/settings" className="settings-link">
            <Settings size={18} />
            <span>Настройки</span>
          </NavLink>
        </div>
      </nav>
      {mobile && (
        <>
          <button
            className="nav-overlay"
            aria-label="Закрыть меню"
            onClick={() => setMobile(false)}
          />
          <aside className="sidebar">
            <div className="drawer-heading">
              <Link to="/" className="brand">
                Easy<span>Learn</span>.
              </Link>
              <button
                className="icon-button"
                aria-label="Закрыть меню"
                onClick={() => setMobile(false)}
              >
                <X />
              </button>
            </div>
            <span className="nav-label">МОЁ ОБУЧЕНИЕ</span>
            <nav>
              {navigation.map(([to, label, Icon]) => (
                <NavLink key={to} end={to === "/"} to={to}>
                  <Icon size={21} />
                  {label}
                </NavLink>
              ))}
              <NavLink to="/settings">
                <Settings size={21} />
                Настройки
              </NavLink>
            </nav>
            <div className="local-note">
              Ваша библиотека хранится на этом устройстве
            </div>
          </aside>
        </>
      )}
      <div className="workspace">
        <OfflineStatus />
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <Link className="footer-brand" to="/">
            EasyLearn.
          </Link>
          <span>Учитесь так, как удобно вам.</span>
          <span>Ваша библиотека · На вашем устройстве</span>
        </footer>
      </div>
      <WordEditorHost />
      <Toasts />
    </div>
  );
}
