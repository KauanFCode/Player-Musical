import RNFS from 'react-native-fs';
import {
  AppSettings,
  AudioTrack,
  DEFAULT_SETTINGS,
  PlaybackSession,
  Playlist,
  WatchedFolder,
} from '../types/music';

const STORAGE_KEYS = {
  TRACKS: 'player2_library_tracks',
  PLAYLISTS: 'player2_user_playlists',
  CUSTOM_COVERS: 'player2_custom_covers',
  CUSTOM_LYRICS: 'player2_custom_lyrics',
  SETTINGS: 'player2_settings',
  FAVORITES: 'player2_favorite_uris',
  LYRIC_OFFSETS: 'player2_lyric_offsets',
  WATCHED_FOLDERS: 'player2_watched_folders',
  SESSION: 'player2_playback_session',
  TOUR_DONE: 'player2_tour_completed',
};

const getFilePath = (key: string): string => `${RNFS.DocumentDirectoryPath}/${key}.json`;

async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await RNFS.writeFile(getFilePath(key), JSON.stringify(data), 'utf8');
  } catch (error) {
    console.warn(`Erro ao salvar (${key}):`, error);
  }
}

async function loadData<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const filePath = getFilePath(key);
    const exists = await RNFS.exists(filePath);
    if (exists) {
      const content = await RNFS.readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.warn(`Erro ao carregar (${key}):`, error);
  }
  return defaultValue;
}

export const saveLibraryTracks = (tracks: AudioTrack[]) =>
  saveData<AudioTrack[]>(STORAGE_KEYS.TRACKS, tracks);
export const loadLibraryTracks = () =>
  loadData<AudioTrack[]>(STORAGE_KEYS.TRACKS, []);

export const saveUserPlaylists = (playlists: Playlist[]) =>
  saveData<Playlist[]>(STORAGE_KEYS.PLAYLISTS, playlists);
export const loadUserPlaylists = () =>
  loadData<Playlist[]>(STORAGE_KEYS.PLAYLISTS, []);

export const saveCustomCovers = (covers: Record<string, string>) =>
  saveData<Record<string, string>>(STORAGE_KEYS.CUSTOM_COVERS, covers);
export const loadCustomCovers = () =>
  loadData<Record<string, string>>(STORAGE_KEYS.CUSTOM_COVERS, {});

export const saveCustomLyrics = (lyrics: Record<string, string>) =>
  saveData<Record<string, string>>(STORAGE_KEYS.CUSTOM_LYRICS, lyrics);
export const loadCustomLyrics = () =>
  loadData<Record<string, string>>(STORAGE_KEYS.CUSTOM_LYRICS, {});

export const saveAppSettings = (settings: AppSettings) =>
  saveData<AppSettings>(STORAGE_KEYS.SETTINGS, settings);
export const loadAppSettings = () =>
  loadData<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

export const saveFavoriteUris = (uris: string[]) =>
  saveData<string[]>(STORAGE_KEYS.FAVORITES, uris);
export const loadFavoriteUris = () =>
  loadData<string[]>(STORAGE_KEYS.FAVORITES, []);

export const saveLyricOffsets = (offsets: Record<string, number>) =>
  saveData<Record<string, number>>(STORAGE_KEYS.LYRIC_OFFSETS, offsets);
export const loadLyricOffsets = () =>
  loadData<Record<string, number>>(STORAGE_KEYS.LYRIC_OFFSETS, {});

export const saveWatchedFolders = (folders: WatchedFolder[]) =>
  saveData<WatchedFolder[]>(STORAGE_KEYS.WATCHED_FOLDERS, folders);
export const loadWatchedFolders = () =>
  loadData<WatchedFolder[]>(STORAGE_KEYS.WATCHED_FOLDERS, []);

export const savePlaybackSession = (session: PlaybackSession) =>
  saveData<PlaybackSession>(STORAGE_KEYS.SESSION, session);
export const loadPlaybackSession = () =>
  loadData<PlaybackSession | null>(STORAGE_KEYS.SESSION, null);

export const saveHasCompletedTour = (done: boolean) =>
  saveData<boolean>(STORAGE_KEYS.TOUR_DONE, done);
export const loadHasCompletedTour = () =>
  loadData<boolean>(STORAGE_KEYS.TOUR_DONE, false);
