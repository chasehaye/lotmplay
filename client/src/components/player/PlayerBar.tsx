import { useEffect, useRef, useState } from 'react';

import { Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { RotateCw } from 'lucide-react';

import { usePlayer } from '@/context/PlayerContext';
import { formatTime } from '@/lib/format';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function SpeedPicker({ speed, setSpeed }: { speed: number; setSpeed: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-primary"
      >
        {speed}x
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 w-40 rounded-lg border border-white/10 bg-tile p-3 shadow-xl">
          <p className="mb-2 text-center text-xs text-muted">Playback Speed</p>
          <div className="flex flex-col gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => { setSpeed(s); setOpen(false); }}
                className={`w-full rounded-md py-1.5 font-mono text-xs transition-colors ${
                  speed === s
                    ? 'bg-accent text-white'
                    : 'text-muted hover:bg-white/5 hover:text-primary'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayerBar() {
  const {
    currentBook,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    speed,
    togglePlay,
    seek,
    setVolume,
    setSpeed,
    nextTrack,
    prevTrack,
  } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="border-t border-white/10 bg-tile px-6 py-4">
      <div className="flex w-full flex-col items-center gap-3 md:grid md:grid-cols-3 md:gap-0">
        {/* Left — track info */}
        <div className="min-w-0 w-full text-center md:text-left">
          <p className="truncate text-sm font-medium text-primary">
            {currentTrack.title}
          </p>
          <p className="truncate text-xs text-muted">{currentBook?.title}</p>
        </div>

        {/* Center — controls */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button onClick={prevTrack} className="text-muted transition-colors hover:text-primary">
              <SkipBack size={18} />
            </button>
            <button onClick={() => seek(Math.max(0, currentTime - 30))} className="text-muted transition-colors hover:text-primary">
              <RotateCcw size={16} />
            </button>
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={() => seek(Math.min(duration, currentTime + 30))} className="text-muted transition-colors hover:text-primary">
              <RotateCw size={16} />
            </button>
            <button onClick={nextTrack} className="text-muted transition-colors hover:text-primary">
              <SkipForward size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="w-48 accent-accent-bright"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right — speed + volume */}
        <div className="flex items-center justify-center gap-4 md:justify-end">
          <SpeedPicker speed={speed} setSpeed={setSpeed} />
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-muted" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24 accent-accent-bright"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
