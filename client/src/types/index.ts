export interface Audiobook {
  id: number;
  title: string;
  author: string;
  coverUrl?: string;
  totalDuration: number;
  createdAt: string;
  lastTrackId?: number;
  lastPosition: number;
  lastTrackTitle?: string;
  lastListenedAt?: string;
}

export interface AudioFile {
  id: number;
  audiobookId: number;
  title: string;
  trackNumber: number;
  duration: number;
  fileUrl: string;
}

export type TtsJobStatus = 'Pending' | 'Processing' | 'Done' | 'Failed';

export interface TtsJob {
  id: number;
  chapterTitle: string;
  trackNumber: number;
  status: TtsJobStatus;
  error?: string;
}

export interface ChapterPreview {
  index: number;
  title: string;
  snippet: string;
}

export interface PlaybackState {
  audiobookId: number | null;
  trackId: number | null;
  currentTime: number;
  isPlaying: boolean;
}
