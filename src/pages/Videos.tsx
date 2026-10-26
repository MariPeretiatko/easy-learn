import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  Star,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform } from "../store/useUI";
import {
  Confirm,
  Empty,
  Loading,
  PageHeading,
  SearchInput,
} from "../components/UI";
import { VideoRepository, remember } from "../services/repositories";
import { VideoEditor } from "../features/youtube/VideoEditor";
import { useYouTube } from "../features/youtube/useYouTube";
import {
  InteractiveText,
  wordStatusLookup,
} from "../features/reader/InteractiveText";
import { WordPopup } from "../features/reader/WordPopup";
import { timeLabel } from "../utils/format";
import { Listening } from "../features/youtube/Listening";
import { useStudyTimer } from "../hooks/useStudyTimer";
import type { Video } from "../types";
export function VideosLibrary() {
  const data = useData(["videos", "words"]);
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<Video>();
  const [remove, setRemove] = useState<Video | null>(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const language = useSettings((s) => s.settings.learningLanguage);
  if (!data) return <Loading />;
  const videos = data.videos.filter(
    (v) =>
      v.language === language &&
      (!favorites || v.favorite) &&
      `${v.title} ${v.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="СМОТРИТЕ. СЛУШАЙТЕ. ПОНИМАЙТЕ."
        title="Моя видеотека"
        description="Любимые темы на языке, который вы изучаете."
        actions={
          <button className="button" onClick={() => setParams({ add: "1" })}>
            <Plus size={17} />
            Добавить видео
          </button>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Найти видео"
        />
        <button
          className={`button ${favorites ? "" : "secondary"}`}
          onClick={() => setFavorites(!favorites)}
        >
          <Star size={15} />
          Избранное
        </button>
      </div>
      {videos.length ? (
        <div className="card-grid">
          {videos.map((v) => (
            <article className="library-card video-card" key={v.id}>
              <Link className="video-thumbnail" to={`/videos/${v.id}`}>
                <img
                  src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                  alt={v.title}
                  loading="lazy"
                />
                <span>
                  <Play size={24} />
                </span>
              </Link>
              <div className="card-top">
                <span className="badge">
                  {v.language.toUpperCase()} · {v.subtitles.length} строк
                </span>
                <button
                  className={`icon-button ${v.favorite ? "active" : ""}`}
                  aria-label="Избранное видео"
                  onClick={() =>
                    void perform(() =>
                      VideoRepository.save({ ...v, favorite: !v.favorite }),
                    )
                  }
                >
                  <Star size={16} fill={v.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <Link to={`/videos/${v.id}`}>
                <h3>{v.title}</h3>
              </Link>
              <p>
                Продолжить с {timeLabel(v.lastPosition)} ·{" "}
                {data.words.filter((w) => w.sourceId === v.id).length} слов
                сохранено
              </p>
              <div className="card-footer">
                <Link to={`/videos/${v.id}`}>
                  Смотреть <ArrowRight size={14} />
                </Link>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label="Редактировать видео"
                    onClick={() => setEdit(v)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Удалить видео"
                    onClick={() => setRemove(v)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Интересное видео — уже урок"
          description="Добавьте ссылку YouTube и субтитры, чтобы сохранять слова прямо из видео."
          action={
            <button className="button" onClick={() => setParams({ add: "1" })}>
              Добавить первое видео
            </button>
          }
        />
      )}
      {(params.has("add") || edit) && (
        <VideoEditor
          video={edit}
          onClose={() => {
            setEdit(undefined);
            setParams({});
          }}
        />
      )}
      {remove && (
        <Confirm
          title="Удалить видео?"
          description="Сохранённые слова останутся в словаре."
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void perform(async () => {
              await VideoRepository.delete(remove.id);
              setRemove(null);
            }, "Видео удалено")
          }
        />
      )}
    </>
  );
}
export function VideoPage() {
  const { id } = useParams();
  const data = useData(["videos"]);
  if (!data) return <Loading />;
  const video = data.videos.find((v) => v.id === id);
  if (!video)
    return (
      <Empty
        title="Видео не найдено"
        description="Вернитесь в видеотеку."
        action={
          <Link to="/videos" className="button">
            Видеотека
          </Link>
        }
      />
    );
  return <VideoWorkspace key={video.id} video={video} />;
}
function VideoWorkspace({ video }: { video: Video }) {
  const words = useLiveQuery(
    () => db.words.where("language").equals(video.language).toArray(),
    [video.language],
  );
  const vocabulary = useMemo(() => wordStatusLookup(words ?? []), [words]);
  const yt = useYouTube(
    video.youtubeId,
    video.lastPosition,
    (t) => void perform(() => VideoRepository.position(video.id, t)),
  );
  const [edit, setEdit] = useState(false);
  const [selected, setSelected] = useState<{
    text: string;
    index: number;
  } | null>(null);
  const [display, setDisplay] = useState("original");
  const [listening, setListening] = useState(false);
  useStudyTimer("listeningMinutes", yt.state === 1);
  const [manual, setManual] = useState(0);
  const active = video.subtitles.findIndex(
    (s) => yt.time >= s.start && yt.time < s.end,
  );
  const current = video.subtitles[active >= 0 ? active : manual];
  useEffect(() => {
    void perform(() => remember("videos", video.id, video.title));
  }, [video.id, video.title]);
  function replay() {
    if (current) {
      yt.seek(current.start);
      yt.play();
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,dialog"))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        yt.toggle();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        yt.seek(yt.time - 5);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        yt.seek(yt.time + 5);
      }
      if (e.key.toLowerCase() === "r") replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <>
      <Link className="back-link" to="/videos">
        <ArrowLeft size={15} />
        Моя видеотека
      </Link>
      <PageHeading
        title={video.title}
        description="Слова из видео — в ваш словарь одним нажатием."
        actions={
          <button className="button secondary" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            Субтитры и настройки
          </button>
        }
      />
      <div className="video-workspace">
        <div className="player-frame">
          <div ref={yt.container} className="youtube-container" />
          {!yt.ready && !yt.error && (
            <div className="player-loading">Подключаем YouTube…</div>
          )}
        </div>
        {yt.error && (
          <div className="notice">
            {yt.error}{" "}
            <a href={video.url} target="_blank" rel="noreferrer">
              Открыть на YouTube
            </a>
          </div>
        )}
        <div className="player-controls">
          <button
            className="icon-button"
            aria-label="Назад на 5 секунд"
            disabled={!yt.ready}
            onClick={() => yt.seek(yt.time - 5)}
          >
            −5с
          </button>
          <button
            className="button compact"
            aria-label="Воспроизвести или пауза"
            disabled={!yt.ready}
            onClick={yt.toggle}
          >
            {yt.state === 1 ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            className="icon-button"
            aria-label="Вперёд на 5 секунд"
            disabled={!yt.ready}
            onClick={() => yt.seek(yt.time + 5)}
          >
            +5с
          </button>
          <span>
            {timeLabel(yt.time)} / {timeLabel(yt.duration)}
          </span>
          <button
            className="button secondary compact"
            disabled={!current || !yt.ready}
            onClick={replay}
          >
            <RotateCcw size={15} />
            Повторить фразу
          </button>
          <select
            aria-label="Скорость видео"
            defaultValue="1"
            onChange={(e) =>
              yt.player.current?.setPlaybackRate(Number(e.target.value))
            }
          >
            {yt.rates.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </div>
        <div className="tabs">
          <button
            className={!listening ? "active" : undefined}
            onClick={() => setListening(false)}
          >
            Интерактивные субтитры
          </button>
          <button
            className={listening ? "active" : undefined}
            disabled={!video.subtitles.length}
            onClick={() => setListening(true)}
          >
            Аудирование и диктант
          </button>
        </div>
        {listening ? (
          <Listening subtitles={video.subtitles} yt={yt} />
        ) : (
          <section className="panel transcript-panel">
            <div className="section-heading">
              <h2>Текст видео</h2>
              <select
                aria-label="Вид субтитров"
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
              >
                <option value="original">Оригинал</option>
                <option value="both">Оригинал + перевод</option>
                <option value="translation">Только перевод</option>
                <option value="hidden">Скрыть субтитры</option>
              </select>
            </div>
            {!video.subtitles.length ? (
              <Empty
                title="Добавьте текст видео"
                description="Импортируйте SRT/VTT или вставьте субтитры вручную."
                action={
                  <button className="button" onClick={() => setEdit(true)}>
                    Добавить субтитры
                  </button>
                }
              />
            ) : display === "hidden" ? (
              <p className="hint center">
                Субтитры скрыты. Сосредоточьтесь на звучании.
              </p>
            ) : (
              <div className="transcript">
                {video.subtitles.map((sub, i) => (
                  <div
                    key={`${sub.start}-${i}`}
                    className={`subtitle-row ${i === active ? "active" : ""}`}
                  >
                    <button
                      className="timestamp"
                      onClick={() => {
                        setManual(i);
                        yt.seek(sub.start);
                        yt.play();
                      }}
                    >
                      {timeLabel(sub.start)}
                    </button>
                    <div>
                      {display !== "translation" && (
                        <InteractiveText
                          vocabulary={vocabulary}
                          content={sub.text}
                          language={video.language}
                          onSelect={(text) => {
                            yt.pause();
                            setManual(i);
                            setSelected({ text, index: i });
                          }}
                        />
                      )}
                      {display !== "original" && (
                        <p className="subtitle-translation">
                          {sub.translation || "Перевод не добавлен"}
                        </p>
                      )}
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Сохранить фразу"
                      onClick={() => setSelected({ text: sub.text, index: i })}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      {selected && (
        <WordPopup
          text={selected.text}
          context={{
            language: video.language,
            sourceId: video.id,
            sourceType: "video",
            sourceTitle: video.title,
            sourceTimestamp: video.subtitles[selected.index]?.start,
            example: video.subtitles[selected.index]?.text,
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {edit && <VideoEditor video={video} onClose={() => setEdit(false)} />}
    </>
  );
}
