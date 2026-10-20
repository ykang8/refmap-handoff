// Minimal YouTube IFrame Player API support: https://developers.google.com/youtube/iframe_api_reference

export type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    host?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      onError?: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const videoIdPattern = /^[\w-]{11}$/;

/** Returns the 11-character video id for youtube.com, music.youtube.com, youtu.be, /shorts, /embed and /live links. */
export function getYouTubeVideoId(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { return null; }
  const host = parsed.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = parsed.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = parsed.pathname.split('/');
    id = first === 'watch' ? parsed.searchParams.get('v') : ['shorts', 'embed', 'live', 'v'].includes(first) ? second ?? null : null;
  }
  return id && videoIdPattern.test(id) ? id : null;
}

let apiPromise: Promise<YouTubeNamespace> | undefined;

export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); if (window.YT) resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { apiPromise = undefined; script.remove(); reject(new Error('YouTube player could not be loaded')); };
    document.head.appendChild(script);
  });
  return apiPromise;
}
