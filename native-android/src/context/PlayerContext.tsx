import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  errorCodes,
  isErrorWithCode,
  pickDirectory,
} from '@react-native-documents/picker';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode as RNTPRepeatMode,
  State,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {
  AppSettings,
  AudioTrack,
  DEFAULT_SETTINGS,
  Playlist,
  RepeatMode,
  SleepTimerState,
  WatchedFolder,
} from '../types/music';
import {
  loadAppSettings,
  loadCustomCovers,
  loadCustomLyrics,
  loadFavoriteUris,
  loadHasCompletedTour,
  loadLibraryTracks,
  loadLyricOffsets,
  loadPlaybackSession,
  loadUserPlaylists,
  loadWatchedFolders,
  saveAppSettings,
  saveCustomCovers,
  saveCustomLyrics,
  saveFavoriteUris,
  saveHasCompletedTour,
  saveLibraryTracks,
  saveLyricOffsets,
  savePlaybackSession,
  saveUserPlaylists,
  saveWatchedFolders,
} from '../utils/storage';
import {
  cacheArtworkFromUri,
  clearAssetsCache,
  getCachedTrackAssets,
  resolveOfflineTrackAssets,
} from '../utils/assetCache';
import {
  extractOfflineMetadata,
  getTextFromUri,
  isAudioFile,
  isImageFile,
  isLyricsFile,
  normalizeMediaUri,
} from '../utils/metadataExtractor';
import { parseFilename } from '../utils/lrcParser';

const isNativePlayerAvailable = !!TrackPlayer && Platform.OS !== 'web';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toRNTPRepeatMode(mode: RepeatMode): RNTPRepeatMode {
  switch (mode) {
    case 'one':
      return RNTPRepeatMode.Track;
    case 'all':
      return RNTPRepeatMode.Queue;
    default:
      return RNTPRepeatMode.Off;
  }
}

interface PlaybackProgressContextValue {
  positionMs: number;
  durationMs: number;
}

const PlaybackProgressContext = createContext<PlaybackProgressContextValue>({
  positionMs: 0,
  durationMs: 0,
});

const PlaybackProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { position, duration } = useProgress(250);
  const value = useMemo(
    () => ({
      positionMs: (position || 0) * 1000,
      durationMs: (duration || 0) * 1000,
    }),
    [position, duration]
  );
  return (
    <PlaybackProgressContext.Provider value={value}>
      {children}
    </PlaybackProgressContext.Provider>
  );
};

export function usePlaybackProgress(): PlaybackProgressContextValue {
  return useContext(PlaybackProgressContext);
}

interface SyncProgress {
  current: number;
  total: number;
}

interface PlayerContextValue {
  // Playback state
  isInitialized: boolean;
  isStorageLoaded: boolean;
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  currentIndex: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isPlayerModalVisible: boolean;
  setPlayerModalVisible: (visible: boolean) => void;

  // Library & Playlists
  libraryTracks: AudioTrack[];
  userPlaylists: Playlist[];
  favoriteUris: string[];
  watchedFolders: WatchedFolder[];
  customCovers: Record<string, string>;
  customLyrics: Record<string, string>;
  lyricOffsets: Record<string, number>;
  settings: AppSettings;
  isSyncingAssets: boolean;
  isScanningFolders: boolean;
  syncProgress: SyncProgress | null;
  sleepTimer: SleepTimerState;

  // Playback actions
  playTrack: (track: AudioTrack, sourceList?: AudioTrack[]) => Promise<void>;
  playQueue: (tracks: AudioTrack[], startIndex?: number) => Promise<void>;
  playNextInQueue: (track: AudioTrack) => Promise<void>;
  addToQueue: (track: AudioTrack) => Promise<void>;
  jumpToQueueIndex: (index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeatMode: () => Promise<void>;

  // Favorites, Sleep Timer & Lyric Offset
  isFavorite: (uri: string) => boolean;
  toggleFavorite: (uri: string) => void;
  getLyricOffset: (uri: string) => number;
  adjustLyricOffset: (uri: string, deltaMs: number) => void;
  resetLyricOffset: (uri: string) => void;
  setSleepTimerMinutes: (minutes: number) => void;
  setSleepTimerEndOfTrack: () => void;
  cancelSleepTimer: () => void;

  // Folder Watch & Import
  importFolder: () => Promise<void>;
  syncWatchedFolders: (showFeedback?: boolean) => Promise<number>;
  removeWatchedFolder: (treeUri: string) => Promise<void>;

  // First-time Guided Tour
  hasCompletedTour: boolean;
  isTourVisible: boolean;
  completeTour: () => void;
  replayTour: () => void;

  // Library & Metadata actions
  addTracksToLibrary: (
    tracks: AudioTrack[],
    extraCovers?: Record<string, string>,
    extraLyrics?: Record<string, string>
  ) => void;
  removeTrackFromLibrary: (uri: string) => void;
  setTrackCover: (uri: string, coverUri: string) => void;
  setTrackLyrics: (uri: string, lyricsText: string) => void;
  getTrackArtwork: (track: AudioTrack | null | undefined) => string | undefined;
  resolveLyricsForTrack: (track: AudioTrack) => Promise<string | undefined>;
  syncAllLibraryAssets: () => Promise<void>;

  // Playlist actions
  createPlaylist: (name: string, initialTrackUri?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackUri: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackUri: string) => void;

  // Settings & Cache
  updateSettings: (partial: Partial<AppSettings>) => void;
  clearAllCache: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const playbackState = usePlaybackState();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<AudioTrack[]>([]);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [baseQueue, setBaseQueue] = useState<AudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isPlayerModalVisible, setPlayerModalVisible] = useState(false);

  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [favoriteUris, setFavoriteUris] = useState<string[]>([]);
  const [watchedFolders, setWatchedFolders] = useState<WatchedFolder[]>([]);
  const [customCovers, setCustomCovers] = useState<Record<string, string>>({});
  const [customLyrics, setCustomLyrics] = useState<Record<string, string>>({});
  const [lyricOffsets, setLyricOffsets] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSyncingAssets, setIsSyncingAssets] = useState(false);
  const [isScanningFolders, setIsScanningFolders] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    endTimeMs: null,
    untilTrackEnd: false,
  });
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [isTourVisible, setIsTourVisible] = useState(false);

  const storageLoadedRef = useRef(false);
  const hasCompletedTourRef = useRef(false);
  const syncingRef = useRef(false);
  const folderScanRef = useRef(false);
  const lastFolderScanTsRef = useRef(0);
  const nativeQueueLoadedRef = useRef(false);
  const restoredPositionSecRef = useRef(0);
  const sleepTimerRef = useRef<SleepTimerState>(sleepTimer);
  const libraryTracksRef = useRef<AudioTrack[]>([]);
  const watchedFoldersRef = useRef<WatchedFolder[]>([]);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const queueRef = useRef<AudioTrack[]>([]);
  const currentTrackRef = useRef<AudioTrack | null>(null);
  const customCoversRef = useRef<Record<string, string>>({});
  const customLyricsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);

  useEffect(() => {
    libraryTracksRef.current = libraryTracks;
  }, [libraryTracks]);

  useEffect(() => {
    watchedFoldersRef.current = watchedFolders;
  }, [watchedFolders]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    customCoversRef.current = customCovers;
  }, [customCovers]);

  useEffect(() => {
    customLyricsRef.current = customLyrics;
  }, [customLyrics]);

  const isPlaying = playbackState?.state === State.Playing;

  // 1. Setup TrackPlayer once (with foreground retry on startup race)
  useEffect(() => {
    let mounted = true;
    let setupStarted = false;
    let setupSucceeded = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    const initPlayer = async () => {
      if (!isNativePlayerAvailable || !mounted || setupStarted || setupSucceeded) return;
      setupStarted = true;
      try {
        try {
          await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
        } catch (err: any) {
          const code = String(err?.code || '');
          const message = String(err?.message || '');
          const alreadyInit =
            code.includes('player_already_initialized') ||
            message.toLowerCase().includes('already been initialized');
          if (!alreadyInit) {
            throw err;
          }
        }

        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.Stop,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
          ],
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
          ],
        });
        setupSucceeded = true;
        if (mounted) setIsInitialized(true);

        // Hydrate active track & queue if MusicService was already playing in background
        try {
          const [activeTrack, activeIndex, activeQueue] = await Promise.all([
            TrackPlayer.getActiveTrack(),
            TrackPlayer.getActiveTrackIndex(),
            TrackPlayer.getQueue(),
          ]);
          if (!mounted) return;
          if (Array.isArray(activeQueue) && activeQueue.length > 0) {
            nativeQueueLoadedRef.current = true;
            const mappedQueue: AudioTrack[] = activeQueue.map((t) => ({
              id: String(t.id || t.url),
              uri: String(t.url),
              name: t.title || 'Música',
              artist: t.artist || 'Artista Desconhecido',
              album: t.album,
              artworkUrl: typeof t.artwork === 'string' ? t.artwork : undefined,
            }));
            setQueue(mappedQueue);
            setBaseQueue(mappedQueue);
          }
          if (typeof activeIndex === 'number' && activeIndex >= 0) {
            setCurrentIndex(activeIndex);
          }
          if (activeTrack) {
            setCurrentTrack({
              id: String(activeTrack.id || activeTrack.url),
              uri: String(activeTrack.url),
              name: activeTrack.title || 'Música',
              artist: activeTrack.artist || 'Artista Desconhecido',
              album: activeTrack.album,
              artworkUrl:
                typeof activeTrack.artwork === 'string'
                  ? activeTrack.artwork
                  : undefined,
            });
          }
        } catch {
          // Service may have an empty queue initially
        }
      } catch (e: any) {
        setupStarted = false;
        console.warn('Erro ao configurar TrackPlayer:', e);
        if (mounted && retryCount < maxRetries) {
          const delayMs = 300 * Math.pow(2, retryCount);
          retryCount += 1;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (mounted && !setupSucceeded) {
              initPlayer();
            }
          }, delayMs);
        }
      }
    };

    initPlayer();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && mounted && !setupSucceeded) {
        initPlayer();
      }
    });

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      appStateSub.remove();
    };
  }, []);

  // 2. Load persisted data once
  useEffect(() => {
    let mounted = true;
    const loadStorage = async () => {
      try {
        const [
          tracks,
          playlists,
          covers,
          lyrics,
          savedSettings,
          savedFavorites,
          savedOffsets,
          savedFolders,
          savedSession,
          tourDone,
        ] = await Promise.all([
          loadLibraryTracks(),
          loadUserPlaylists(),
          loadCustomCovers(),
          loadCustomLyrics(),
          loadAppSettings(),
          loadFavoriteUris(),
          loadLyricOffsets(),
          loadWatchedFolders(),
          loadPlaybackSession(),
          loadHasCompletedTour(),
        ]);
        if (!mounted) return;
        setLibraryTracks(tracks);
        setUserPlaylists(playlists);
        setCustomCovers(covers);
        setCustomLyrics(lyrics);
        setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
        setFavoriteUris(savedFavorites);
        setLyricOffsets(savedOffsets);
        setWatchedFolders(savedFolders);
        setHasCompletedTour(tourDone);
        hasCompletedTourRef.current = tourDone;

        // Restore last playback queue & track only if TrackPlayer wasn't already running in background
        if (!nativeQueueLoadedRef.current) {
          const trackByUri = new Map(tracks.map((t) => [t.uri, t]));
          const restoredQueue =
            savedSession?.queueUris
              ?.map((u) => trackByUri.get(u))
              .filter((t): t is AudioTrack => !!t) || [];
          const targetQueue = restoredQueue.length > 0 ? restoredQueue : tracks;
          setQueue(targetQueue);
          setBaseQueue(targetQueue);

          if (savedSession?.isShuffle !== undefined) {
            setIsShuffle(savedSession.isShuffle);
          }
          if (savedSession?.repeatMode) {
            setRepeatMode(savedSession.repeatMode);
          }
          if (savedSession?.currentUri) {
            const idx = targetQueue.findIndex((t) => t.uri === savedSession.currentUri);
            if (idx >= 0) {
              setCurrentIndex(idx);
              setCurrentTrack(targetQueue[idx]);
              restoredPositionSecRef.current = savedSession.positionSec || 0;
            }
          }
        }

        // Migrate any legacy inline base64 data: covers to disk files asynchronously so startup stays fast
        const inlineEntries = Object.entries(covers).filter(([, uri]) => uri.startsWith('data:'));
        if (inlineEntries.length > 0) {
          setTimeout(async () => {
            const migrated: Record<string, string> = {};
            for (const [trackUri, dataUri] of inlineEntries) {
              const t = tracks.find((item) => item.uri === trackUri);
              const fileUri = await cacheArtworkFromUri(
                t?.name || trackUri,
                t?.artist || 'Artista',
                dataUri,
                t?.album
              );
              if (fileUri !== dataUri) {
                migrated[trackUri] = fileUri;
              }
            }
            if (mounted && Object.keys(migrated).length > 0) {
              setCustomCovers((prev) => ({ ...prev, ...migrated }));
            }
          }, 800);
        }
      } catch (e) {
        console.warn('Erro ao carregar dados salvos:', e);
      } finally {
        storageLoadedRef.current = true;
        if (mounted) setIsStorageLoaded(true);
      }
    };
    loadStorage();
    return () => {
      mounted = false;
    };
  }, []);

  // 3. Persist changes
  useEffect(() => {
    if (storageLoadedRef.current) saveLibraryTracks(libraryTracks);
  }, [libraryTracks]);

  useEffect(() => {
    if (storageLoadedRef.current) saveUserPlaylists(userPlaylists);
  }, [userPlaylists]);

  useEffect(() => {
    if (storageLoadedRef.current) saveCustomCovers(customCovers);
  }, [customCovers]);

  useEffect(() => {
    if (storageLoadedRef.current) saveCustomLyrics(customLyrics);
  }, [customLyrics]);

  useEffect(() => {
    if (storageLoadedRef.current) saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (storageLoadedRef.current) saveFavoriteUris(favoriteUris);
  }, [favoriteUris]);

  useEffect(() => {
    if (storageLoadedRef.current) saveLyricOffsets(lyricOffsets);
  }, [lyricOffsets]);

  useEffect(() => {
    if (storageLoadedRef.current) saveWatchedFolders(watchedFolders);
  }, [watchedFolders]);

  useEffect(() => {
    if (!storageLoadedRef.current || queue.length === 0) return;
    savePlaybackSession({
      queueUris: queue.map((t) => t.uri),
      currentUri: currentTrack?.uri,
      positionSec: restoredPositionSecRef.current,
      isShuffle,
      repeatMode,
    });
  }, [queue, currentTrack?.uri, isShuffle, repeatMode]);

  // 4. Listen to TrackPlayer active track changes (and end-of-track sleep timer)
  const events = isNativePlayerAvailable
    ? [Event.PlaybackActiveTrackChanged, Event.PlaybackQueueEnded]
    : [];
  useTrackPlayerEvents(events, async (event) => {
    if (event.type === Event.PlaybackQueueEnded) {
      if (sleepTimerRef.current.untilTrackEnd) {
        setSleepTimer({ endTimeMs: null, untilTrackEnd: false });
      }
      return;
    }

    if (event.type === Event.PlaybackActiveTrackChanged) {
      if (sleepTimerRef.current.untilTrackEnd && event.lastTrack) {
        setSleepTimer({ endTimeMs: null, untilTrackEnd: false });
        try {
          await TrackPlayer.pause();
        } catch {
          // Ignore pause error
        }
      }

      if (event.track) {
        restoredPositionSecRef.current = 0;
        try {
          const idx = await TrackPlayer.getActiveTrackIndex();
          const activeIdx = idx ?? -1;
          setCurrentIndex(activeIdx);

          const fromQueue = activeIdx >= 0 ? queueRef.current[activeIdx] : undefined;
          if (fromQueue) {
            setCurrentTrack(fromQueue);
          } else {
            setCurrentTrack({
              id: String(event.track.id || event.track.url),
              uri: String(event.track.url),
              name: event.track.title || 'Música',
              artist: event.track.artist || 'Artista Desconhecido',
              album: event.track.album,
              artworkUrl: typeof event.track.artwork === 'string' ? event.track.artwork : undefined,
            });
          }
        } catch (e) {
          console.warn('Erro ao sincronizar faixa ativa:', e);
        }
      }
    }
  });

  const formatForTrackPlayer = useCallback((tracks: AudioTrack[]) => {
    return tracks.map((t) => ({
      id: t.id || t.uri,
      url: t.uri,
      title: t.name,
      artist: t.artist || 'Artista Desconhecido',
      album: t.album,
      artwork: customCoversRef.current[t.uri] || t.artworkUrl,
    }));
  }, []);

  const playQueue = useCallback(
    async (tracks: AudioTrack[], startIndex = 0) => {
      if (!tracks.length) return;
      if (!isNativePlayerAvailable || !isInitialized) {
        Alert.alert('Aviso', 'O player nativo só funciona no dispositivo Android.');
        return;
      }

      const safeStart = Math.max(0, Math.min(startIndex, tracks.length - 1));
      const selected = tracks[safeStart];
      setBaseQueue(tracks);

      let targetQueue = tracks;
      let targetIndex = safeStart;

      if (isShuffle && tracks.length > 1) {
        const rest = tracks.filter((_, idx) => idx !== safeStart);
        targetQueue = [selected, ...shuffleArray(rest)];
        targetIndex = 0;
      }

      setQueue(targetQueue);
      setCurrentTrack(selected);
      setCurrentIndex(targetIndex);

      try {
        nativeQueueLoadedRef.current = true;
        await TrackPlayer.reset();
        await TrackPlayer.add(formatForTrackPlayer(targetQueue));
        await TrackPlayer.setRepeatMode(toRNTPRepeatMode(repeatMode));
        if (targetIndex > 0) {
          await TrackPlayer.skip(targetIndex);
        }
        await TrackPlayer.play();
      } catch (e) {
        console.error('Erro ao reproduzir fila:', e);
        Alert.alert('Erro', 'Não foi possível reproduzir esta música.');
      }
    },
    [formatForTrackPlayer, isInitialized, isShuffle, repeatMode]
  );

  const playTrack = useCallback(
    async (track: AudioTrack, sourceList?: AudioTrack[]) => {
      const list = sourceList && sourceList.length > 0 ? sourceList : libraryTracks;
      const existingIdx = list.findIndex((t) => t.uri === track.uri);
      if (existingIdx >= 0) {
        await playQueue(list, existingIdx);
      } else {
        const nextList = [track, ...list];
        await playQueue(nextList, 0);
      }
    },
    [libraryTracks, playQueue]
  );

  const insertInQueue = useCallback(
    async (track: AudioTrack, playImmediatelyAfterCurrent: boolean) => {
      if (!currentTrack || queue.length === 0 || !nativeQueueLoadedRef.current) {
        await playTrack(track);
        return;
      }
      if (!isNativePlayerAvailable || !isInitialized) return;

      const safeCurr = Math.max(0, Math.min(currentIndex, queue.length - 1));
      const insertIdx = playImmediatelyAfterCurrent ? safeCurr + 1 : queue.length;
      const [tpTrack] = formatForTrackPlayer([track]);

      try {
        if (insertIdx < queue.length) {
          await TrackPlayer.add([tpTrack], insertIdx);
        } else {
          await TrackPlayer.add([tpTrack]);
        }
        setQueue((prev) => {
          const next = [...prev];
          next.splice(Math.min(insertIdx, next.length), 0, track);
          return next;
        });
        setBaseQueue((prev) =>
          prev.some((t) => t.uri === track.uri) ? prev : [...prev, track]
        );
      } catch (e) {
        console.warn('Erro ao adicionar na fila:', e);
      }
    },
    [currentIndex, currentTrack, formatForTrackPlayer, isInitialized, playTrack, queue.length]
  );

  const playNextInQueue = useCallback(
    (track: AudioTrack) => insertInQueue(track, true),
    [insertInQueue]
  );

  const addToQueue = useCallback(
    (track: AudioTrack) => insertInQueue(track, false),
    [insertInQueue]
  );

  const jumpToQueueIndex = useCallback(
    async (index: number) => {
      if (!isNativePlayerAvailable || !isInitialized) return;
      if (index < 0 || index >= queue.length) return;
      try {
        if (!nativeQueueLoadedRef.current) {
          await playQueue(queue, index);
          return;
        }
        await TrackPlayer.skip(index);
        await TrackPlayer.play();
      } catch (e) {
        console.warn('Erro ao pular na fila:', e);
      }
    },
    [isInitialized, playQueue, queue]
  );

  const togglePlayPause = useCallback(async () => {
    if (!isNativePlayerAvailable || !isInitialized) return;

    if (!nativeQueueLoadedRef.current) {
      if (queue.length > 0) {
        const startIdx = currentIndex >= 0 ? currentIndex : 0;
        nativeQueueLoadedRef.current = true;
        await TrackPlayer.reset();
        await TrackPlayer.add(formatForTrackPlayer(queue));
        await TrackPlayer.setRepeatMode(toRNTPRepeatMode(repeatMode));
        if (startIdx > 0) {
          await TrackPlayer.skip(startIdx);
        }
        if (restoredPositionSecRef.current > 0) {
          await TrackPlayer.seekTo(restoredPositionSecRef.current);
        }
        await TrackPlayer.play();
      }
      return;
    }

    if (isPlaying) {
      try {
        restoredPositionSecRef.current = await TrackPlayer.getPosition();
      } catch {
        // Ignore position read failure
      }
      await TrackPlayer.pause();
    } else {
      try {
        if (playbackState?.state === State.Ended) {
          await TrackPlayer.seekTo(0);
        } else {
          const prog = await TrackPlayer.getProgress();
          if (prog.duration > 0 && prog.position >= prog.duration - 0.5) {
            await TrackPlayer.seekTo(0);
          }
        }
      } catch {
        // Fallback to play directly
      }
      await TrackPlayer.play();
    }
  }, [
    currentIndex,
    formatForTrackPlayer,
    isInitialized,
    isPlaying,
    playbackState?.state,
    queue,
    repeatMode,
  ]);

  const playNext = useCallback(async () => {
    if (!isNativePlayerAvailable || !isInitialized) return;
    try {
      await TrackPlayer.skipToNext();
    } catch {
      if (queue.length > 0 && repeatMode === 'all') {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      }
    }
  }, [isInitialized, queue.length, repeatMode]);

  const playPrevious = useCallback(async () => {
    if (!isNativePlayerAvailable || !isInitialized) return;
    try {
      const pos = await TrackPlayer.getPosition();
      if (pos > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch {
      await TrackPlayer.seekTo(0);
    }
  }, [isInitialized]);

  const seekTo = useCallback(
    async (posMs: number) => {
      if (!isNativePlayerAvailable || !isInitialized) return;
      await TrackPlayer.seekTo(Math.max(0, posMs) / 1000);
    },
    [isInitialized]
  );

  const skipForward = useCallback(
    async (seconds = 10) => {
      if (!isNativePlayerAvailable || !isInitialized) return;
      const pos = await TrackPlayer.getPosition();
      await TrackPlayer.seekTo(pos + seconds);
    },
    [isInitialized]
  );

  const skipBackward = useCallback(
    async (seconds = 10) => {
      if (!isNativePlayerAvailable || !isInitialized) return;
      const pos = await TrackPlayer.getPosition();
      await TrackPlayer.seekTo(Math.max(0, pos - seconds));
    },
    [isInitialized]
  );

  const toggleShuffle = useCallback(async () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);

    if (!isNativePlayerAvailable || !isInitialized || queue.length <= 1 || !currentTrack) {
      return;
    }

    try {
      const currentPos = await TrackPlayer.getPosition();
      const wasPlaying = isPlaying;

      let reordered: AudioTrack[];
      let newIndex: number;

      if (nextShuffle) {
        const rest = baseQueue.filter((t) => t.uri !== currentTrack.uri);
        reordered = [currentTrack, ...shuffleArray(rest)];
        newIndex = 0;
      } else {
        reordered = baseQueue.length > 0 ? baseQueue : queue;
        const foundIdx = reordered.findIndex((t) => t.uri === currentTrack.uri);
        newIndex = foundIdx >= 0 ? foundIdx : 0;
      }

      setQueue(reordered);
      setCurrentIndex(newIndex);

      await TrackPlayer.reset();
      await TrackPlayer.add(formatForTrackPlayer(reordered));
      await TrackPlayer.setRepeatMode(toRNTPRepeatMode(repeatMode));
      if (newIndex > 0) {
        await TrackPlayer.skip(newIndex);
      }
      if (currentPos > 0) {
        await TrackPlayer.seekTo(currentPos);
      }
      if (wasPlaying) {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.warn('Erro ao alternar shuffle:', e);
    }
  }, [
    baseQueue,
    currentTrack,
    formatForTrackPlayer,
    isInitialized,
    isPlaying,
    isShuffle,
    queue,
    repeatMode,
  ]);

  const cycleRepeatMode = useCallback(async () => {
    const next: RepeatMode =
      repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    setRepeatMode(next);
    if (isNativePlayerAvailable && isInitialized) {
      await TrackPlayer.setRepeatMode(toRNTPRepeatMode(next));
    }
  }, [isInitialized, repeatMode]);

  const addTracksToLibrary = useCallback(
    (
      tracks: AudioTrack[],
      extraCovers?: Record<string, string>,
      extraLyrics?: Record<string, string>
    ) => {
      if (tracks.length > 0) {
        setLibraryTracks((prev) => {
          const existingUris = new Set(prev.map((t) => t.uri));
          const uniqueNew = tracks.filter((t) => !existingUris.has(t.uri));
          return [...uniqueNew, ...prev];
        });
      }
      if (extraCovers && Object.keys(extraCovers).length > 0) {
        setCustomCovers((prev) => ({ ...prev, ...extraCovers }));
      }
      if (extraLyrics && Object.keys(extraLyrics).length > 0) {
        setCustomLyrics((prev) => ({ ...prev, ...extraLyrics }));
      }
    },
    []
  );

  const removeTrackFromLibrary = useCallback(
    (uri: string) => {
      setLibraryTracks((prev) => {
        const remaining = prev.filter((t) => t.uri !== uri);
        const stillUsed = remaining.some((t) => t.uri === uri);
        if (!stillUsed && uri.startsWith('file://')) {
          const filePath = uri.replace(/^file:\/\//, '');
          if (filePath.startsWith(RNFS.DocumentDirectoryPath)) {
            RNFS.unlink(filePath).catch(() => {});
          }
        }
        return remaining;
      });
      setFavoriteUris((prev) => prev.filter((u) => u !== uri));
      setCustomCovers((prev) => {
        const next = { ...prev };
        delete next[uri];
        return next;
      });
      setCustomLyrics((prev) => {
        const next = { ...prev };
        delete next[uri];
        return next;
      });
      setLyricOffsets((prev) => {
        const next = { ...prev };
        delete next[uri];
        return next;
      });
      setUserPlaylists((prev) =>
        prev.map((pl) => ({
          ...pl,
          trackUris: pl.trackUris.filter((u) => u !== uri),
        }))
      );
      if (currentTrack?.uri === uri && isNativePlayerAvailable && isInitialized) {
        TrackPlayer.pause();
      }
    },
    [currentTrack?.uri, isInitialized]
  );

  const setTrackCover = useCallback((uri: string, coverUri: string) => {
    setCustomCovers((prev) => ({ ...prev, [uri]: coverUri }));
  }, []);

  const setTrackLyrics = useCallback((uri: string, lyricsText: string) => {
    setCustomLyrics((prev) => ({ ...prev, [uri]: lyricsText }));
  }, []);

  const getTrackArtwork = useCallback(
    (track: AudioTrack | null | undefined) => {
      if (!track) return undefined;
      return customCovers[track.uri] || track.artworkUrl;
    },
    [customCovers]
  );

  const resolveLyricsForTrack = useCallback(
    async (track: AudioTrack): Promise<string | undefined> => {
      if (customLyrics[track.uri]) {
        return customLyrics[track.uri];
      }

      const parsed = parseFilename(track.name);
      const artistName =
        track.artist && track.artist !== 'Artista Desconhecido'
          ? track.artist
          : parsed.artist;
      const songTitle = parsed.title || track.name;
      const albumName = track.album || parsed.album;

      const cached = await getCachedTrackAssets(songTitle, artistName, albumName);
      if (cached.artworkUri && !customCovers[track.uri]) {
        setCustomCovers((prev) => ({ ...prev, [track.uri]: cached.artworkUri! }));
      }
      if (cached.lyrics) {
        setCustomLyrics((prev) => ({ ...prev, [track.uri]: cached.lyrics! }));
        return cached.lyrics;
      }

      const offlineMeta = await extractOfflineMetadata(track.uri);
      let embeddedUri = offlineMeta.artworkUrl;
      if (embeddedUri && embeddedUri.startsWith('data:')) {
        embeddedUri = await cacheArtworkFromUri(songTitle, artistName, embeddedUri, albumName);
      }
      if (embeddedUri && (!customCovers[track.uri] || settings.preferEmbeddedArtwork)) {
        setCustomCovers((prev) => ({ ...prev, [track.uri]: embeddedUri! }));
      }

      const hasCover = !!customCovers[track.uri] || !!embeddedUri || !!track.artworkUrl;
      const resolved = await resolveOfflineTrackAssets(
        songTitle,
        artistName,
        {
          fetchArtwork: settings.autoFetchArtwork && !hasCover,
          fetchLyrics: settings.autoFetchLyrics,
          hdArtworkQuality: settings.hdArtworkQuality,
        },
        albumName
      );

      if (resolved.artworkUri && !customCovers[track.uri]) {
        setCustomCovers((prev) => ({ ...prev, [track.uri]: resolved.artworkUri! }));
      }
      if (resolved.lyrics) {
        setCustomLyrics((prev) => ({ ...prev, [track.uri]: resolved.lyrics! }));
        return resolved.lyrics;
      }
      return undefined;
    },
    [
      customCovers,
      customLyrics,
      settings.autoFetchArtwork,
      settings.autoFetchLyrics,
      settings.hdArtworkQuality,
      settings.preferEmbeddedArtwork,
    ]
  );

  const syncAllLibraryAssets = useCallback(async () => {
    if (syncingRef.current) return;
    if (libraryTracks.length === 0) {
      Alert.alert('Biblioteca Vazia', 'Adicione músicas primeiro.');
      return;
    }
    syncingRef.current = true;
    setIsSyncingAssets(true);
    const total = libraryTracks.length;
    setSyncProgress({ current: 0, total });

    let updatedCount = 0;
    const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16));

    const processTrack = async (track: AudioTrack) => {
      const parsed = parseFilename(track.name);
      const artistName =
        track.artist && track.artist !== 'Artista Desconhecido'
          ? track.artist
          : parsed.artist;
      const songTitle = parsed.title || track.name;
      const albumName = track.album || parsed.album;

      let hasCover = !!customCoversRef.current[track.uri] || !!track.artworkUrl;
      const hasLyrics = !!customLyricsRef.current[track.uri];

      if (hasCover && hasLyrics && !settings.preferEmbeddedArtwork) {
        return {};
      }

      let newCover: string | undefined;
      let newLyrics: string | undefined;

      if (!hasCover || settings.preferEmbeddedArtwork) {
        try {
          const meta = await extractOfflineMetadata(track.uri);
          if (meta.artworkUrl) {
            newCover = meta.artworkUrl.startsWith('data:')
              ? await cacheArtworkFromUri(songTitle, artistName, meta.artworkUrl, albumName)
              : meta.artworkUrl;
            hasCover = true;
          }
        } catch {
          // Ignore single track metadata read error
        }
      }

      const needRemoteCover = !hasCover;
      const needRemoteLyrics = settings.autoFetchLyrics && !hasLyrics;

      if (needRemoteCover || needRemoteLyrics) {
        const resolved = await resolveOfflineTrackAssets(
          songTitle,
          artistName,
          {
            fetchArtwork: needRemoteCover,
            fetchLyrics: needRemoteLyrics,
            hdArtworkQuality: settings.hdArtworkQuality,
          },
          albumName
        );
        if (resolved.artworkUri && !hasCover) {
          newCover = resolved.artworkUri;
        }
        if (resolved.lyrics && !hasLyrics) {
          newLyrics = resolved.lyrics;
        }
      }

      return { newCover, newLyrics };
    };

    try {
      const CONCURRENCY = 3;
      for (let i = 0; i < total; i += CONCURRENCY) {
        const batch = libraryTracks.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (track) => {
            const res = await processTrack(track);
            return { uri: track.uri, ...res };
          })
        );

        const coverUpdates: Record<string, string> = {};
        const lyricUpdates: Record<string, string> = {};

        for (const item of results) {
          if (item.newCover) {
            coverUpdates[item.uri] = item.newCover;
            updatedCount++;
          }
          if (item.newLyrics) {
            lyricUpdates[item.uri] = item.newLyrics;
            updatedCount++;
          }
        }

        if (Object.keys(coverUpdates).length > 0) {
          setCustomCovers((prev) => ({ ...prev, ...coverUpdates }));
        }
        if (Object.keys(lyricUpdates).length > 0) {
          setCustomLyrics((prev) => ({ ...prev, ...lyricUpdates }));
        }

        setSyncProgress({ current: Math.min(i + batch.length, total), total });
        await yieldFrame();
      }
      Alert.alert('Sincronização Concluída', `${updatedCount} itens atualizados.`);
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a sincronização.');
    } finally {
      syncingRef.current = false;
      setIsSyncingAssets(false);
      setSyncProgress(null);
    }
  }, [
    libraryTracks,
    settings.autoFetchLyrics,
    settings.hdArtworkQuality,
    settings.preferEmbeddedArtwork,
  ]);

  const createPlaylist = useCallback((name: string, initialTrackUri?: string): Playlist => {
    const newPl: Playlist = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      trackUris: initialTrackUri ? [initialTrackUri] : [],
      createdAt: Date.now(),
    };
    setUserPlaylists((prev) => [newPl, ...prev]);
    return newPl;
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setUserPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, trackUri: string) => {
    setUserPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              trackUris: pl.trackUris.includes(trackUri)
                ? pl.trackUris
                : [...pl.trackUris, trackUri],
            }
          : pl
      )
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackUri: string) => {
    setUserPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, trackUris: pl.trackUris.filter((u) => u !== trackUri) }
          : pl
      )
    );
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearAllCache = useCallback(async () => {
    await clearAssetsCache();
    setCustomCovers({});
    setCustomLyrics({});
  }, []);

  // Favorites
  const favoriteSet = useMemo(() => new Set(favoriteUris), [favoriteUris]);
  const isFavorite = useCallback((uri: string) => favoriteSet.has(uri), [favoriteSet]);
  const toggleFavorite = useCallback((uri: string) => {
    setFavoriteUris((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [uri, ...prev]
    );
  }, []);

  // Lyric sync offset (ms) per track
  const getLyricOffset = useCallback(
    (uri: string) => lyricOffsets[uri] || 0,
    [lyricOffsets]
  );

  const adjustLyricOffset = useCallback((uri: string, deltaMs: number) => {
    setLyricOffsets((prev) => {
      const nextVal = Math.max(-15000, Math.min(15000, (prev[uri] || 0) + deltaMs));
      return { ...prev, [uri]: nextVal };
    });
  }, []);

  const resetLyricOffset = useCallback((uri: string) => {
    setLyricOffsets((prev) => {
      if (!(uri in prev)) return prev;
      const next = { ...prev };
      delete next[uri];
      return next;
    });
  }, []);

  // Sleep Timer
  const setSleepTimerMinutes = useCallback((minutes: number) => {
    const endTimeMs = Date.now() + Math.max(1, minutes) * 60 * 1000;
    setSleepTimer({ endTimeMs, untilTrackEnd: false });
  }, []);

  const setSleepTimerEndOfTrack = useCallback(() => {
    setSleepTimer({ endTimeMs: null, untilTrackEnd: true });
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimer({ endTimeMs: null, untilTrackEnd: false });
  }, []);

  useEffect(() => {
    if (!sleepTimer.endTimeMs) return;
    const msRemaining = Math.max(0, sleepTimer.endTimeMs - Date.now());
    const timer = setTimeout(async () => {
      setSleepTimer({ endTimeMs: null, untilTrackEnd: false });
      if (isNativePlayerAvailable && isInitialized) {
        try {
          await TrackPlayer.pause();
        } catch {
          // Ignore pause failure
        }
      }
    }, msRemaining);
    return () => clearTimeout(timer);
  }, [isInitialized, sleepTimer.endTimeMs]);

  // Folder Watch & Auto-Sync
  const enrichNewTracksAsync = useCallback(
    (tracks: AudioTrack[], existingLyrics: Record<string, string>, existingCovers: Record<string, string>) => {
      if (!tracks.length) return;
      setTimeout(async () => {
        const cfg = settingsRef.current;
        for (const t of tracks) {
          try {
            let embeddedUri: string | undefined;
            const meta = await extractOfflineMetadata(t.uri);
            if (meta.artworkUrl) {
              embeddedUri = meta.artworkUrl.startsWith('data:')
                ? await cacheArtworkFromUri(t.name, t.artist, meta.artworkUrl, t.album)
                : meta.artworkUrl;
              if (embeddedUri && (!existingCovers[t.uri] || cfg.preferEmbeddedArtwork)) {
                setCustomCovers((prev) => ({ ...prev, [t.uri]: embeddedUri! }));
              }
            }
            const hasCover = !!embeddedUri || !!existingCovers[t.uri] || !!t.artworkUrl;
            const res = await resolveOfflineTrackAssets(
              t.name,
              t.artist,
              {
                fetchArtwork: cfg.autoFetchArtwork && !hasCover,
                fetchLyrics: cfg.autoFetchLyrics && !existingLyrics[t.uri],
                hdArtworkQuality: cfg.hdArtworkQuality,
              },
              t.album
            );
            if (res.artworkUri && !hasCover) {
              setCustomCovers((prev) => ({ ...prev, [t.uri]: res.artworkUri! }));
            }
            if (res.lyrics && !existingLyrics[t.uri]) {
              setCustomLyrics((prev) => ({ ...prev, [t.uri]: res.lyrics! }));
            }
          } catch {
            // Ignore per-track background enrichment failure
          }
          await new Promise<void>((r) => setTimeout(r, 16));
        }
      }, 200);
    },
    []
  );

  const scanSingleFolder = useCallback(
    async (folderUri: string): Promise<{ folderName: string; added: AudioTrack[] }> => {
      const scanner = NativeModules?.FolderScanner;
      if (!scanner || typeof scanner.scanFolder !== 'function') {
        return { folderName: 'Pasta', added: [] };
      }

      const scanResult = await scanner.scanFolder(folderUri);
      const folderName: string = scanResult?.folderName || 'Pasta de Músicas';
      const files: Array<{ uri: string; name: string; folderName?: string }> =
        Array.isArray(scanResult?.files) ? scanResult.files : [];

      const audioFiles = files.filter((f) => isAudioFile(f.name));
      const imageFiles = files.filter((f) => isImageFile(f.name));
      const lyricFiles = files.filter((f) => isLyricsFile(f.name));

      // Group folder covers by immediate subfolder so unrelated albums don't share the same cover
      const coverBySubfolder = new Map<string, string>();
      const folderImages = new Map<string, typeof imageFiles>();
      for (const img of imageFiles) {
        const key = img.folderName || folderName;
        const list = folderImages.get(key) || [];
        list.push(img);
        folderImages.set(key, list);
      }
      folderImages.forEach((imgs, key) => {
        const preferred =
          imgs.find((img) => /^(cover|folder|album|front)\./i.test(img.name)) || imgs[0];
        if (preferred) {
          coverBySubfolder.set(key, normalizeMediaUri(preferred.uri));
        }
      });

      const existingUris = new Set(libraryTracksRef.current.map((t) => t.uri));
      const existingFolderNames = new Set(
        libraryTracksRef.current
          .filter((t) => t.folderUri === folderUri)
          .map((t) => `${t.artist.toLowerCase()}::${t.name.toLowerCase()}`)
      );

      const newAudioFiles = audioFiles.filter((f) => {
        if (existingUris.has(f.uri)) return false;
        const parsed = parseFilename(f.name);
        return !existingFolderNames.has(
          `${parsed.artist.toLowerCase()}::${parsed.title.toLowerCase()}`
        );
      });

      if (newAudioFiles.length === 0) {
        return { folderName, added: [] };
      }

      const coversMap: Record<string, string> = {};
      const lyricsMap: Record<string, string> = {};

      for (const lf of lyricFiles) {
        const stem = lf.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const matched = newAudioFiles.find((af) =>
          af.name.toLowerCase().includes(stem)
        );
        if (matched) {
          const text = await getTextFromUri(lf.uri);
          if (text.trim()) {
            lyricsMap[matched.uri] = text;
          }
        }
      }

      const newTracks: AudioTrack[] = newAudioFiles.map((af) => {
        const parsed = parseFilename(af.name);
        const subfolderKey = af.folderName || folderName;
        const matchedFolderCover = coverBySubfolder.get(subfolderKey);
        if (matchedFolderCover) {
          coversMap[af.uri] = matchedFolderCover;
        }
        return {
          id: af.uri,
          uri: af.uri,
          name: parsed.title,
          artist: parsed.artist,
          album: parsed.album || af.folderName || folderName,
          artworkUrl: matchedFolderCover,
          folderUri,
          addedAt: Date.now(),
        };
      });

      addTracksToLibrary(newTracks, coversMap, lyricsMap);
      enrichNewTracksAsync(newTracks, lyricsMap, coversMap);
      return { folderName, added: newTracks };
    },
    [addTracksToLibrary, enrichNewTracksAsync]
  );

  const syncWatchedFolders = useCallback(
    async (showFeedback = false): Promise<number> => {
      const folders = watchedFoldersRef.current;
      if (!folders.length || folderScanRef.current) return 0;
      folderScanRef.current = true;
      setIsScanningFolders(true);
      let totalAdded = 0;

      try {
        const updatedFolders: WatchedFolder[] = [];
        for (const folder of folders) {
          try {
            const { folderName, added } = await scanSingleFolder(folder.uri);
            totalAdded += added.length;
            updatedFolders.push({
              ...folder,
              name: folderName || folder.name,
              lastSyncedAt: Date.now(),
            });
          } catch {
            updatedFolders.push(folder);
          }
        }
        setWatchedFolders(updatedFolders);
        if (totalAdded > 0 && !hasCompletedTourRef.current) {
          setIsTourVisible(true);
        }
        if (showFeedback) {
          Alert.alert(
            'Pastas Verificadas',
            totalAdded > 0
              ? `${totalAdded} ${totalAdded === 1 ? 'nova música adicionada' : 'novas músicas adicionadas'}!`
              : 'Nenhuma música nova encontrada nas pastas monitoradas.'
          );
        }
      } finally {
        folderScanRef.current = false;
        lastFolderScanTsRef.current = Date.now();
        setIsScanningFolders(false);
      }
      return totalAdded;
    },
    [scanSingleFolder]
  );

  const importFolder = useCallback(async () => {
    try {
      const dir = await pickDirectory({ requestLongTermAccess: true });
      if (!dir?.uri) return;

      const scanner = NativeModules?.FolderScanner;
      if (scanner && typeof scanner.takePersistablePermission === 'function') {
        await scanner.takePersistablePermission(dir.uri);
      }

      folderScanRef.current = true;
      setIsScanningFolders(true);
      try {
        const { folderName, added } = await scanSingleFolder(dir.uri);
        setWatchedFolders((prev) => {
          const exists = prev.some((f) => f.uri === dir.uri);
          if (exists) {
            return prev.map((f) =>
              f.uri === dir.uri ? { ...f, name: folderName, lastSyncedAt: Date.now() } : f
            );
          }
          return [
            { uri: dir.uri, name: folderName, addedAt: Date.now(), lastSyncedAt: Date.now() },
            ...prev,
          ];
        });

        if (added.length > 0 && !hasCompletedTourRef.current) {
          setIsTourVisible(true);
        } else {
          Alert.alert(
            'Pasta Importada',
            added.length > 0
              ? `"${folderName}" adicionada com ${added.length} ${added.length === 1 ? 'música' : 'músicas'}. Novas músicas colocadas nesta pasta aparecerão automaticamente!`
              : `Pasta "${folderName}" conectada. Adicione pelo menos 1 música lá para começar!`
          );
        }
      } finally {
        folderScanRef.current = false;
        lastFolderScanTsRef.current = Date.now();
        setIsScanningFolders(false);
      }
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
        console.warn('Erro ao importar pasta:', e);
        Alert.alert('Erro', 'Não foi possível ler a pasta selecionada.');
      }
    }
  }, [scanSingleFolder]);

  const removeWatchedFolder = useCallback(async (treeUri: string) => {
    const scanner = NativeModules?.FolderScanner;
    if (scanner && typeof scanner.releasePersistablePermission === 'function') {
      try {
        await scanner.releasePersistablePermission(treeUri);
      } catch {
        // Ignore release error
      }
    }
    setWatchedFolders((prev) => prev.filter((f) => f.uri !== treeUri));
  }, []);

  const completeTour = useCallback(() => {
    setIsTourVisible(false);
    setHasCompletedTour(true);
    hasCompletedTourRef.current = true;
    saveHasCompletedTour(true);
  }, []);

  const replayTour = useCallback(() => {
    setIsTourVisible(true);
  }, []);

  // Auto-scan watched folders after storage loads + when returning to foreground
  useEffect(() => {
    if (
      isStorageLoaded &&
      watchedFoldersRef.current.length > 0 &&
      settingsRef.current.autoSyncFoldersOnOpen
    ) {
      syncWatchedFolders(false);
    }
  }, [isStorageLoaded, syncWatchedFolders]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const now = Date.now();
        if (
          storageLoadedRef.current &&
          settingsRef.current.autoSyncFoldersOnOpen &&
          watchedFoldersRef.current.length > 0 &&
          now - lastFolderScanTsRef.current > 4000
        ) {
          syncWatchedFolders(false);
        }
      } else if (nextState === 'background' && storageLoadedRef.current && queueRef.current.length > 0) {
        try {
          const pos = isNativePlayerAvailable && isInitialized ? await TrackPlayer.getPosition() : 0;
          restoredPositionSecRef.current = pos;
          savePlaybackSession({
            queueUris: queueRef.current.map((t) => t.uri),
            currentUri: currentTrackRef.current?.uri,
            positionSec: pos,
            isShuffle,
            repeatMode,
          });
        } catch {
          // Ignore session snapshot error
        }
      }
    });
    return () => sub.remove();
  }, [isInitialized, isShuffle, repeatMode, syncWatchedFolders]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      isInitialized,
      isStorageLoaded,
      isPlaying,
      currentTrack,
      queue,
      currentIndex,
      isShuffle,
      repeatMode,
      isPlayerModalVisible,
      setPlayerModalVisible,
      libraryTracks,
      userPlaylists,
      favoriteUris,
      watchedFolders,
      customCovers,
      customLyrics,
      lyricOffsets,
      settings,
      isSyncingAssets,
      isScanningFolders,
      syncProgress,
      sleepTimer,
      playTrack,
      playQueue,
      playNextInQueue,
      addToQueue,
      jumpToQueueIndex,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      skipForward,
      skipBackward,
      toggleShuffle,
      cycleRepeatMode,
      isFavorite,
      toggleFavorite,
      getLyricOffset,
      adjustLyricOffset,
      resetLyricOffset,
      setSleepTimerMinutes,
      setSleepTimerEndOfTrack,
      cancelSleepTimer,
      importFolder,
      syncWatchedFolders,
      removeWatchedFolder,
      hasCompletedTour,
      isTourVisible,
      completeTour,
      replayTour,
      addTracksToLibrary,
      removeTrackFromLibrary,
      setTrackCover,
      setTrackLyrics,
      getTrackArtwork,
      resolveLyricsForTrack,
      syncAllLibraryAssets,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      updateSettings,
      clearAllCache,
    }),
    [
      addToQueue,
      addTrackToPlaylist,
      addTracksToLibrary,
      adjustLyricOffset,
      cancelSleepTimer,
      clearAllCache,
      completeTour,
      createPlaylist,
      currentIndex,
      currentTrack,
      customCovers,
      customLyrics,
      cycleRepeatMode,
      deletePlaylist,
      favoriteUris,
      getLyricOffset,
      getTrackArtwork,
      hasCompletedTour,
      importFolder,
      isFavorite,
      isInitialized,
      isPlayerModalVisible,
      isPlaying,
      isScanningFolders,
      isShuffle,
      isStorageLoaded,
      isSyncingAssets,
      isTourVisible,
      jumpToQueueIndex,
      libraryTracks,
      lyricOffsets,
      playNext,
      playNextInQueue,
      playPrevious,
      playQueue,
      playTrack,
      queue,
      removeTrackFromLibrary,
      removeTrackFromPlaylist,
      removeWatchedFolder,
      repeatMode,
      replayTour,
      resetLyricOffset,
      resolveLyricsForTrack,
      seekTo,
      setSleepTimerEndOfTrack,
      setSleepTimerMinutes,
      setTrackCover,
      setTrackLyrics,
      settings,
      skipBackward,
      skipForward,
      sleepTimer,
      syncAllLibraryAssets,
      syncProgress,
      syncWatchedFolders,
      toggleFavorite,
      togglePlayPause,
      toggleShuffle,
      updateSettings,
      userPlaylists,
      watchedFolders,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
    </PlayerContext.Provider>
  );
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
}
