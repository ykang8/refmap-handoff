import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudio } from '@/lib/audio-store';

export type AudioStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

const waveformBars = 360;

/** Decodes the file once and returns normalised peak heights (0–1) for drawing a waveform. */
async function computePeaks(blob: Blob) {
  // An offline context can decode without a user gesture and never outputs sound.
  const context = new OfflineAudioContext(1, 1, 44100);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const samplesPerBar = Math.max(1, Math.floor(buffer.length / waveformBars));
  const stride = Math.max(1, Math.floor(samplesPerBar / 200)); // sampling a few hundred points per bar is plenty
  const peaks = Array.from({ length: waveformBars }, (_, bar) => {
    let peak = 0;
    for (let sample = bar * samplesPerBar; sample < (bar + 1) * samplesPerBar && sample < buffer.length; sample += stride) {
      for (const channel of channels) peak = Math.max(peak, Math.abs(channel[sample]));
    }
    return peak;
  });
  const loudest = Math.max(...peaks) || 1;
  return { peaks: peaks.map((peak) => peak / loudest), duration: buffer.duration };
}

/** Plays the audio file stored for `referenceId`. Bump `version` after replacing the stored file. */
export function useAudioPlayer(referenceId: string | null, version = 0) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<AudioStatus>(referenceId ? 'loading' : 'idle');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    if (!referenceId) { setStatus('idle'); return; }
    let cancelled = false;
    let objectUrl: string | undefined;
    const audio = new Audio();
    audio.preload = 'auto';
    setStatus('loading'); setPlaying(false); setCurrentTime(0); setDuration(0); setPeaks(null);
    audio.onloadedmetadata = () => {
      if (cancelled) return;
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      audioRef.current = audio; setStatus('ready');
    };
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => { setPlaying(false); setCurrentTime(audio.currentTime); };
    audio.onended = () => { setPlaying(false); setCurrentTime(audio.duration || audio.currentTime); };
    audio.onerror = () => { if (!cancelled && audio.getAttribute('src')) setStatus('error'); };
    getAudio(referenceId).then((blob) => {
      if (cancelled) return;
      if (!blob) { setStatus('missing'); return; }
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      computePeaks(blob).then((result) => {
        if (cancelled) return;
        setPeaks(result.peaks);
        // Some containers report an infinite duration until played; the decoded length is exact.
        setDuration((current) => current || result.duration);
      }).catch(() => undefined); // the waveform is optional; playback still works
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true; audioRef.current = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [referenceId, version]);

  // Follow the playhead smoothly while playing.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const play = useCallback(() => { audioRef.current?.play().catch(() => undefined); }, []);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const seek = useCallback((seconds: number) => { if (audioRef.current) audioRef.current.currentTime = seconds; setCurrentTime(seconds); }, []);

  return { status, playing, currentTime, duration, peaks, play, pause, seek };
}
