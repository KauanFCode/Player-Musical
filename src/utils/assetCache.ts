import { AudioTrack } from '../types/music';
import { getArtworkBlob, getLyrics, putArtworkBlob, putLyrics } from './db';

export interface ResolveAssetsOptions {
  fetchArtwork?: boolean;
  fetchLyrics?: boolean;
  hdArtworkQuality?: boolean;
}

export function cleanQueryString(text: string): string {
  if (!text) return '';
  return text
    .replace(/\.(mp3|m4a|wav|flac|aac|ogg|opus|webm|wma|m4r)$/i, '')
    .replace(
      /[([{].*?(official|video|lyric|hd|4k|remastered|audio|explicit|128kbps|320kbps|clip).*?[)\]}]/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findArtworkUrl(
  title: string,
  artist: string,
  hdQuality = true
): Promise<string | undefined> {
  try {
    const cleanTitle = cleanQueryString(title);
    const cleanArtist =
      artist && artist !== 'Artista Desconhecido' ? cleanQueryString(artist) : '';
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    if (!query) return undefined;

    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    const artwork: string | undefined = data.results?.[0]?.artworkUrl100;
    if (!artwork) return undefined;

    const size = hdQuality ? '1280x1280bb' : '600x600bb';
    return artwork.replace('100x100bb', size);
  } catch {
    return undefined;
  }
}

export async function findLyrics(title: string, artist: string): Promise<string | undefined> {
  try {
    const cleanTitle = cleanQueryString(title);
    const cleanArtist =
      artist && artist !== 'Artista Desconhecido' ? cleanQueryString(artist) : '';
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    if (!query) return undefined;

    const response = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return undefined;
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return undefined;
    return results[0]?.syncedLyrics || results[0]?.plainLyrics || undefined;
  } catch {
    return undefined;
  }
}

export async function fetchImageAsBlob(url: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    if (!blob || blob.size === 0) return undefined;
    return blob;
  } catch {
    return undefined;
  }
}

export async function resolveAndCacheTrackAssets(
  track: AudioTrack,
  options: ResolveAssetsOptions = {}
): Promise<{ artworkBlob?: Blob; artworkUrl?: string; lyrics?: string }> {
  const [cachedArt, cachedLyrics] = await Promise.all([
    getArtworkBlob(track.id),
    getLyrics(track.id),
  ]);

  const shouldFetchArt = !cachedArt && !track.artworkUrl && options.fetchArtwork !== false;
  const shouldFetchLyrics = !cachedLyrics && options.fetchLyrics !== false;

  if (!shouldFetchArt && !shouldFetchLyrics) {
    return { artworkBlob: cachedArt, artworkUrl: track.artworkUrl, lyrics: cachedLyrics };
  }

  const [foundArtUrl, foundLyrics] = await Promise.all([
    shouldFetchArt
      ? findArtworkUrl(track.name, track.artist, options.hdArtworkQuality ?? true)
      : Promise.resolve(undefined),
    shouldFetchLyrics ? findLyrics(track.name, track.artist) : Promise.resolve(undefined),
  ]);

  let artworkBlob = cachedArt;
  let artworkUrl = track.artworkUrl;
  if (foundArtUrl) {
    artworkUrl = foundArtUrl;
    const blob = await fetchImageAsBlob(foundArtUrl);
    if (blob) {
      artworkBlob = blob;
      await putArtworkBlob(track.id, blob);
    }
  }

  let lyrics = cachedLyrics;
  if (foundLyrics) {
    lyrics = foundLyrics;
    await putLyrics(track.id, foundLyrics);
  }

  return { artworkBlob, artworkUrl, lyrics };
}
