import { useSettings } from "../store/useSettings";
import { languages } from "../utils/format";
import { PageHeading } from "../components/UI";
import { DataSettings } from "../features/settings/DataSettings";
export function SettingsPage() {
  const { settings: s, update } = useSettings();
  return (
    <>
      <PageHeading
        eyebrow="КАК ВАМ УДОБНО"
        title="Настройки"
        description="Ваш язык, ваши цели, ваш ритм."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Языки</h2>
          <label>
            Язык обучения
            <select
              value={s.learningLanguage}
              onChange={(e) =>
                update({
                  learningLanguage: e.target.value as typeof s.learningLanguage,
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
          <label>
            Родной язык
            <select
              value={s.nativeLanguage}
              onChange={(e) => update({ nativeLanguage: e.target.value })}
            >
              <option value="ru">Русский</option>
              <option value="en">Английский</option>
              <option value="de">Немецкий</option>
              <option value="uk">Украинский</option>
            </select>
          </label>
        </section>
        <section className="panel">
          <h2>Ежедневные цели</h2>
          {(
            [
              ["newWordsGoal", "Новых слов"],
              ["reviewsGoal", "Повторений"],
              ["minutesGoal", "Минут практики"],
            ] as const
          ).map(([key, title]) => (
            <label key={key}>
              {title}
              <input
                type="number"
                min="1"
                max="1000"
                value={s[key]}
                onChange={(e) =>
                  update({
                    [key]: Math.max(1, Math.min(1000, Number(e.target.value))),
                  })
                }
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>Практика и оформление</h2>
          <label>
            Направление карточек
            <select
              value={s.direction}
              onChange={(e) =>
                update({ direction: e.target.value as typeof s.direction })
              }
            >
              <option value="forward">Слово → перевод</option>
              <option value="reverse">Перевод → слово</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.autoPronounce}
              onChange={(e) => update({ autoPronounce: e.target.checked })}
            />
            Автоматическое произношение
          </label>
          <label>
            Тема
            <select
              value={s.theme}
              onChange={(e) =>
                update({ theme: e.target.value as typeof s.theme })
              }
            >
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
              <option value="system">Как в системе</option>
            </select>
          </label>
        </section>
        <section className="panel">
          <h2>Комфортное чтение</h2>
          <label>
            Размер шрифта: {s.fontSize}px
            <input
              type="range"
              min="16"
              max="32"
              value={s.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label>
            Высота строки: {s.lineHeight}
            <input
              type="range"
              min="1.4"
              max="2.5"
              step="0.1"
              value={s.lineHeight}
              onChange={(e) => update({ lineHeight: Number(e.target.value) })}
            />
          </label>
          <label>
            Ширина текста: {s.textWidth}px
            <input
              type="range"
              min="480"
              max="1000"
              step="20"
              value={s.textWidth}
              onChange={(e) => update({ textWidth: Number(e.target.value) })}
            />
          </label>
        </section>
        <DataSettings />
      </div>
      <p className="muted">
        Настройки сохраняются автоматически на этом устройстве.
      </p>
    </>
  );
}
