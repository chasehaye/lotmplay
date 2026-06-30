import type { AudioFile, Audiobook, ChapterPreview, TtsJob } from '@/types';

const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_ORIGIN}/api`;

export function fileUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/'; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/'; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: authHeaders(), body: formData });
  if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/'; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getAudiobooks: () => get<Audiobook[]>('/audiobooks'),
  getRecentBook: () => get<Audiobook | null>('/audiobooks/recent'),
  getAudiobook: (id: number) => get<Audiobook>(`/audiobooks/${id}`),
  getTracks: (audiobookId: number) =>
    get<AudioFile[]>(`/audiobooks/${audiobookId}/tracks`),
  getJobs: (audiobookId: number) =>
    get<TtsJob[]>(`/audiobooks/${audiobookId}/jobs`),

  createAudiobook: (data: { title: string; author: string }) =>
    post<Audiobook>('/audiobooks', data),

  uploadAudio: (audiobookId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return upload<AudioFile>(`/audiobooks/${audiobookId}/upload/audio`, fd);
  },

  updateDuration: (trackId: number, duration: number) =>
    fetch(`/api/audiofiles/${trackId}/duration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(duration),
    }),

  previewPdf: (audiobookId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return upload<ChapterPreview[]>(`/audiobooks/${audiobookId}/upload/pdf/preview`, fd);
  },

  confirmPdf: (audiobookId: number, selectedIndices: number[]) =>
    post<TtsJob[]>(`/audiobooks/${audiobookId}/upload/pdf/confirm`, { selectedIndices }),

  uploadCover: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return upload<{ coverUrl: string }>(`/audiobooks/${id}/cover`, fd);
  },

  deleteAudiobook: (id: number) =>
    fetch(`${BASE}/audiobooks/${id}`, { method: 'DELETE', headers: authHeaders() }),

  saveProgress: (audiobookId: number, trackId: number, position: number) =>
    fetch(`${BASE}/audiobooks/${audiobookId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ trackId, position }),
    }),

  deleteTrack: (trackId: number) =>
    fetch(`${BASE}/audiofiles/${trackId}`, { method: 'DELETE', headers: authHeaders() }),
};
