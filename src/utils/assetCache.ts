import { AudioTrack } from '../types/music';
import { getArtworkBlob, getLyrics, putArtworkBlob, putLyrics } from './db';
import { getCachedLyricsTranslation, saveLyricsTranslation } from './storage';

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
    const queries: string[] = [];
    if (cleanArtist) queries.push(`${cleanArtist} ${cleanTitle}`);
    if (cleanTitle && !queries.includes(cleanTitle)) queries.push(cleanTitle);

    for (const q of queries) {
      if (!q.trim()) continue;
      const response = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
      );
      if (!response.ok) continue;
      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const match = results.find((r) => r?.syncedLyrics) || results[0];
        const lrc = match?.syncedLyrics || match?.plainLyrics;
        if (lrc) return lrc;
      }
    }
    return undefined;
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

async function translateBatchToPortuguese(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const joined = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(joined)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return texts;
  }

  const fullTranslated = (data[0] as any[])
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === 'string' ? chunk[0] : ''))
    .join('');
  const split = fullTranslated.split('\n');
  if (split.length === texts.length) {
    return split.map((line, i) => line.trim() || texts[i]);
  }

  // Fallback per line when line count shifts
  const individual: string[] = [];
  for (const line of texts) {
    const clean = line.trim();
    if (!clean) {
      individual.push('');
      continue;
    }
    try {
      const singleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(clean)}`;
      const singleRes = await fetch(singleUrl);
      if (!singleRes.ok) {
        individual.push(clean);
        continue;
      }
      const singleData = await singleRes.json();
      const translatedLine = Array.isArray(singleData?.[0])
        ? (singleData[0] as any[])
            .map((c) => (Array.isArray(c) && typeof c[0] === 'string' ? c[0] : ''))
            .join('')
            .trim()
        : '';
      individual.push(translatedLine || clean);
    } catch {
      individual.push(clean);
    }
  }
  return individual;
}

export async function translateLyricsLines(
  trackId: string,
  lines: string[]
): Promise<string[]> {
  if (lines.length === 0) return [];
  const cached = getCachedLyricsTranslation(trackId);
  if (cached && cached.length === lines.length) {
    return cached;
  }

  const result: string[] = [...lines];
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed && !/^\[.*\]$/.test(trimmed)) {
      nonEmptyIndices.push(idx);
      nonEmptyTexts.push(trimmed);
    }
  });

  if (nonEmptyTexts.length === 0) {
    return result;
  }

  const chunkSize = 20;
  for (let i = 0; i < nonEmptyTexts.length; i += chunkSize) {
    const slice = nonEmptyTexts.slice(i, i + chunkSize);
    const translatedSlice = await translateBatchToPortuguese(slice);
    translatedSlice.forEach((txt, offset) => {
      const originalIdx = nonEmptyIndices[i + offset];
      result[originalIdx] = txt;
    });
  }

  saveLyricsTranslation(trackId, result);
  return result;
}
