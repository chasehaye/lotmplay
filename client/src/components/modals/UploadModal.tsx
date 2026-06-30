import { useCallback, useEffect, useRef, useState } from 'react';

import { CheckCircle, Clock, FileAudio, FileText, FolderOpen, Loader, Upload, X, XCircle } from 'lucide-react';

import type { AudioFile, ChapterPreview, TtsJob } from '@/types';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';

type Tab = 'audio' | 'folder' | 'pdf' | 'history';

interface Props {
  audiobookId: number;
  onClose: () => void;
  onTracksAdded: () => void;
}

export function UploadModal({ audiobookId, onClose, onTracksAdded }: Props) {
  const [tab, setTab] = useState<Tab>('audio');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [jobs, setJobs] = useState<TtsJob[]>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<{ jobs: TtsJob[]; tracks: AudioFile[] } | null>(null);

  // PDF preview state
  const [previews, setPreviews] = useState<ChapterPreview[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accept = tab === 'pdf' ? '.pdf,.epub' : '.mp3,.wav,.m4a,.m4b,.ogg,.flac';

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.getJobs(audiobookId);
        setJobs(updated);
        const allDone = updated.every((j) => j.status === 'Done' || j.status === 'Failed');
        if (allDone) { clearInterval(pollRef.current!); onTracksAdded(); }
      } catch { /* silent */ }
    }, 2000);
  }

  async function loadHistory() {
    try {
      const [jobs, tracks] = await Promise.all([
        api.getJobs(audiobookId),
        api.getTracks(audiobookId),
      ]);
      setHistory({ jobs, tracks });
    } catch { /* silent */ }
  }

  async function handleAudioFile(file: File) {
    setError('');
    setUploading(true);
    try {
      await api.uploadAudio(audiobookId, file);
      onTracksAdded();
      onClose();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handlePdfUpload(file: File) {
    setError('');
    setUploading(true);
    try {
      const result = await api.previewPdf(audiobookId, file);
      setPreviews(result);
      setSelected(new Set(result.map((p) => p.index)));
    } catch {
      setError('Failed to parse PDF. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (selected.size === 0) { setError('Select at least one chapter.'); return; }
    setError('');
    setUploading(true);
    try {
      const newJobs = await api.confirmPdf(audiobookId, Array.from(selected).sort((a, b) => a - b));
      setJobs(newJobs);
      setPreviews(null);
      startPolling();
    } catch {
      setError('Failed to queue chapters. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFolderFiles(files: FileList) {
    const audioExts = ['.mp3', '.wav', '.m4a', '.m4b', '.ogg', '.flac'];
    const sorted = Array.from(files)
      .filter((f) => audioExts.some((ext) => f.name.toLowerCase().endsWith(ext)))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (sorted.length === 0) { setError('No audio files found in the selected folder.'); return; }

    setError('');
    setUploading(true);
    setBulkProgress({ done: 0, total: sorted.length });

    let done = 0;
    for (const file of sorted) {
      try { await api.uploadAudio(audiobookId, file); } catch { /* continue */ }
      done++;
      setBulkProgress({ done, total: sorted.length });
    }

    setUploading(false);
    setBulkProgress(null);
    onTracksAdded();
    onClose();
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (tab === 'pdf') handlePdfUpload(file);
    else handleAudioFile(file);
  }, [tab, audiobookId]);

  function toggleAll() {
    if (!previews) return;
    if (selected.size === previews.length) setSelected(new Set());
    else setSelected(new Set(previews.map((p) => p.index)));
  }

  function toggleOne(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const allDone = jobs.length > 0 && jobs.every((j) => j.status === 'Done' || j.status === 'Failed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[80vw] rounded-xl bg-tile p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Add Content</h2>
          <button onClick={onClose} className="text-muted hover:text-primary"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-lg bg-base p-1">
          {(['audio', 'folder', 'pdf', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError('');
                setJobs([]);
                setBulkProgress(null);
                setPreviews(null);
                if (t === 'history') loadHistory();
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === t ? 'bg-tile text-primary' : 'text-muted hover:text-primary'
              }`}
            >
              {t === 'audio' ? <FileAudio size={15} /> : t === 'folder' ? <FolderOpen size={15} /> : t === 'pdf' ? <FileText size={15} /> : <Clock size={15} />}
              {t === 'audio' ? 'Audio File' : t === 'folder' ? 'Bulk Folder' : t === 'pdf' ? 'PDF → TTS' : 'History'}
            </button>
          ))}
        </div>

        {/* Bulk folder progress */}
        {bulkProgress && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader size={24} className="animate-spin text-accent-bright" />
            <p className="text-sm text-primary">Uploading {bulkProgress.done} / {bulkProgress.total} files...</p>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-accent transition-all"
                style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* PDF chapter selection */}
        {previews && !jobs.length && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{previews.length} chapters detected — select which to generate</p>
              <button onClick={toggleAll} className="text-xs text-accent-bright hover:underline">
                {selected.size === previews.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {previews.map((p) => (
                <button
                  key={p.index}
                  onClick={() => toggleOne(p.index)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected.has(p.index)
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-white/5 bg-base hover:border-white/10'
                  }`}
                >
                  <p className="text-sm font-medium text-primary">{p.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{p.snippet}</p>
                </button>
              ))}
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setPreviews(null)}
                className="flex-1 rounded-md border border-white/10 py-2 text-sm text-muted hover:text-primary"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading || selected.size === 0}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {uploading ? 'Queuing...' : `Generate ${selected.size} chapter${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="space-y-4">
            {!history ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                <Loader size={16} className="animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {/* TTS Jobs — latest attempt per chapter */}
                {(() => {
                  const latestByTitle = Object.values(
                    history.jobs.reduce<Record<string, TtsJob>>((acc, job) => {
                      if (!acc[job.chapterTitle] || job.id > acc[job.chapterTitle].id)
                        acc[job.chapterTitle] = job;
                      return acc;
                    }, {})
                  ).sort((a, b) => a.trackNumber - b.trackNumber);
                  return (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
                        TTS Jobs ({latestByTitle.length} chapters)
                      </p>
                      {latestByTitle.length === 0 ? (
                        <p className="text-xs text-muted">No TTS jobs yet.</p>
                      ) : (
                        <div className="max-h-64 space-y-1 overflow-y-auto">
                          {latestByTitle.map((job) => (
                            <div key={job.id} className="flex items-center gap-3 rounded-md bg-base px-3 py-2">
                              <StatusIcon status={job.status} />
                              <span className="w-6 shrink-0 text-center text-xs text-muted">{job.trackNumber}</span>
                              <span className="flex-1 truncate text-sm text-primary">{job.chapterTitle}</span>
                              {job.status === 'Failed' && job.error && (
                                <span className="flex-1 truncate text-xs text-red-400" title={job.error}>{job.error}</span>
                              )}
                              <span className="shrink-0 text-xs text-muted capitalize">{job.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Uploaded Tracks */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Uploaded Tracks ({history.tracks.length})</p>
                  {history.tracks.length === 0 ? (
                    <p className="text-xs text-muted">No tracks yet.</p>
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {history.tracks.map((track, i) => (
                        <div key={track.id} className="flex items-center gap-3 rounded-md bg-base px-3 py-2">
                          <span className="w-5 shrink-0 text-center text-xs text-muted">{i + 1}</span>
                          <span className="flex-1 truncate text-sm text-primary">{track.title}</span>
                          <span className="shrink-0 text-xs text-muted">{formatTime(track.duration)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Drop zone */}
        {tab !== 'history' && !previews && jobs.length === 0 && !bulkProgress && (
          <>
            {tab === 'folder' ? (
              <div
                onClick={() => folderRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-white/10 py-12 transition-colors hover:border-accent/50 hover:bg-white/5"
              >
                <FolderOpen size={28} className="text-muted" />
                <p className="text-sm text-muted">Click to select a folder of audio files</p>
                <p className="text-xs text-muted/60">Files sorted by filename and uploaded in order</p>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors ${
                  dragging ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent/50 hover:bg-white/5'
                }`}
              >
                <Upload size={28} className="text-muted" />
                <p className="text-sm text-muted">
                  {tab === 'audio' ? 'Drop an audio file or click to browse' : 'Drop a PDF or click to browse'}
                </p>
                <p className="text-xs text-muted/60">
                  {tab === 'pdf' ? 'PDF or EPUB — chapters detected for your review' : accept.replace(/\./g, '').toUpperCase().split(',').join(' • ')}
                </p>
              </div>
            )}
            <input ref={fileRef} type="file" accept={accept} className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (tab === 'pdf') handlePdfUpload(f);
                else handleAudioFile(f);
              }}
            />
            <input ref={folderRef} type="file" className="hidden"
              {...({ webkitdirectory: '' } as object)}
              onChange={(e) => { if (e.target.files) handleFolderFiles(e.target.files); }}
            />
          </>
        )}

        {tab !== 'history' && uploading && !bulkProgress && !previews && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
            <Loader size={16} className="animate-spin" />
            {tab === 'pdf' ? 'Parsing PDF and detecting chapters...' : 'Uploading...'}
          </div>
        )}

        {tab !== 'history' && error && !previews && <p className="mt-3 text-center text-xs text-error">{error}</p>}

        {/* TTS job progress */}
        {jobs.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="mb-3 text-xs text-muted">
              Generating {jobs.length} chapter{jobs.length > 1 ? 's' : ''} with TTS...
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 rounded-md bg-base px-3 py-2">
                  <StatusIcon status={job.status} />
                  <span className="flex-1 truncate text-sm text-primary">{job.chapterTitle}</span>
                  <span className="text-xs text-muted capitalize">{job.status}</span>
                </div>
              ))}
            </div>
            {allDone && (
              <button onClick={onClose} className="mt-3 w-full rounded-md bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover">
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TtsJob['status'] }) {
  if (status === 'Done') return <CheckCircle size={15} className="shrink-0 text-accent-bright" />;
  if (status === 'Failed') return <XCircle size={15} className="shrink-0 text-error" />;
  if (status === 'Processing') return <Loader size={15} className="shrink-0 animate-spin text-accent-bright" />;
  return <div className="h-4 w-4 shrink-0 rounded-full border border-white/20" />;
}
