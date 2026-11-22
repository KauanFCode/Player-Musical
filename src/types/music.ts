export type RepeatMode = 'off' | 'all' | 'one';

export type LyricFontSize = 'small' | 'medium' | 'large';

export type TrackSourceType = 'local' | 'downloaded' | 'stream';

export interface AudioTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  folderName?: string;
  durationMs?: number;
  sourceType: TrackSourceType;
  streamUrl?: string;
  artworkUrl?: string;
  addedAt: number;
  fileSize?: number;
  mimeType?: string;
}

export interface SleepTimerState {
  endTimeMs: number | null;
  untilTrackEnd: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface AppSettings {
  autoFetchArtwork: boolean;
  preferEmbeddedArtwork: boolean;
  autoFetchLyrics: boolean;
  hdArtworkQuality: boolean;
  lyricFontSize: LyricFontSize;
  pulseCoverAnimation: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoFetchArtwork: true,
  preferEmbeddedArtwork: true,
  autoFetchLyrics: true,
  hdArtworkQuality: true,
  lyricFontSize: 'medium',
  pulseCoverAnimation: true,
};

export interface LrcLine {
  timeMs: number;
  text: string;
}

export interface OnlineTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  streamUrl: string;
  downloadUrl: string;
  durationMs?: number;
  quality: string;
}
