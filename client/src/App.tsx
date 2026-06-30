import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from '@/components/layout/Layout';
import { PlayerProvider } from '@/context/PlayerContext';
import { BookDetail } from '@/pages/BookDetail';
import { Home } from '@/pages/Home';
import { Library } from '@/pages/Library';
import { Login } from '@/pages/Login';

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('auth_token'));

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <PlayerProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="library" element={<Library />} />
            <Route path="book/:id" element={<BookDetail />} />
          </Route>
        </Routes>
      </PlayerProvider>
    </BrowserRouter>
  );
}
