import { useEffect, useState } from 'react';

import { BookOpen, Clock, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { Audiobook } from '@/types';
import { CreateBookModal } from '@/components/modals/CreateBookModal';
import { api, fileUrl } from '@/lib/api';
import { formatTime } from '@/lib/format';

export function Library() {
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  function loadBooks() {
    api.getAudiobooks().then(setBooks).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { loadBooks(); }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  return (
    <>
      {showCreate && (
        <CreateBookModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`/book/${id}`); }}
        />
      )}
      <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Library</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Plus size={15} /> New Book
        </button>
      </div>
      {books.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted">
          <BookOpen size={40} className="text-accent-bright/40" />
          <p>Your library is empty.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <Link
              key={book.id}
              to={`/book/${book.id}`}
              className="flex items-center gap-4 rounded-lg bg-tile p-4 transition-colors hover:bg-white/5"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/5">
                {book.coverUrl ? (
                  <img
                    src={fileUrl(book.coverUrl!)}
                    alt={book.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen size={20} className="text-accent-bright/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-primary">{book.title}</p>
                <p className="truncate text-sm text-muted">{book.author}</p>
                {book.lastTrackTitle && (
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-accent-bright/70">
                    <Clock size={11} />
                    {book.lastTrackTitle} — {formatTime(book.lastPosition)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
