import { CloudStatus } from "../features/auth/CloudStatus";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  Blocks,
  Layers,
  BookOpen,
  Play,
  ChartNoAxesCombined,
  Settings,
  X,
  Folder,
  BookOpenCheck,
  RotateCcw,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "../store/useSettings";
import { Toasts } from "../components/UI";
import { WordEditorHost } from "../features/vocabulary/WordEditor";
import { OfflineStatus } from "../components/OfflineStatus";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { useData } from "../hooks/useData";
import { recentStudyItems } from "../services/recent";
const studyLinks = [
  ["/create-set", "Создать карточки", Layers],
  ["/learn?mode=flashcards", "Карточки", Layers],
  ["/games", "Игры", Blocks],
  ["/vocabulary", "Словарь", BookOpen],
  ["/learn?mode=review", "Повторение", RotateCcw],
  ["/reader", "Чтение", BookOpenCheck],
  ["/videos", "Видео", Play],
  ["/progress", "Прогресс", ChartNoAxesCombined],
] as const;
export function AppLayout() {
  const data = useData(["recent", "decks", "collections"]);
  const recent = data ? recentStudyItems(data) : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSettings((s) => s.settings);
  const location = useLocation();
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    if (!menuOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      sidebar.current
        ?.querySelector<HTMLElement>("button, a")
        ?.focus({ preventScroll: true }),
    );
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key === "Tab") {
        const elements = sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key);
      if (sidebar.current?.contains(document.activeElement))
        trigger?.focus({ preventScroll: true });
    };
  }, [menuOpen]);
  return (
    <div
      className={`app-shell quizlet-shell fixed-workspace ${/autosaved|create-set/.test(location.pathname) ? "editor-shell" : ""}`}
    >
      <WorkspaceHeader
        menuOpen={menuOpen}
        onMenu={() => setMenuOpen((open) => !open)}
      />
      <button
        className={`workspace-scrim ${menuOpen ? "is-open" : ""}`}
        aria-label="Закрыть боковую панель"
        tabIndex={-1}
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        ref={sidebar}
        id="study-navigation"
        className={`study-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Основная навигация"
        inert={!menuOpen}
        aria-hidden={!menuOpen}
      >
        <div className="drawer-heading">
          <strong>Ваше обучение</strong>
          <button
            className="icon-button"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <div className="sidebar-scroll">
          <nav aria-label="Разделы">
            <NavLink to="/" end>
              <Home size={21} />
              <span>Главная</span>
            </NavLink>
            <NavLink to="/library">
              <Folder size={21} />
              <span>Библиотека</span>
            </NavLink>
          </nav>
          <hr className="sidebar-divider" />
          <span className="nav-label">Учебные инструменты</span>
          <nav aria-label="Учебные инструменты">
            {studyLinks.map(([to, title, Icon]) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => {
                  const active = to.includes("mode=review")
                    ? location.pathname === "/learn" &&
                      location.search.includes("mode=review")
                    : to === "/create-set"
                      ? /create-set|autosaved/.test(location.pathname)
                      : to.includes("mode=flashcards")
                        ? location.pathname === "/learn" &&
                          location.search.includes("mode=flashcards")
                        : isActive;
                  return active ? "active" : "";
                }}
              >
                <Icon size={21} />
                <span>{title}</span>
              </NavLink>
            ))}
          </nav>
          <hr className="sidebar-divider" />
          <span className="nav-label">Недавно открытые</span>
          <nav aria-label="Недавно открытые">
            {recent.map((item) => (
              <NavLink key={item.key} to={item.to} title={item.title}>
                {item.kind === "modules" ? (
                  <BookOpen size={20} />
                ) : (
                  <Layers size={20} />
                )}
                <span className="recent-title">{item.title}</span>
              </NavLink>
            ))}
          </nav>
          {!recent.length && (
            <p className="sidebar-empty">
              Здесь появятся последние 5 модулей или колод.
            </p>
          )}
        </div>
        <nav className="sidebar-settings">
          <NavLink to="/settings">
            <Settings size={21} />
            <span>Настройки</span>
          </NavLink>
        </nav>
      </aside>
      <div className="workspace">
        <OfflineStatus />
        <CloudStatus />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <WordEditorHost />
      <Toasts />
    </div>
  );
}
