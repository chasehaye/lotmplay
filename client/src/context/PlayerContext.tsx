import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

import type { AudioFile, Audiobook } from '@/types';
import { api, fileUrl } from '@/lib/api';

interface PlayerContextValue {
  currentBook: Audiobook | null;
  currentTrack: AudioFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  playTrack: (book: Audiobook, track: AudioFile) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  queue: AudioFile[];
  setQueue: (tracks: AudioFile[]) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentBook, setCurrentBook] = useState<Audiobook | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [speed, setSpeedState] = useState(1);
  const [queue, setQueue] = useState<AudioFile[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function playTrack(book: Audiobook, track: AudioFile) {
    setCurrentBook(book);
    setCurrentTrack(track);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = fileUrl(track.fileUrl);
      audioRef.current.play();
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((p) => !p);
  }

  function seek(time: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function setVolume(v: number) {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function setSpeed(s: number) {
    setSpeedState(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  function nextTrack() {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const next = queue[idx + 1];
    if (next && currentBook) playTrack(currentBook, next);
  }

  useEffect(() => {
    if (isPlaying && currentBook && currentTrack) {
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          api.saveProgress(currentBook.id, currentTrack.id, audioRef.current.currentTime);
        }
      }, 5000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isPlaying, currentBook, currentTrack]);

  function prevTrack() {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prev = queue[idx - 1];
    if (prev && currentBook) playTrack(currentBook, prev);
  }

  return (
    <PlayerContext.Provider
      value={{
        currentBook,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        speed,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        setSpeed,
        nextTrack,
        prevTrack,
        queue,
        setQueue,
        audioRef,
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(d);
          if (currentTrack && currentTrack.duration === 0 && isFinite(d) && d > 0) {
            api.updateDuration(currentTrack.id, d);
          }
        }}
        onEnded={nextTrack}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
