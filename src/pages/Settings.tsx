import { useSubjectNames } from "../hooks/useSubjectNames";
import { useSettings } from "../store/useSettings";

import { PageHeading } from "../components/UI";
import { DataSettings } from "../features/settings/DataSettings";
import { useState } from "react";
import type { StudySubject } from "../types";
import { SubjectEditor } from "../components/SubjectEditor";
export function SettingsPage() {
  const languages = useSubjectNames();
  const [addingSubject, setAddingSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<StudySubject>();
  const { settings: s, update } = useSettings();
  return (
    <div className="essential-settings">
      <PageHeading
        title="Настройки"
        description="Основные параметры обучения и ваша библиотека."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Обучение</h2>
          <label>
            Язык или тема
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
          <button
            className="button secondary"
            onClick={() => setAddingSubject(true)}
          >
            Добавить язык или тему
          </button>
          <div className="custom-subject-list">
            {s.customSubjects.map((subject) => (
              <div key={subject.id}>
                <span>
                  {subject.name}
                  <small>
                    {subject.kind === "topic" ? "Общая тема" : "Язык"}
                  </small>
                </span>
                <button
                  className="button secondary"
                  aria-label={`Редактировать ${subject.name}`}
                  onClick={() => setEditingSubject(subject)}
                >
                  Изменить
                </button>
              </div>
            ))}
          </div>
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
        </section>
        <section className="panel">
          <h2>Оформление</h2>
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
        <DataSettings />
      </div>
      {editingSubject && (
        <SubjectEditor
          subject={editingSubject}
          onClose={() => setEditingSubject(undefined)}
        />
      )}
      {addingSubject && (
        <SubjectEditor onClose={() => setAddingSubject(false)} />
      )}
      <p className="muted">
        Настройки сохраняются автоматически на этом устройстве.
      </p>
    </div>
  );
}
