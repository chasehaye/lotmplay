import { useEffect, useState } from 'react';

import { BookOpen, Home, Library, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import type { Audiobook } from '@/types';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { usePlayer } from '@/context/PlayerContext';

const navItems = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Library', to: '/library', icon: Library },
];

interface SidebarProps {
  onClose: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { currentBook, currentTrack } = usePlayer();
  const [recentBook, setRecentBook] = useState<Audiobook | null>(null);

  useEffect(() => {
    api.getRecentBook().then(setRecentBook).catch(() => {});
  }, []);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/10 bg-tile">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-accent-bright" />
          <span className="font-semibold text-primary">Player</span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-primary md:hidden">
          <X size={18} />
        </button>
      </div>

      {/* Now Playing / Recently Listened */}
      {(currentBook || recentBook) && (() => {
        const isPlaying = !!currentBook;
        const book = currentBook ?? recentBook!;
        const label = isPlaying ? 'Now Playing' : 'Recently Listened';
        const subtitle = isPlaying ? currentTrack?.title : recentBook?.lastTrackTitle;
        const timestamp = !isPlaying && recentBook?.lastPosition ? formatTime(recentBook.lastPosition) : null;

        return (
          <div className="mx-3 mb-3">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
            <Link
              to={`/book/${book.id}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg bg-base p-3 transition-colors hover:bg-white/5"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/5">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen size={18} className="text-accent-bright/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">{book.title}</p>
                {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
                {timestamp && <p className="text-xs text-accent-bright/60">{timestamp}</p>}
              </div>
            </Link>
          </div>
        );
      })()}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent-bright'
                  : 'text-muted hover:bg-white/5 hover:text-primary'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
