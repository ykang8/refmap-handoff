import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

export type TimelinePin = { id: string; time: number; color: string; label: string };

type TimelineProps = {
  duration: number;
  currentTime: number;
  peaks?: number[] | null;
  pins: TimelinePin[];
  disabled?: boolean;
  formatTime: (seconds: number) => string;
  onSeek: (seconds: number) => void;
};

/** Seekable timeline: a waveform when peaks are available, otherwise a plain track, with marker pins and a playhead. */
export function Timeline({ duration, currentTime, peaks, pins, disabled, formatTime, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const total = Math.max(1, duration);
  const progress = Math.min(100, Math.max(0, (currentTime / total) * 100));

  const seekToPointer = (event: PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * total));
  };
  const onPointerDown = (event: PointerEvent) => {
    if (disabled || event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToPointer(event);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    const step = event.shiftKey ? 15 : 5;
    const next = { ArrowLeft: currentTime - step, ArrowRight: currentTime + step, Home: 0, End: total }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSeek(Math.round(Math.min(total, Math.max(0, next))));
  };

  const bars = peaks?.length ? peaks : null;
  const waveform = (className: string) => bars && (
    <svg className={className} viewBox={`0 0 ${bars.length} 100`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((peak, index) => {
        const height = Math.max(3, peak * 100);
        return <rect key={index} x={index + 0.15} width={0.7} y={(100 - height) / 2} height={height} />;
      })}
    </svg>
  );

  return (
    <div className={`timeline ${bars ? 'timeline-wave' : 'timeline-plain'} ${disabled ? 'is-disabled' : ''}`}>
      <div
        ref={trackRef}
        className="timeline-track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(total)}`}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => { if (dragging.current) seekToPointer(event); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={onKeyDown}
        data-testid="input-reference-timeline"
      >
        {bars ? <>
          {waveform('timeline-bars')}
          <div className="timeline-played" style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}>{waveform('timeline-bars')}</div>
        </> : <div className="timeline-rail"><div className="timeline-fill" style={{ width: `${progress}%` }} /></div>}
        <div className="timeline-playhead" style={{ left: `${progress}%` }} />
      </div>
      <div className="timeline-pins">
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className="timeline-pin"
            style={{ left: `${Math.min(100, (pin.time / total) * 100)}%`, '--pin': pin.color } as React.CSSProperties}
            onClick={() => onSeek(pin.time)}
            disabled={disabled}
            title={`${formatTime(pin.time)} · ${pin.label}`}
            aria-label={`Jump to ${formatTime(pin.time)}, ${pin.label}`}
            data-testid={`button-timeline-pin-${pin.id}`}
          />
        ))}
      </div>
    </div>
  );
}
