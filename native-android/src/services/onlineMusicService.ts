import RNFS from 'react-native-fs';
import { OnlineTrack } from '../types/music';
import { findLyrics } from '../utils/assetCache';

const DOWNLOADS_DIR = `${RNFS.DocumentDirectoryPath}/downloads`;
const AUDIUS_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1280&q=80';

function isAudiusTrackPlayable(track: any): boolean {
  return Boolean(
    track?.id &&
      track?.title &&
      track?.is_streamable !== false &&
      !track?.is_stream_gated &&
      track?.access?.stream !== false
  );
}

function mapAudiusTrack(track: any, idx: number): OnlineTrack {
  const endpointUrl = `https://api.audius.co/v1/tracks/${track.id}/stream`;
  const directStreamUrl =
    typeof track?.stream?.url === 'string' && track.stream.url.startsWith('http')
      ? track.stream.url
      : endpointUrl;
  const artwork = track.artwork
    ? track.artwork['1000x1000'] ||
      track.artwork['480x480'] ||
      track.artwork['150x150']
    : AUDIUS_FALLBACK_COVER;

  return {
    id: String(track.id || idx),
    title: track.title || 'Música',
    artist: track.user?.name || 'Artista Desconhecido',
    album: track.genre || 'Audius',
    artworkUrl: artwork,
    streamUrl: endpointUrl,
    downloadUrl: directStreamUrl,
    durationMs: typeof track.duration === 'number' ? track.duration * 1000 : undefined,
    quality: 'Stream completo via Audius',
  };
}

/**
 * Searches full-length tracks on Audius.
 */
export async function searchOnlineTracks(query: string): Promise<OnlineTrack[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(
      `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query.trim())}&limit=25`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.data) ? data.data : [];
    return results.filter(isAudiusTrackPlayable).map(mapAudiusTrack);
  } catch (e) {
    console.warn('Erro ao buscar no Audius:', e);
    return [];
  }
}

/**
 * Fetches trending tracks from Audius for the Explore screen.
 */
export async function fetchTrendingTracks(genre?: string): Promise<OnlineTrack[]> {
  try {
    const genreParam = genre ? `&genre=${encodeURIComponent(genre)}` : '';
    const res = await fetch(
      `https://api.audius.co/v1/tracks/trending?limit=20${genreParam}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.data) ? data.data : [];
    return results.filter(isAudiusTrackPlayable).map(mapAudiusTrack);
  } catch (e) {
    console.warn('Erro ao carregar em alta do Audius:', e);
    return [];
  }
}

/**
 * Downloads an online track to local device storage so it plays 100% offline.
 */
export async function downloadTrackOffline(track: OnlineTrack): Promise<string> {
  const exists = await RNFS.exists(DOWNLOADS_DIR);
  if (!exists) {
    await RNFS.mkdir(DOWNLOADS_DIR);
  }

  const safeName = `${track.artist}-${track.title}-${track.id}`
    .replace(/[^a-zA-Z0-9\-_ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const destPath = `${DOWNLOADS_DIR}/${safeName}.mp3`;

  const alreadyExists = await RNFS.exists(destPath);
  if (alreadyExists) {
    try {
      const stat = await RNFS.stat(destPath);
      if (Number(stat.size) > 0) {
        return `file://${destPath}`;
      }
      await RNFS.unlink(destPath);
    } catch {
      // Proceed to re-download
    }
  }

  const result = await RNFS.downloadFile({
    fromUrl: track.downloadUrl,
    toFile: destPath,
  }).promise;

  if (result.statusCode < 200 || result.statusCode >= 300 || result.bytesWritten === 0) {
    try {
      if (await RNFS.exists(destPath)) {
        await RNFS.unlink(destPath);
      }
    } catch {
      // Ignore cleanup failure
    }
    throw new Error(`Falha no download (HTTP ${result.statusCode})`);
  }

  return `file://${destPath}`;
}

export { findLyrics as fetchSyncedLyrics };
