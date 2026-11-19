import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppSettings,
  AudioTrack,
  DEFAULT_SETTINGS,
  OnlineTrack,
  Playlist,
  RepeatMode,
} from '../types/music';
import {
  clearArtworkAndLyricsCache,
  clearEntireLibrary,
  deletePlaylistRecord,
  deleteTrackRecord,
  getAllArtworkIds,
  getAllPlaylists,
  getAllTracks,
  getArtworkBlob,
  getAudioBlob,
  getLyrics,
  getSettings,
  putArtworkBlob,
  putAudioBlob,
  putLyrics,
  putPlaylist,
  putSettings,
  putTrack,
  putTracks,
  requestPersistentStorage,
} from '../utils/db';
import {
  fetchImageAsBlob,
  resolveAndCacheTrackAssets,
} from '../utils/assetCache';
import { parseFilename } from '../utils/lrcParser';
import {
  extractMetadataFromFile,
  isAudioFile,
  isImageFile,
  isLyricsFile,
} from '../utils/metadataExtractor';
import {
  downloadTrackBlob,
  fetchTrendingTracks,
} from '../services/onlineMusicService';
import { findLyrics } from '../utils/assetCache';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeTrackId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PlayerContextValue {
  // Status & Environment
  isReady: boolean;
  isOnline: boolean;
  canInstall: boolean;
  promptInstall: () => Promise<void>;
  toast: ToastMessage | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;

  // Playback state
  isPlaying: boolean;
  isBuffering: boolean;
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  currentIndex: number;
  positionMs: number;
  durationMs: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isPlayerModalVisible: boolean;
  setPlayerModalVisible: (visible: boolean) => void;

  // Library & Playlists
  libraryTracks: AudioTrack[];
  userPlaylists: Playlist[];
  settings: AppSettings;
  isSyncingAssets: boolean;
  lyricsRevision: number;

  // Playback actions
  playTrack: (track: AudioTrack, sourceList?: AudioTrack[]) => Promise<void>;
  playQueue: (tracks: AudioTrack[], startIndex?: number) => Promise<void>;
  jumpToQueueIndex: (index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seekTo: (positionMs: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;

  // Import, Online & Metadata
  importLocalFiles: (files: FileList | File[]) => Promise<void>;
  streamOnlineTrack: (track: OnlineTrack) => Promise<void>;
  downloadOnlineTrack: (track: OnlineTrack) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  updateTrackInfo: (
    trackId: string,
    info: { name: string; artist: string; album?: string }
  ) => Promise<void>;
  updateTrackCover: (trackId: string, fileOrBlob: Blob) => Promise<void>;
  updateTrackLyrics: (trackId: string, lyricsText: string) => Promise<void>;
  getTrackArtworkUrl: (track: AudioTrack | null | undefined) => string | undefined;
  resolveLyricsForTrack: (track: AudioTrack) => Promise<string | undefined>;
  syncAllLibraryAssets: () => Promise<void>;

  // Playlists
  createPlaylist: (name: string, initialTrackId?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;

  // Settings & Cache
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  clearCache: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Re-export helper
  fetchTrendingTracks: typeof fetchTrendingTracks;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef<Map<string, string>>(new Map());
  const artworkUrlCacheRef = useRef<Map<string, string>>(new Map());
  const toastTimerRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [libraryTracks, setLibraryTracks] = useState<AudioTrack[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSyncingAssets, setIsSyncingAssets] = useState(false);
  const [lyricsRevision, setLyricsRevision] = useState(0);

  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [baseQueue, setBaseQueue] = useState<AudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isPlayerModalVisible, setPlayerModalVisible] = useState(false);

  // Refs for audio event listeners so callbacks never go stale
  const queueRef = useRef<AudioTrack[]>([]);
  const currentIndexRef = useRef(-1);
  const repeatModeRef = useRef<RepeatMode>('off');
  const currentTrackRef = useRef<AudioTrack | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const showToast = useCallback(
    (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const id = Date.now();
      setToast({ id, message, type });
      toastTimerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 3200);
    },
    []
  );

  const cacheArtworkUrl = useCallback((trackId: string, blob: Blob): string => {
    const prev = artworkUrlCacheRef.current.get(trackId);
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(blob);
    artworkUrlCacheRef.current.set(trackId, url);
    setArtworkUrls((map) => ({ ...map, [trackId]: url }));
    return url;
  }, []);

  const getTrackArtworkUrl = useCallback(
    (track: AudioTrack | null | undefined): string | undefined => {
      if (!track) return undefined;
      return artworkUrls[track.id] || track.artworkUrl;
    },
    [artworkUrls]
  );

  // Online/offline & PWA install listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      showToast('Player 2.0 instalado com sucesso!', 'success');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } catch {
      // Ignore user cancellation
    }
  }, [installPromptEvent]);

  // Load persisted data from IndexedDB on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        requestPersistentStorage();
        const [tracks, playlists, savedSettings, artIds] = await Promise.all([
          getAllTracks(),
          getAllPlaylists(),
          getSettings(),
          getAllArtworkIds(),
        ]);

        const artEntries = await Promise.all(
          artIds.map(async (id) => {
            const blob = await getArtworkBlob(id);
            if (!blob) return null;
            const url = URL.createObjectURL(blob);
            artworkUrlCacheRef.current.set(id, url);
            return [id, url] as const;
          })
        );

        if (!active) {
          artEntries.forEach((entry) => {
            if (entry) URL.revokeObjectURL(entry[1]);
          });
          return;
        }

        const artMap: Record<string, string> = {};
        for (const entry of artEntries) {
          if (entry) artMap[entry[0]] = entry[1];
        }

        setLibraryTracks(tracks);
        setQueue(tracks);
        setBaseQueue(tracks);
        setUserPlaylists(playlists);
        setSettings(savedSettings);
        setArtworkUrls(artMap);
      } catch (e) {
        console.warn('Erro ao inicializar IndexedDB:', e);
      } finally {
        if (active) setIsReady(true);
      }
    };
    init();

    return () => {
      active = false;
      audioUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      artworkUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioUrlCacheRef.current.clear();
      artworkUrlCacheRef.current.clear();
    };
  }, []);

  const loadAndPlayAudioTrack = useCallback(
    async (track: AudioTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      setIsBuffering(true);
      setPositionMs(0);

      try {
        let srcUrl: string | undefined;

        if (track.sourceType === 'local' || track.sourceType === 'downloaded') {
          srcUrl = audioUrlCacheRef.current.get(track.id);
          if (!srcUrl) {
            const blob = await getAudioBlob(track.id);
            if (blob) {
              srcUrl = URL.createObjectURL(blob);
              audioUrlCacheRef.current.set(track.id, srcUrl);
            }
          }
        }

        if (!srcUrl && track.streamUrl) {
          srcUrl = track.streamUrl;
        }

        if (!srcUrl) {
          setIsBuffering(false);
          setIsPlaying(false);
          showToast('Arquivo de áudio não encontrado offline.', 'error');
          return;
        }

        audio.src = srcUrl;
        audio.currentTime = 0;
        await audio.play();
      } catch (e) {
        console.warn('Erro ao reproduzir faixa:', e);
        setIsBuffering(false);
        setIsPlaying(false);
        showToast(
          navigator.onLine
            ? 'Não foi possível reproduzir esta faixa.'
            : 'Você está offline. Baixe a faixa para ouvir sem internet.',
          'error'
        );
      }
    },
    [showToast]
  );

  const playQueue = useCallback(
    async (tracks: AudioTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
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
      setCurrentIndex(targetIndex);
      setCurrentTrack(selected);
      queueRef.current = targetQueue;
      currentIndexRef.current = targetIndex;
      currentTrackRef.current = selected;

      await loadAndPlayAudioTrack(selected);
    },
    [isShuffle, loadAndPlayAudioTrack]
  );

  const playTrack = useCallback(
    async (track: AudioTrack, sourceList?: AudioTrack[]) => {
      const list = sourceList && sourceList.length > 0 ? sourceList : libraryTracks;
      const idx = list.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        await playQueue(list, idx);
      } else {
        await playQueue([track, ...list], 0);
      }
    },
    [libraryTracks, playQueue]
  );

  const jumpToQueueIndex = useCallback(
    async (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) return;
      const next = q[index];
      setCurrentIndex(index);
      setCurrentTrack(next);
      currentIndexRef.current = index;
      currentTrackRef.current = next;
      await loadAndPlayAudioTrack(next);
    },
    [loadAndPlayAudioTrack]
  );

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const idx = currentIndexRef.current;
    const nextIdx = idx + 1;

    if (nextIdx < q.length) {
      await jumpToQueueIndex(nextIdx);
    } else if (repeatModeRef.current === 'all') {
      await jumpToQueueIndex(0);
    }
  }, [jumpToQueueIndex]);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setPositionMs(0);
      return;
    }

    const q = queueRef.current;
    if (q.length === 0) return;
    const idx = currentIndexRef.current;
    if (idx > 0) {
      await jumpToQueueIndex(idx - 1);
    } else if (repeatModeRef.current === 'all') {
      await jumpToQueueIndex(q.length - 1);
    } else if (audio) {
      audio.currentTime = 0;
      setPositionMs(0);
    }
  }, [jumpToQueueIndex]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src && currentTrackRef.current) {
      await loadAndPlayAudioTrack(currentTrackRef.current);
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch (e) {
        console.warn('Erro ao retomar reprodução:', e);
      }
    } else {
      audio.pause();
    }
  }, [loadAndPlayAudioTrack]);

  const seekTo = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedSec = Math.max(0, ms / 1000);
    audio.currentTime = clampedSec;
    setPositionMs(clampedSec * 1000);
  }, []);

  const skipForward = useCallback((seconds = 10) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxSec = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + seconds;
    const nextSec = Math.min(maxSec, audio.currentTime + seconds);
    audio.currentTime = nextSec;
    setPositionMs(nextSec * 1000);
  }, []);

  const skipBackward = useCallback((seconds = 10) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSec = Math.max(0, audio.currentTime - seconds);
    audio.currentTime = nextSec;
    setPositionMs(nextSec * 1000);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const nextShuffle = !prev;
      const active = currentTrackRef.current;
      if (queueRef.current.length <= 1 || !active) {
        return nextShuffle;
      }

      if (nextShuffle) {
        const rest = baseQueue.filter((t) => t.id !== active.id);
        const reordered = [active, ...shuffleArray(rest)];
        setQueue(reordered);
        setCurrentIndex(0);
      } else {
        const restored = baseQueue.length > 0 ? baseQueue : queueRef.current;
        const foundIdx = restored.findIndex((t) => t.id === active.id);
        setQueue(restored);
        setCurrentIndex(foundIdx >= 0 ? foundIdx : 0);
      }
      return nextShuffle;
    });
  }, [baseQueue]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) =>
      prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
    );
  }, []);

  // Setup HTMLAudioElement once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onWaiting = () => {
      setIsBuffering(true);
    };
    const onCanPlay = () => {
      setIsBuffering(false);
    };
    const onTimeUpdate = () => {
      setPositionMs((audio.currentTime || 0) * 1000);
    };
    const onLoadedMetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      setDurationMs(dur);
    };
    const onEnded = async () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        try {
          await audio.play();
        } catch {
          setIsPlaying(false);
        }
        return;
      }

      const q = queueRef.current;
      const idx = currentIndexRef.current;
      if (idx + 1 < q.length) {
        await jumpToQueueIndex(idx + 1);
      } else if (repeatModeRef.current === 'all' && q.length > 0) {
        await jumpToQueueIndex(0);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [jumpToQueueIndex]);

  // Media Session API integration (lockscreen & notification controls)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    if (currentTrack && typeof MediaMetadata !== 'undefined') {
      const art = getTrackArtworkUrl(currentTrack);
      ms.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artist || 'Artista Desconhecido',
        album: currentTrack.album || 'Player 2.0',
        artwork: art ? [{ src: art }] : [],
      });
    }

    ms.playbackState = isPlaying ? 'playing' : currentTrack ? 'paused' : 'none';
  }, [currentTrack, getTrackArtworkUrl, isPlaying]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void togglePlayPause()],
      ['pause', () => void togglePlayPause()],
      ['previoustrack', () => void playPrevious()],
      ['nexttrack', () => void playNext()],
      ['seekbackward', (details) => skipBackward(details.seekOffset || 10)],
      ['seekforward', (details) => skipForward(details.seekOffset || 10)],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            seekTo(details.seekTime * 1000);
          }
        },
      ],
      [
        'stop',
        () => {
          const audio = audioRef.current;
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported actions
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // Ignore
        }
      }
    };
  }, [playNext, playPrevious, seekTo, skipBackward, skipForward, togglePlayPause]);

  // Guarded Media Session positionState updates
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }
    const durationSec = durationMs / 1000;
    const positionSec = positionMs / 1000;
    if (
      Number.isFinite(durationSec) &&
      durationSec > 0 &&
      Number.isFinite(positionSec) &&
      positionSec >= 0 &&
      positionSec <= durationSec
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate: 1,
          position: positionSec,
        });
      } catch {
        // Ignore invalid state errors in browsers
      }
    }
  }, [durationMs, positionMs]);

  const importLocalFiles = useCallback(
    async (inputFiles: FileList | File[]) => {
      const files = Array.from(inputFiles);
      if (files.length === 0) return;

      const audioFiles = files.filter((f) => isAudioFile(f.name) || f.type.startsWith('audio/'));
      const imageFiles = files.filter((f) => isImageFile(f.name) || f.type.startsWith('image/'));
      const lyricFiles = files.filter((f) => isLyricsFile(f.name));

      if (audioFiles.length === 0) {
        showToast('Nenhum arquivo de áudio válido selecionado.', 'error');
        return;
      }

      const folderCoverBlob: Blob | undefined = imageFiles[0];
      const lyricsTextByStem = new Map<string, string>();
      for (const lf of lyricFiles) {
        try {
          const text = await lf.text();
          if (text.trim()) {
            const stem = lf.name.replace(/\.[^/.]+$/, '').toLowerCase();
            lyricsTextByStem.set(stem, text);
          }
        } catch {
          // Ignore unreadable text file
        }
      }

      const existingKeys = new Set(
        libraryTracks.map((t) => `${t.name.toLowerCase()}::${t.fileSize ?? 0}`)
      );

      const addedTracks: AudioTrack[] = [];
      for (const file of audioFiles) {
        const parsed = parseFilename(file.name);
        const meta = await extractMetadataFromFile(file);

        const title = meta.title || parsed.title;
        const artist = meta.artist || parsed.artist;
        const album = meta.album || parsed.album;

        const dedupKey = `${title.toLowerCase()}::${file.size}`;
        if (existingKeys.has(dedupKey)) {
          continue;
        }
        existingKeys.add(dedupKey);

        const id = makeTrackId('local');
        const track: AudioTrack = {
          id,
          name: title,
          artist,
          album,
          sourceType: 'local',
          addedAt: Date.now(),
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg',
        };

        await putAudioBlob(id, file);

        const coverBlob = settings.preferEmbeddedArtwork
          ? meta.artworkBlob || folderCoverBlob
          : folderCoverBlob || meta.artworkBlob;

        if (coverBlob) {
          await putArtworkBlob(id, coverBlob);
          cacheArtworkUrl(id, coverBlob);
        }

        const audioStem = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const matchedLyrics =
          lyricsTextByStem.get(audioStem) ||
          (audioFiles.length === 1 && lyricFiles.length === 1
            ? Array.from(lyricsTextByStem.values())[0]
            : undefined);

        if (matchedLyrics) {
          await putLyrics(id, matchedLyrics);
        }

        addedTracks.push(track);
      }

      if (addedTracks.length === 0) {
        showToast('Essas músicas já estão na sua biblioteca.', 'info');
        return;
      }

      await putTracks(addedTracks);
      const merged = [...addedTracks, ...libraryTracks];
      setLibraryTracks(merged);
      showToast(
        `${addedTracks.length} ${addedTracks.length === 1 ? 'música importada' : 'músicas importadas'} offline!`,
        'success'
      );

      await playQueue(merged, 0);
      setPlayerModalVisible(true);

      // Enrich missing covers & lyrics in background when online
      if (navigator.onLine && (settings.autoFetchArtwork || settings.autoFetchLyrics)) {
        void (async () => {
          for (const t of addedTracks) {
            try {
              const res = await resolveAndCacheTrackAssets(t, {
                fetchArtwork: settings.autoFetchArtwork,
                fetchLyrics: settings.autoFetchLyrics,
                hdArtworkQuality: settings.hdArtworkQuality,
              });
              if (res.artworkBlob) {
                cacheArtworkUrl(t.id, res.artworkBlob);
              }
              if (res.lyrics) {
                setLyricsRevision((r) => r + 1);
              }
            } catch {
              // Ignore individual lookup errors
            }
          }
        })();
      }
    },
    [
      cacheArtworkUrl,
      libraryTracks,
      playQueue,
      settings.autoFetchArtwork,
      settings.autoFetchLyrics,
      settings.hdArtworkQuality,
      settings.preferEmbeddedArtwork,
      showToast,
    ]
  );

  const streamOnlineTrack = useCallback(
    async (item: OnlineTrack) => {
      const existing = libraryTracks.find(
        (t) => t.streamUrl === item.streamUrl || t.id === `online-${item.id}`
      );
      if (existing) {
        await playTrack(existing, libraryTracks);
        setPlayerModalVisible(true);
        return;
      }

      const id = `online-${item.id}`;
      const track: AudioTrack = {
        id,
        name: item.title,
        artist: item.artist,
        album: item.album,
        durationMs: item.durationMs,
        sourceType: 'stream',
        streamUrl: item.streamUrl,
        artworkUrl: item.artworkUrl,
        addedAt: Date.now(),
      };

      await putTrack(track);
      const nextLibrary = [track, ...libraryTracks];
      setLibraryTracks(nextLibrary);

      if (item.artworkUrl) {
        fetchImageAsBlob(item.artworkUrl).then((blob) => {
          if (blob) {
            putArtworkBlob(id, blob).then(() => cacheArtworkUrl(id, blob));
          }
        });
      }
      findLyrics(item.title, item.artist).then((lrc) => {
        if (lrc) {
          putLyrics(id, lrc).then(() => setLyricsRevision((r) => r + 1));
        }
      });

      await playQueue(nextLibrary, 0);
      setPlayerModalVisible(true);
    },
    [cacheArtworkUrl, libraryTracks, playQueue, playTrack]
  );

  const downloadOnlineTrack = useCallback(
    async (item: OnlineTrack) => {
      const id = `dl-${item.id}`;
      const existing = libraryTracks.find(
        (t) => t.id === id && t.sourceType === 'downloaded'
      );
      if (existing) {
        showToast(`"${item.title}" já está salva offline.`, 'info');
        return;
      }

      const { audioBlob, artworkBlob, lyrics } = await downloadTrackBlob(item);

      const track: AudioTrack = {
        id,
        name: item.title,
        artist: item.artist,
        album: item.album,
        durationMs: item.durationMs,
        sourceType: 'downloaded',
        streamUrl: item.streamUrl,
        artworkUrl: item.artworkUrl,
        addedAt: Date.now(),
        fileSize: audioBlob.size,
        mimeType: audioBlob.type || 'audio/mpeg',
      };

      await putAudioBlob(id, audioBlob);
      if (artworkBlob) {
        await putArtworkBlob(id, artworkBlob);
        cacheArtworkUrl(id, artworkBlob);
      }
      if (lyrics) {
        await putLyrics(id, lyrics);
        setLyricsRevision((r) => r + 1);
      }
      await putTrack(track);

      setLibraryTracks((prev) => [track, ...prev.filter((t) => t.id !== id)]);
      showToast(`"${item.title}" salva para ouvir 100% offline!`, 'success');
    },
    [cacheArtworkUrl, libraryTracks, showToast]
  );

  const removeTrack = useCallback(
    async (trackId: string) => {
      const audioUrl = audioUrlCacheRef.current.get(trackId);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        audioUrlCacheRef.current.delete(trackId);
      }
      const artUrl = artworkUrlCacheRef.current.get(trackId);
      if (artUrl) {
        URL.revokeObjectURL(artUrl);
        artworkUrlCacheRef.current.delete(trackId);
      }

      await deleteTrackRecord(trackId);

      setArtworkUrls((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
      setLibraryTracks((prev) => prev.filter((t) => t.id !== trackId));
      setQueue((prev) => prev.filter((t) => t.id !== trackId));
      setBaseQueue((prev) => prev.filter((t) => t.id !== trackId));

      const updatedPlaylists = userPlaylists.map((pl) => ({
        ...pl,
        trackIds: pl.trackIds.filter((id) => id !== trackId),
      }));
      setUserPlaylists(updatedPlaylists);
      await Promise.all(updatedPlaylists.map((pl) => putPlaylist(pl)));

      if (currentTrackRef.current?.id === trackId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setCurrentTrack(null);
        setCurrentIndex(-1);
        setPositionMs(0);
        setDurationMs(0);
      }

      showToast('Música removida da biblioteca.', 'info');
    },
    [showToast, userPlaylists]
  );

  const updateTrackInfo = useCallback(
    async (trackId: string, info: { name: string; artist: string; album?: string }) => {
      const apply = (list: AudioTrack[]) =>
        list.map((t) =>
          t.id === trackId
            ? {
                ...t,
                name: info.name.trim() || t.name,
                artist: info.artist.trim() || 'Artista Desconhecido',
                album: info.album?.trim() ?? t.album,
              }
            : t
        );

      const nextLibrary = apply(libraryTracks);
      const updated = nextLibrary.find((t) => t.id === trackId);
      if (updated) {
        await putTrack(updated);
      }
      setLibraryTracks(nextLibrary);
      setQueue((prev) => apply(prev));
      setBaseQueue((prev) => apply(prev));
      if (currentTrackRef.current?.id === trackId && updated) {
        setCurrentTrack(updated);
      }
      showToast('Informações da faixa atualizadas!', 'success');
    },
    [libraryTracks, showToast]
  );

  const updateTrackCover = useCallback(
    async (trackId: string, fileOrBlob: Blob) => {
      await putArtworkBlob(trackId, fileOrBlob);
      cacheArtworkUrl(trackId, fileOrBlob);
      showToast('Capa atualizada!', 'success');
    },
    [cacheArtworkUrl, showToast]
  );

  const updateTrackLyrics = useCallback(
    async (trackId: string, lyricsText: string) => {
      await putLyrics(trackId, lyricsText);
      setLyricsRevision((r) => r + 1);
      showToast('Letra importada com sucesso!', 'success');
    },
    [showToast]
  );

  const resolveLyricsForTrack = useCallback(
    async (track: AudioTrack): Promise<string | undefined> => {
      const cached = await getLyrics(track.id);
      if (cached) return cached;

      if (!navigator.onLine) return undefined;

      const resolved = await resolveAndCacheTrackAssets(track, {
        fetchArtwork: settings.autoFetchArtwork,
        fetchLyrics: settings.autoFetchLyrics,
        hdArtworkQuality: settings.hdArtworkQuality,
      });

      if (resolved.artworkBlob) {
        cacheArtworkUrl(track.id, resolved.artworkBlob);
      }
      return resolved.lyrics;
    },
    [
      cacheArtworkUrl,
      settings.autoFetchArtwork,
      settings.autoFetchLyrics,
      settings.hdArtworkQuality,
    ]
  );

  const syncAllLibraryAssets = useCallback(async () => {
    if (libraryTracks.length === 0) {
      showToast('Adicione músicas primeiro.', 'info');
      return;
    }
    if (!navigator.onLine) {
      showToast('Conecte-se à internet para buscar capas e letras.', 'error');
      return;
    }
    setIsSyncingAssets(true);
    let updated = 0;
    try {
      for (const track of libraryTracks) {
        const res = await resolveAndCacheTrackAssets(track, {
          fetchArtwork: true,
          fetchLyrics: settings.autoFetchLyrics,
          hdArtworkQuality: settings.hdArtworkQuality,
        });
        if (res.artworkBlob) {
          cacheArtworkUrl(track.id, res.artworkBlob);
          updated++;
        }
        if (res.lyrics) {
          updated++;
        }
      }
      setLyricsRevision((r) => r + 1);
      showToast(
        updated > 0
          ? `Sincronização concluída (${updated} itens salvos offline)!`
          : 'Todas as faixas já estão sincronizadas.',
        'success'
      );
    } catch {
      showToast('Erro durante a sincronização.', 'error');
    } finally {
      setIsSyncingAssets(false);
    }
  }, [
    cacheArtworkUrl,
    libraryTracks,
    settings.autoFetchLyrics,
    settings.hdArtworkQuality,
    showToast,
  ]);

  const createPlaylist = useCallback(
    async (name: string, initialTrackId?: string): Promise<Playlist> => {
      const newPl: Playlist = {
        id: makeTrackId('pl'),
        name: name.trim(),
        trackIds: initialTrackId ? [initialTrackId] : [],
        createdAt: Date.now(),
      };
      await putPlaylist(newPl);
      setUserPlaylists((prev) => [newPl, ...prev]);
      showToast(`Playlist "${newPl.name}" criada!`, 'success');
      return newPl;
    },
    [showToast]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      await deletePlaylistRecord(playlistId);
      setUserPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
      showToast('Playlist excluída.', 'info');
    },
    [showToast]
  );

  const addTrackToPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      const target = userPlaylists.find((p) => p.id === playlistId);
      if (!target) return;
      if (target.trackIds.includes(trackId)) {
        showToast(`Essa música já está em "${target.name}".`, 'info');
        return;
      }
      const updated: Playlist = {
        ...target,
        trackIds: [...target.trackIds, trackId],
      };
      await putPlaylist(updated);
      setUserPlaylists((prev) =>
        prev.map((pl) => (pl.id === playlistId ? updated : pl))
      );
      showToast(`Adicionada em "${target.name}".`, 'success');
    },
    [showToast, userPlaylists]
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      const target = userPlaylists.find((p) => p.id === playlistId);
      if (!target) return;
      const updated: Playlist = {
        ...target,
        trackIds: target.trackIds.filter((id) => id !== trackId),
      };
      await putPlaylist(updated);
      setUserPlaylists((prev) =>
        prev.map((pl) => (pl.id === playlistId ? updated : pl))
      );
    },
    [userPlaylists]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = { ...settings, ...partial };
      setSettings(next);
      await putSettings(next);
    },
    [settings]
  );

  const clearCache = useCallback(async () => {
    await clearArtworkAndLyricsCache();
    artworkUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    artworkUrlCacheRef.current.clear();
    setArtworkUrls({});
    setLyricsRevision((r) => r + 1);
    showToast('Cache de capas e letras limpo!', 'success');
  }, [showToast]);

  const clearAllData = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    audioUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    artworkUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrlCacheRef.current.clear();
    artworkUrlCacheRef.current.clear();

    await clearEntireLibrary();
    setLibraryTracks([]);
    setUserPlaylists([]);
    setArtworkUrls({});
    setQueue([]);
    setBaseQueue([]);
    setCurrentTrack(null);
    setCurrentIndex(-1);
    setPositionMs(0);
    setDurationMs(0);
    setIsPlaying(false);
    setPlayerModalVisible(false);
    showToast('Biblioteca limpa.', 'info');
  }, [showToast]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      isReady,
      isOnline,
      canInstall: !!installPromptEvent,
      promptInstall,
      toast,
      showToast,
      isPlaying,
      isBuffering,
      currentTrack,
      queue,
      currentIndex,
      positionMs,
      durationMs,
      isShuffle,
      repeatMode,
      isPlayerModalVisible,
      setPlayerModalVisible,
      libraryTracks,
      userPlaylists,
      settings,
      isSyncingAssets,
      lyricsRevision,
      playTrack,
      playQueue,
      jumpToQueueIndex,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      skipForward,
      skipBackward,
      toggleShuffle,
      cycleRepeatMode,
      importLocalFiles,
      streamOnlineTrack,
      downloadOnlineTrack,
      removeTrack,
      updateTrackInfo,
      updateTrackCover,
      updateTrackLyrics,
      getTrackArtworkUrl,
      resolveLyricsForTrack,
      syncAllLibraryAssets,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      updateSettings,
      clearCache,
      clearAllData,
      fetchTrendingTracks,
    }),
    [
      addTrackToPlaylist,
      clearAllData,
      clearCache,
      createPlaylist,
      currentIndex,
      currentTrack,
      cycleRepeatMode,
      deletePlaylist,
      downloadOnlineTrack,
      durationMs,
      getTrackArtworkUrl,
      importLocalFiles,
      installPromptEvent,
      isBuffering,
      isOnline,
      isPlayerModalVisible,
      isPlaying,
      isReady,
      isShuffle,
      isSyncingAssets,
      jumpToQueueIndex,
      libraryTracks,
      lyricsRevision,
      playNext,
      playPrevious,
      playQueue,
      playTrack,
      positionMs,
      promptInstall,
      queue,
      removeTrack,
      removeTrackFromPlaylist,
      repeatMode,
      resolveLyricsForTrack,
      seekTo,
      settings,
      showToast,
      skipBackward,
      skipForward,
      streamOnlineTrack,
      syncAllLibraryAssets,
      toast,
      togglePlayPause,
      toggleShuffle,
      updateSettings,
      updateTrackCover,
      updateTrackInfo,
      updateTrackLyrics,
      userPlaylists,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
}
