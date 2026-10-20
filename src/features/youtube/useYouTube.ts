import { useEffect, useRef, useState } from "react";
export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
}
interface PlayerOptions {
  videoId: string;
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: () => void;
    onStateChange: (e: { data: number }) => void;
    onError: (e: { data: number }) => void;
  };
}
interface YouTubeAPI {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise)
    apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => {
        apiPromise = undefined;
        reject(new Error("YouTube не отвечает. Проверьте соединение."));
      }, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        previous?.();
        if (window.YT) resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timeout);
        apiPromise = undefined;
        reject(
          new Error("Не удалось загрузить YouTube. Для видео нужен интернет."),
        );
      };
      document.head.appendChild(script);
    });
  return apiPromise;
}
export function useYouTube(
  videoId: string,
  position: number,
  onPosition: (time: number) => void,
) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const initial = useRef(position);
  const callback = useRef(onPosition);
  callback.current = onPosition;
  const [time, setTime] = useState(position);
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState(-1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState([0.5, 0.75, 1, 1.25, 1.5, 2]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let count = 0;
    setReady(false);
    setError("");
    const node = document.createElement("div");
    container.current?.appendChild(node);
    void loadAPI()
      .then((api) => {
        if (cancelled) return;
        player.current = new api.Player(node, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            origin: location.origin,
            playsinline: 1,
            rel: 0,
            start: Math.floor(initial.current),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setRates(player.current?.getAvailablePlaybackRates() ?? [1]);
              timer = setInterval(() => {
                if (!player.current) return;
                const t = player.current.getCurrentTime();
                setTime(t);
                setDuration(player.current.getDuration());
                if (++count % 20 === 0) callback.current(t);
              }, 250);
            },
            onStateChange: (e) => {
              if (!cancelled) setState(e.data);
            },
            onError: (e) => {
              if (!cancelled)
                setError(
                  `YouTube не может воспроизвести видео (код ${e.data}). Возможно, автор запретил встраивание.`,
                );
            },
          },
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (player.current) {
        const t = player.current.getCurrentTime?.();
        if (typeof t === "number") callback.current(t);
        player.current.destroy();
        player.current = null;
      }
      node.remove();
    };
  }, [videoId]);
  const seek = (t: number) => {
    const next = Math.max(0, Math.min(duration || Infinity, t));
    player.current?.seekTo(next, true);
    setTime(next);
  };
  return {
    container,
    player,
    time,
    duration,
    state,
    ready,
    error,
    rates,
    seek,
    play: () => player.current?.playVideo(),
    pause: () => player.current?.pauseVideo(),
    toggle: () =>
      state === 1 ? player.current?.pauseVideo() : player.current?.playVideo(),
  };
}
