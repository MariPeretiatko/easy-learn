import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Layers,
  GraduationCap,
  ClipboardCheck,
  Puzzle,
  BookOpen,
  LibraryBig,
  Play,
  Search,
  Plus,
  Menu,
} from "lucide-react";
import { useSettings } from "../store/useSettings";
import { useUI } from "../store/useUI";
import { languages } from "../utils/format";
export function WorkspaceHeader({ onMenu }: { onMenu: () => void }) {
  const [dropdown, setDropdown] = useState<"tools" | "library" | null>(null);
  const [query, setQuery] = useState("");
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setDropdown(null);
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
  const links =
    dropdown === "tools"
      ? ([
          ["/learn?mode=learn", "Заучивание", GraduationCap],
          ["/learn?mode=flashcards", "Карточки", Layers],
          ["/learn?mode=test", "Тест", ClipboardCheck],
          ["/learn?mode=match", "Подбор пар", Puzzle],
        ] as const)
      : ([
          ["/vocabulary", "Словарь", BookOpen],
          ["/decks", "Колоды", Layers],
          ["/reader", "Тексты", LibraryBig],
          ["/videos", "Видео", Play],
        ] as const);
  return (
    <header className="topbar" ref={ref}>
      <button
        className="icon-button mobile-toggle"
        aria-label="Меню"
        onClick={onMenu}
      >
        <Menu size={23} />
      </button>
      <Link to="/" className="brand" aria-label="Easy Learn — главная">
        Easy<span>Learn</span>
        <span className="brand-dot">.</span>
      </Link>
      <div className="header-menus">
        {(["tools", "library"] as const).map((id) => (
          <div className="header-menu" key={id}>
            <button
              aria-expanded={dropdown === id}
              onClick={() => setDropdown(dropdown === id ? null : id)}
            >
              {id === "tools" ? "Учебные инструменты" : "Моя библиотека"}
              <ChevronDown size={15} />
            </button>
            {dropdown === id && (
              <div className="header-dropdown">
                {links.map(([to, label, Icon]) => (
                  <Link key={to} to={to} onClick={() => setDropdown(null)}>
                    <Icon size={19} />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
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
          onPointerDown={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          onClick={() => searchRef.current?.focus()}
        >
          <Search size={20} />
        </button>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти слова, колоды, тексты…"
          aria-label="Глобальный поиск"
        />
      </form>
      <div className="topbar-right">
        <label className="language-select">
          <select
            aria-label="Язык обучения"
            value={settings.learningLanguage}
            onChange={(e) =>
              update({
                learningLanguage: e.target
                  .value as typeof settings.learningLanguage,
              })
            }
          >
            {Object.entries(languages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button compact create-button"
          aria-label="Добавить слово"
          onClick={() => useUI.getState().openWord()}
        >
          <Plus size={19} />
          <span>Создать</span>
        </button>
        <Link className="avatar" to="/settings" aria-label="Мой профиль">
          М
        </Link>
      </div>
    </header>
  );
}
