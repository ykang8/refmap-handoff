import { useCallback, useEffect, useRef, useState } from 'react';
import { loadYouTubeApi, type YouTubePlayer } from '@/lib/youtube';

export type YouTubeStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Mounts a YouTube player into `containerRef` and exposes its time, duration and transport controls. */
export function useYouTubePlayer(videoId: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [status, setStatus] = useState<YouTubeStatus>(videoId ? 'loading' : 'idle');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!videoId || !container) { setStatus('idle'); return; }
    let cancelled = false;
    let player: YouTubePlayer | undefined;
    setStatus('loading'); setCurrentTime(0); setDuration(0);
    // The API replaces its target with an iframe, so give it a child instead of the React-owned node.
    const target = document.createElement('div');
    container.appendChild(target);
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(target, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: ({ target: ready }) => {
            if (cancelled) return;
            playerRef.current = ready; setDuration(ready.getDuration() || 0); setStatus('ready');
          },
          onStateChange: ({ data, target: changed }) => {
            if (cancelled) return;
            setPlaying(data === YT.PlayerState.PLAYING);
            setCurrentTime(changed.getCurrentTime());
            const total = changed.getDuration(); if (total) setDuration(total);
          },
          onError: () => { if (!cancelled) setStatus('error'); },
        },
      });
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true; playerRef.current = null; setPlaying(false);
      player?.destroy(); container.replaceChildren();
    };
  }, [videoId]);

  // The API has no time-update event, so poll while playing.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => { if (playerRef.current) setCurrentTime(playerRef.current.getCurrentTime()); }, 250);
    return () => window.clearInterval(timer);
  }, [playing]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const seek = useCallback((seconds: number) => { playerRef.current?.seekTo(seconds, true); setCurrentTime(seconds); }, []);

  return { containerRef, status, playing, currentTime, duration, play, pause, seek };
}
