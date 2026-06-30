import { useEffect, useRef, useState } from 'react';

import { BookOpen, Loader, Play, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import type { AudioFile, Audiobook, TtsJob } from '@/types';
import { UploadModal } from '@/components/modals/UploadModal';
import { usePlayer } from '@/context/PlayerContext';
import { api, fileUrl } from '@/lib/api';
import { formatTime } from '@/lib/format';

export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Audiobook | null>(null);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [jobs, setJobs] = useState<TtsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const { playTrack, setQueue, currentTrack, isPlaying, audioRef } = usePlayer();
  const coverRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bookId = Number(id);

  function loadTracks() {
    api.getTracks(bookId).then((t) => { setTracks(t); setQueue(t); }).catch(console.error);
  }

  function loadJobs() {
    api.getJobs(bookId).then(setJobs).catch(console.error);
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getAudiobook(bookId), api.getTracks(bookId), api.getJobs(bookId)])
      .then(([b, t, j]) => { setBook(b); setTracks(t); setQueue(t); setJobs(j); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Poll while any jobs are pending/processing
  useEffect(() => {
    const active = jobs.some((j) => j.status === 'Pending' || j.status === 'Processing');
    if (active && !pollRef.current) {
      pollRef.current = setInterval(() => { loadTracks(); loadJobs(); }, 3000);
    }
    if (!active && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        Book not found.
      </div>
    );
  }

  return (
    <>
      {showUpload && book && (
        <UploadModal
          audiobookId={book.id}
          onClose={() => setShowUpload(false)}
          onTracksAdded={() => {
            api.getTracks(book.id).then((t) => { setTracks(t); setQueue(t); });
          }}
        />
      )}
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-end">
        <div
          onClick={() => coverRef.current?.click()}
          className="group relative h-48 w-48 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-white/5 md:h-36 md:w-36"
        >
          {book.coverUrl ? (
            <img src={fileUrl(book.coverUrl!)} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen size={48} className="text-accent-bright/40" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-xs font-medium text-white">{book.coverUrl ? 'Change cover' : 'Add cover'}</span>
          </div>
        </div>
        <input
          ref={coverRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const result = await api.uploadCover(book.id, f);
            setBook({ ...book, coverUrl: result.coverUrl });
          }}
        />
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <p className="mb-1 text-xs uppercase tracking-widest text-muted">
            Audiobook
          </p>
          <h1 className="mb-1 text-3xl font-bold text-primary">{book.title}</h1>
          <p className="text-sm text-muted">{book.author}</p>
          <div className="mt-4 flex gap-2">
            {tracks.length > 0 && (() => {
              const resumeTrack = book.lastTrackId
                ? tracks.find((t) => t.id === book.lastTrackId)
                : null;
              return resumeTrack ? (
                <button
                  onClick={() => {
                    const position = book.lastPosition;
                    const onCanPlay = () => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = position;
                        audioRef.current.removeEventListener('canplay', onCanPlay);
                      }
                    };
                    if (audioRef.current) audioRef.current.addEventListener('canplay', onCanPlay);
                    playTrack(book, resumeTrack);
                  }}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  <RotateCcw size={14} /> Resume
                </button>
              ) : (
                <button
                  onClick={() => playTrack(book, tracks[0])}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  <Play size={14} /> Play
                </button>
              );
            })()}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-primary"
            >
              <Upload size={14} /> Add Content
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
                await api.deleteAudiobook(book.id);
                navigate('/');
              }}
              className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Generating indicator */}
      {jobs.some((j) => j.status === 'Pending' || j.status === 'Processing') && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-tile px-4 py-3 text-sm text-muted">
          <Loader size={14} className="animate-spin text-accent-bright" />
          Generating {jobs.filter((j) => j.status === 'Pending' || j.status === 'Processing').length} chapter{jobs.filter((j) => j.status === 'Pending' || j.status === 'Processing').length !== 1 ? 's' : ''}...
        </div>
      )}

      {/* Track list */}
      <div className="space-y-1">
        {tracks.map((track, index) => {
          const active = currentTrack?.id === track.id;
          const isResume = !active && track.id === book.lastTrackId;
          return (
            <div
              key={track.id}
              className={`group flex w-full items-center gap-4 rounded-md px-4 py-3 transition-colors ${
                active
                  ? 'bg-accent/20 text-accent-bright'
                  : isResume
                  ? 'bg-white/5 text-primary ring-1 ring-accent/30'
                  : 'hover:bg-white/5 text-primary'
              }`}
            >
              <button onClick={() => playTrack(book, track)} className="flex flex-1 items-center gap-4 text-left min-w-0">
                <span className="w-6 shrink-0 text-center text-sm text-muted">
                  {active && isPlaying ? (
                    <span className="text-accent-bright">▶</span>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="flex-1 truncate text-sm">{track.title}</span>
                {isResume && (
                  <span className="text-xs text-accent-bright/70">
                    left off at: {formatTime(book.lastPosition)}
                  </span>
                )}
                <span className="text-xs text-muted">
                  {formatTime(track.duration)}
                </span>
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete "${track.title}"?`)) return;
                  await api.deleteTrack(track.id);
                  loadTracks();
                }}
                className="ml-2 shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
