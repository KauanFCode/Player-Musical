import { AppSettings, AudioTrack, DEFAULT_SETTINGS, Playlist } from '../types/music';

const DB_NAME = 'player2_offline_db';
const DB_VERSION = 1;

const STORES = {
  TRACKS: 'tracks',
  AUDIO_BLOBS: 'audioBlobs',
  ARTWORK_BLOBS: 'artworkBlobs',
  LYRICS: 'lyrics',
  PLAYLISTS: 'playlists',
  SETTINGS: 'settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        db.createObjectStore(STORES.TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
        db.createObjectStore(STORES.AUDIO_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORES.ARTWORK_BLOBS)) {
        db.createObjectStore(STORES.ARTWORK_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORES.LYRICS)) {
        db.createObjectStore(STORES.LYRICS);
      }
      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrapTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function getAllTracks(): Promise<AudioTrack[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.TRACKS, 'readonly');
  const tracks = await wrapRequest(tx.objectStore(STORES.TRACKS).getAll());
  return (tracks as AudioTrack[]).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

export async function putTrack(track: AudioTrack): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.TRACKS, 'readwrite');
  tx.objectStore(STORES.TRACKS).put(track);
  await wrapTransaction(tx);
}

export async function putTracks(tracks: AudioTrack[]): Promise<void> {
  if (tracks.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(STORES.TRACKS, 'readwrite');
  const store = tx.objectStore(STORES.TRACKS);
  for (const t of tracks) {
    store.put(t);
  }
  await wrapTransaction(tx);
}

export async function deleteTrackRecord(trackId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.TRACKS, STORES.AUDIO_BLOBS, STORES.ARTWORK_BLOBS, STORES.LYRICS],
    'readwrite'
  );
  tx.objectStore(STORES.TRACKS).delete(trackId);
  tx.objectStore(STORES.AUDIO_BLOBS).delete(trackId);
  tx.objectStore(STORES.ARTWORK_BLOBS).delete(trackId);
  tx.objectStore(STORES.LYRICS).delete(trackId);
  await wrapTransaction(tx);
}

export async function putAudioBlob(trackId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.AUDIO_BLOBS, 'readwrite');
  tx.objectStore(STORES.AUDIO_BLOBS).put(blob, trackId);
  await wrapTransaction(tx);
}

export async function getAudioBlob(trackId: string): Promise<Blob | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORES.AUDIO_BLOBS, 'readonly');
  const res = await wrapRequest(tx.objectStore(STORES.AUDIO_BLOBS).get(trackId));
  return res as Blob | undefined;
}

export async function putArtworkBlob(trackId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.ARTWORK_BLOBS, 'readwrite');
  tx.objectStore(STORES.ARTWORK_BLOBS).put(blob, trackId);
  await wrapTransaction(tx);
}

export async function getArtworkBlob(trackId: string): Promise<Blob | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORES.ARTWORK_BLOBS, 'readonly');
  const res = await wrapRequest(tx.objectStore(STORES.ARTWORK_BLOBS).get(trackId));
  return res as Blob | undefined;
}

export async function getAllArtworkIds(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.ARTWORK_BLOBS, 'readonly');
  const keys = await wrapRequest(tx.objectStore(STORES.ARTWORK_BLOBS).getAllKeys());
  return keys.map(String);
}

export async function putLyrics(trackId: string, lyrics: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.LYRICS, 'readwrite');
  tx.objectStore(STORES.LYRICS).put(lyrics, trackId);
  await wrapTransaction(tx);
}

export async function getLyrics(trackId: string): Promise<string | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORES.LYRICS, 'readonly');
  const res = await wrapRequest(tx.objectStore(STORES.LYRICS).get(trackId));
  return typeof res === 'string' ? res : undefined;
}

export async function getAllLyricsIds(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.LYRICS, 'readonly');
  const keys = await wrapRequest(tx.objectStore(STORES.LYRICS).getAllKeys());
  return keys.map(String);
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.PLAYLISTS, 'readonly');
  const lists = await wrapRequest(tx.objectStore(STORES.PLAYLISTS).getAll());
  return (lists as Playlist[]).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function putPlaylist(playlist: Playlist): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
  tx.objectStore(STORES.PLAYLISTS).put(playlist);
  await wrapTransaction(tx);
}

export async function deletePlaylistRecord(playlistId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
  tx.objectStore(STORES.PLAYLISTS).delete(playlistId);
  await wrapTransaction(tx);
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const saved = await wrapRequest(tx.objectStore(STORES.SETTINGS).get('app_settings'));
    if (saved && typeof saved === 'object') {
      return { ...DEFAULT_SETTINGS, ...(saved as Partial<AppSettings>) };
    }
  } catch {
    // Fallback to default
  }
  return { ...DEFAULT_SETTINGS };
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.SETTINGS, 'readwrite');
  tx.objectStore(STORES.SETTINGS).put(settings, 'app_settings');
  await wrapTransaction(tx);
}

export async function clearArtworkAndLyricsCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORES.ARTWORK_BLOBS, STORES.LYRICS], 'readwrite');
  tx.objectStore(STORES.ARTWORK_BLOBS).clear();
  tx.objectStore(STORES.LYRICS).clear();
  await wrapTransaction(tx);
}

export async function clearEntireLibrary(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.TRACKS, STORES.AUDIO_BLOBS, STORES.ARTWORK_BLOBS, STORES.LYRICS, STORES.PLAYLISTS],
    'readwrite'
  );
  tx.objectStore(STORES.TRACKS).clear();
  tx.objectStore(STORES.AUDIO_BLOBS).clear();
  tx.objectStore(STORES.ARTWORK_BLOBS).clear();
  tx.objectStore(STORES.LYRICS).clear();
  tx.objectStore(STORES.PLAYLISTS).clear();
  await wrapTransaction(tx);
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) {
      return true;
    }
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore unsupported environments
  }
  return false;
}

export async function getStorageEstimate(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  persisted: boolean;
}> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let persisted = false;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usedBytes = est.usage ?? 0;
      quotaBytes = est.quota ?? 0;
    }
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    // Ignore
  }
  return { usedBytes, quotaBytes, persisted };
}
