import { OnlineTrack } from '../types/music';
import { fetchImageAsBlob, findLyrics } from '../utils/assetCache';

const AUDIUS_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';

interface AudiusRawTrack {
  id?: string | number;
  title?: string;
  genre?: string;
  duration?: number;
  user?: { name?: string };
  artwork?: Record<string, string>;
}

function mapAudiusTrack(track: AudiusRawTrack, idx: number): OnlineTrack {
  const id = String(track.id ?? idx);
  const streamUrl = `https://api.audius.co/v1/tracks/${id}/stream`;
  const artwork = track.artwork
    ? track.artwork['1000x1000'] ||
      track.artwork['480x480'] ||
      track.artwork['150x150'] ||
      AUDIUS_FALLBACK_COVER
    : AUDIUS_FALLBACK_COVER;

  return {
    id,
    title: track.title || 'Música',
    artist: track.user?.name || 'Artista Desconhecido',
    album: track.genre || 'Audius',
    artworkUrl: artwork,
    streamUrl,
    downloadUrl: streamUrl,
    durationMs: typeof track.duration === 'number' ? track.duration * 1000 : undefined,
    quality: 'MP3 via Audius',
  };
}

export async function searchOnlineTracks(query: string): Promise<OnlineTrack[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(
      `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query.trim())}&limit=25`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results: AudiusRawTrack[] = Array.isArray(data.data) ? data.data : [];
    return results.filter((t) => t?.id && t?.title).map(mapAudiusTrack);
  } catch (e) {
    console.warn('Erro ao buscar no Audius:', e);
    return [];
  }
}

export async function fetchTrendingTracks(genre?: string): Promise<OnlineTrack[]> {
  try {
    const genreParam = genre ? `&genre=${encodeURIComponent(genre)}` : '';
    const res = await fetch(
      `https://api.audius.co/v1/tracks/trending?limit=20${genreParam}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results: AudiusRawTrack[] = Array.isArray(data.data) ? data.data : [];
    return results.filter((t) => t?.id && t?.title).map(mapAudiusTrack);
  } catch (e) {
    console.warn('Erro ao carregar em alta do Audius:', e);
    return [];
  }
}

export async function downloadTrackBlob(track: OnlineTrack): Promise<{
  audioBlob: Blob;
  artworkBlob?: Blob;
  lyrics?: string;
}> {
  const [audioRes, artworkBlob, lyrics] = await Promise.all([
    fetch(track.downloadUrl),
    track.artworkUrl ? fetchImageAsBlob(track.artworkUrl) : Promise.resolve(undefined),
    findLyrics(track.title, track.artist),
  ]);

  if (!audioRes.ok) {
    throw new Error(`Falha ao baixar áudio (HTTP ${audioRes.status})`);
  }

  const audioBlob = await audioRes.blob();
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Arquivo de áudio vazio');
  }

  return { audioBlob, artworkBlob, lyrics };
}
