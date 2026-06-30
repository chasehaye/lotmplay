import { useEffect, useState } from 'react';

import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Audiobook } from '@/types';
import { api } from '@/lib/api';

export function Home() {
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAudiobooks()
      .then(setBooks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted">
        <BookOpen size={40} className="text-accent-bright/40" />
        <p>No audiobooks yet.</p>
      </div>
    );
  }

  const recent = books.slice(0, 6);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-primary">
        Recently Added
      </h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {recent.map((book) => (
          <Link
            key={book.id}
            to={`/book/${book.id}`}
            className="group rounded-lg bg-tile p-3 transition-colors hover:bg-white/5"
          >
            <div className="mb-3 aspect-square overflow-hidden rounded-md bg-white/5">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen size={32} className="text-accent-bright/40" />
                </div>
              )}
            </div>
            <p className="truncate text-sm font-medium text-primary">
              {book.title}
            </p>
            <p className="truncate text-xs text-muted">{book.author}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
