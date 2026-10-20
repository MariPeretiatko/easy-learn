import { useState, type FormEvent } from "react";
import type { Video } from "../../types";
import { Modal } from "../../components/UI";
import { useSettings } from "../../store/useSettings";
import { languages, uid } from "../../utils/format";
import { VideoRepository } from "../../services/repositories";
import { parseSubtitles, youtubeId } from "./subtitles";
export function VideoEditor({
  video,
  onClose,
}: {
  video?: Video;
  onClose: () => void;
}) {
  const [v, setV] = useState<Video>(
    video ?? {
      id: uid(),
      youtubeId: "",
      url: "",
      title: "",
      language: useSettings.getState().settings.learningLanguage,
      subtitles: [],
      tags: [],
      lastPosition: 0,
      createdAt: Date.now(),
      favorite: false,
    },
  );
  const [subtitles, setSubtitles] = useState(
    video?.subtitles.length ? JSON.stringify(video.subtitles, null, 2) : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = youtubeId(v.url);
      if (!id) throw new Error("Введите корректную ссылку YouTube");
      const captions = parseSubtitles(subtitles);
      await VideoRepository.save({
        ...v,
        youtubeId: id,
        title: v.title.trim(),
        subtitles: captions,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={video ? "Видео и субтитры" : "Учиться на любимых видео"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <label>
          Ссылка YouTube
          <input
            type="url"
            required
            value={v.url}
            onChange={(e) => setV({ ...v, url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <div className="form-grid">
          <label>
            Название
            <input
              required
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </label>
          <label>
            Язык
            <select
              value={v.language}
              onChange={(e) =>
                setV({ ...v, language: e.target.value as Video["language"] })
              }
            >
              {Object.entries(languages).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="notice">
          Субтитры добавляются вручную или из файла SRT/VTT. Для перевода строк
          используйте поле <code>translation</code> в JSON. Автоматическая
          загрузка субтитров YouTube не подключена.
        </div>
        <label>
          Файл субтитров
          <input
            type="file"
            accept=".srt,.vtt,.json,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void file
                  .text()
                  .then(setSubtitles)
                  .catch(() => setError("Не удалось прочитать файл"));
            }}
          />
        </label>
        <label>
          Субтитры SRT, VTT или JSON
          <textarea
            rows={8}
            value={subtitles}
            onChange={(e) => setSubtitles(e.target.value)}
            placeholder={
              "1\n00:00:00,000 --> 00:00:04,000\nHallo! Heute lernen wir Deutsch."
            }
          />
        </label>
        <label>
          Теги
          <input
            value={v.tags.join(", ")}
            onChange={(e) =>
              setV({
                ...v,
                tags: e.target.value.split(",").map((t) => t.trim()),
              })
            }
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="button" disabled={busy || !v.title.trim()}>
            Сохранить видео
          </button>
        </div>
      </form>
    </Modal>
  );
}
