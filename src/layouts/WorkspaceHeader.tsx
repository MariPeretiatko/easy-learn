import { emailInitial } from "../utils/profile";
import { useAccount, signOut } from "../cloud/auth";
import { perform } from "../store/useUI";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Layers,
  Folder,
  Search,
  Plus,
  Menu,
  Settings,
  Sun,
  Moon,
  BookOpen,
  Play,
} from "lucide-react";

import { useSettings } from "../store/useSettings";
import { useUI } from "../store/useUI";
import { SubjectEditor } from "../components/SubjectEditor";
export function WorkspaceHeader({
  onMenu,
  menuOpen,
}: {
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const user = useAccount((s) => s.user);
  const languages = useSubjectNames();
  const [addingSubject, setAddingSubject] = useState(false);
  const [dropdown, setDropdown] = useState<"create" | "profile" | null>(null);
  const [query, setQuery] = useState("");
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDropdown(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (
        !(e.target instanceof Element) ||
        !ref.current?.contains(e.target) ||
        !e.target.closest(".header-menu")
      )
        setDropdown(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdown(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <header className="topbar" ref={ref}>
      <button
        className="icon-button mobile-toggle"
        aria-label="Меню"
        aria-expanded={menuOpen}
        aria-controls="study-navigation"
        onClick={onMenu}
      >
        <Menu size={21} />
      </button>
      <form
        className="global-search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <button
          type="button"
          className="search-toggle"
          aria-label="Открыть поиск"
          onPointerDown={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
          onClick={() => searchRef.current?.focus()}
        >
          <Search size={20} />
        </button>
        <input
          ref={searchRef}
          aria-label="Глобальный поиск"
          placeholder="Колоды, модули, слова"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className="topbar-right">
        <select
          className="workspace-language"
          aria-label="Язык обучения"
          value={settings.learningLanguage}
          onChange={(event) => {
            if (event.target.value === "__add_subject__")
              setAddingSubject(true);
            else {
              update({
                learningLanguage: event.target
                  .value as typeof settings.learningLanguage,
              });
              const lists = [
                "/",
                "/latest",
                "/library",
                "/vocabulary",
                "/reader",
                "/videos",
                "/search",
                "/games",
                "/progress",
                "/settings",
              ];
              if (!lists.includes(location.pathname)) navigate("/library");
            }
          }}
        >
          {Object.entries(languages).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="__add_subject__">＋ Добавить язык или тему</option>
        </select>
        <div className="header-menu">
          <button
            className="button create-button"
            aria-label="Создать материал"
            aria-expanded={dropdown === "create"}
            onClick={() => setDropdown(dropdown === "create" ? null : "create")}
          >
            <Plus size={23} />
          </button>
          {dropdown === "create" && (
            <div className="header-dropdown create-dropdown">
              <Link to="/create-set">
                <Layers size={20} />
                Создать карточки
              </Link>
              <Link to="/library?tab=modules&new=course">
                <BookOpen size={20} />
                Модуль
              </Link>
              <Link to="/library?tab=folders&new=folder">
                <Folder size={20} />
                Папка
              </Link>
              <div className="dropdown-separator" />
              <button
                onClick={() => {
                  setDropdown(null);
                  useUI.getState().openWord();
                }}
              >
                <Plus size={18} />
                Добавить слово
              </button>
              <Link to="/reader?add=1">
                <BookOpen size={18} />
                Текст
              </Link>
              <Link to="/videos?add=1">
                <Play size={18} />
                Видео
              </Link>
            </div>
          )}
        </div>
        <div className="header-menu">
          <button
            className="avatar"
            aria-label={user ? "Мой профиль" : "Локальный режим"}
            aria-expanded={dropdown === "profile"}
            onClick={() =>
              setDropdown(dropdown === "profile" ? null : "profile")
            }
          >
            {emailInitial(user?.email)}
          </button>
          {dropdown === "profile" && (
            <div className="header-dropdown profile-dropdown">
              <div className="profile-heading">
                <strong>
                  {settings.profileName ||
                    user?.user_metadata.display_name ||
                    (user ? "Мой профиль" : "Локальный режим")}
                </strong>
                <small>{user?.email ?? "На этом устройстве"}</small>
              </div>
              {user && (
                <button onClick={() => void perform(signOut)}>Выйти</button>
              )}
              <Link to="/library">
                <Folder size={18} />
                Ваша библиотека
              </Link>
              <Link to="/settings">
                <Settings size={18} />
                Настройки
              </Link>
              <button
                onClick={() =>
                  update({
                    theme: settings.theme === "dark" ? "light" : "dark",
                  })
                }
              >
                {settings.theme === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}{" "}
                {settings.theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              </button>
            </div>
          )}
        </div>
      </div>
      {addingSubject && (
        <SubjectEditor onClose={() => setAddingSubject(false)} />
      )}
    </header>
  );
}
