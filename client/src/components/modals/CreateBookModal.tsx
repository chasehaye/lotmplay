import { useRef, useState } from 'react';

import { BookOpen, X } from 'lucide-react';

import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
  onCreated: (id: number) => void;
}

export function CreateBookModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const coverRef = useRef<HTMLInputElement>(null);

  function handleCoverChange(file: File) {
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;
    setLoading(true);
    setError('');
    try {
      const book = await api.createAudiobook({ title: title.trim(), author: author.trim() });
      if (cover) await api.uploadCover(book.id, cover);
      onCreated(book.id);
    } catch {
      setError('Failed to create book. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-tile p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">New Audiobook</h2>
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover picker */}
          <div
            onClick={() => coverRef.current?.click()}
            className="mx-auto flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-white/10 bg-base transition-colors hover:border-accent/50"
          >
            {coverPreview ? (
              <img src={coverPreview} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted">
                <BookOpen size={28} className="text-accent-bright/40" />
                <span className="text-xs">Add cover</span>
              </div>
            )}
          </div>
          <input
            ref={coverRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverChange(f); }}
          />

          <div>
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              className="w-full rounded-md border border-white/10 bg-base px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Author</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name"
              className="w-full rounded-md border border-white/10 bg-base px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted hover:text-primary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !author.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
