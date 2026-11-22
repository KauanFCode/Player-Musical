export type RepeatMode = 'off' | 'all' | 'one';

export type LyricFontSize = 'small' | 'medium' | 'large';

export interface AudioTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs?: number;
  isOfflineDownloaded?: boolean;
  folderUri?: string;
  addedAt?: number;
}

export interface WatchedFolder {
  uri: string;
  name: string;
  addedAt: number;
  lastSyncedAt?: number;
}

export interface PlaybackSession {
  queueUris: string[];
  currentUri?: string;
  positionSec?: number;
  isShuffle?: boolean;
  repeatMode?: RepeatMode;
}

export interface SleepTimerState {
  endTimeMs: number | null;
  untilTrackEnd: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackUris: string[];
  createdAt: number;
}

export interface AppSettings {
  autoFetchArtwork: boolean;
  preferEmbeddedArtwork: boolean;
  autoFetchLyrics: boolean;
  autoSyncFoldersOnOpen: boolean;
  hdArtworkQuality: boolean;
  lyricFontSize: LyricFontSize;
  pulseCoverAnimation: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoFetchArtwork: true,
  preferEmbeddedArtwork: true,
  autoFetchLyrics: true,
  autoSyncFoldersOnOpen: true,
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
