import { useState } from 'react';

import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { PlayerBar } from '@/components/player/PlayerBar';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-base text-primary">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center border-b border-white/10 p-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-primary"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 font-semibold">Player</span>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        <PlayerBar />
      </div>
    </div>
  );
}
