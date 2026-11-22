import RNFS from 'react-native-fs';

export interface OfflineTrackAssets {
  artworkUri?: string;
  lyrics?: string;
}

export interface ResolveTrackAssetsOptions {
  fetchArtwork?: boolean;
  fetchLyrics?: boolean;
  hdArtworkQuality?: boolean;
}

const assetsDirectory = `${RNFS.DocumentDirectoryPath}/track-assets`;

function trackKey(title: string, artist: string, album?: string): string {
  const value = `${artist}-${title}${album ? `-${album}` : ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return `${value.slice(0, 72) || 'track'}-${(hash >>> 0).toString(36)}`;
}

function pathsFor(title: string, artist: string, album?: string) {
  const key = trackKey(title, artist, album);
  return {
    artwork: `${assetsDirectory}/${key}.artwork`,
    lyrics: `${assetsDirectory}/${key}.lrc`,
    translation: `${assetsDirectory}/${key}.pt.json`,
  };
}

async function ensureAssetsDirectory(): Promise<boolean> {
  try {
    const exists = await RNFS.exists(assetsDirectory);
    if (!exists) {
      await RNFS.mkdir(assetsDirectory);
    }
    return true;
  } catch {
    return false;
  }
}

export function cleanQueryString(text: string): string {
  if (!text) return '';
  return text
    .replace(/\.(mp3|m4a|wav|flac|aac|ogg|wma|m4r)$/i, '')
    .replace(
      /[([{].*?(official|video|lyric|hd|4k|remastered|audio|explicit|128kbps|320kbps).*?[)\]}]/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getCachedTrackAssets(
  title: string,
  artist: string,
  album?: string
): Promise<OfflineTrackAssets> {
  try {
    if (await ensureAssetsDirectory()) {
      const paths = pathsFor(title, artist, album);
      const [artworkExists, lyricsExists] = await Promise.all([
        RNFS.exists(paths.artwork),
        RNFS.exists(paths.lyrics),
      ]);

      const lyrics = lyricsExists ? await RNFS.readFile(paths.lyrics, 'utf8') : undefined;

      return {
        artworkUri: artworkExists ? `file://${paths.artwork}` : undefined,
        lyrics: lyrics?.trim() || undefined,
      };
    }
  } catch {
    return {};
  }
  return {};
}

export async function cacheTrackLyrics(
  title: string,
  artist: string,
  lyrics: string,
  album?: string
): Promise<void> {
  if (!lyrics || !lyrics.trim()) return;
  try {
    if (await ensureAssetsDirectory()) {
      const { lyrics: lyricsPath } = pathsFor(title, artist, album);
      await RNFS.writeFile(lyricsPath, lyrics.trim(), 'utf8');
    }
  } catch (e) {
    console.warn('Erro ao salvar letra no cache:', e);
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function cacheArtworkFromUri(
  title: string,
  artist: string,
  sourceUri: string,
  album?: string
): Promise<string> {
  if (!sourceUri) return sourceUri;
  try {
    if (await ensureAssetsDirectory()) {
      const { artwork } = pathsFor(title, artist, album);
      if (sourceUri.startsWith('data:')) {
        const commaIdx = sourceUri.indexOf(',');
        if (commaIdx !== -1) {
          const base64Data = sourceUri.slice(commaIdx + 1);
          await RNFS.writeFile(artwork, base64Data, 'base64');
          return `file://${artwork}`;
        }
      }
      if (sourceUri.startsWith('http://') || sourceUri.startsWith('https://')) {
        await RNFS.downloadFile({ fromUrl: sourceUri, toFile: artwork }).promise;
        return `file://${artwork}`;
      }
      if (sourceUri.startsWith('file://')) {
        await RNFS.copyFile(sourceUri.replace(/^file:\/\//, ''), artwork);
        return `file://${artwork}`;
      }
      if (sourceUri.startsWith('/')) {
        await RNFS.copyFile(sourceUri, artwork);
        return `file://${artwork}`;
      }
    }
  } catch (e) {
    console.warn('Erro ao salvar capa no cache:', e);
  }
  return sourceUri;
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

    const response = await fetchWithTimeout(
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

export async function findLyrics(
  title: string,
  artist: string
): Promise<string | undefined> {
  try {
    const cleanTitle = cleanQueryString(title);
    const cleanArtist =
      artist && artist !== 'Artista Desconhecido' ? cleanQueryString(artist) : '';
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    if (!query) return undefined;

    const response = await fetchWithTimeout(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return undefined;
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return undefined;
    return results[0]?.syncedLyrics || results[0]?.plainLyrics;
  } catch {
    return undefined;
  }
}

export async function resolveOfflineTrackAssets(
  title: string,
  artist: string,
  options: ResolveTrackAssetsOptions = {},
  album?: string
): Promise<OfflineTrackAssets> {
  const cached = await getCachedTrackAssets(title, artist, album);
  const shouldFetchArtwork = !cached.artworkUri && options.fetchArtwork !== false;
  const shouldFetchLyrics = !cached.lyrics && options.fetchLyrics !== false;

  if (!shouldFetchArtwork && !shouldFetchLyrics) return cached;

  const [remoteArtworkUrl, remoteLyrics] = await Promise.all([
    shouldFetchArtwork ? findArtworkUrl(title, artist, options.hdArtworkQuality ?? true) : Promise.resolve(undefined),
    shouldFetchLyrics ? findLyrics(title, artist) : Promise.resolve(undefined),
  ]);

  let artworkUri = cached.artworkUri;
  if (remoteArtworkUrl) {
    artworkUri = await cacheArtworkFromUri(title, artist, remoteArtworkUrl, album);
  }

  let lyrics = cached.lyrics;
  if (remoteLyrics) {
    lyrics = remoteLyrics;
    await cacheTrackLyrics(title, artist, remoteLyrics, album);
  }

  return { artworkUri, lyrics };
}

export async function clearAssetsCache(): Promise<void> {
  try {
    const exists = await RNFS.exists(assetsDirectory);
    if (exists) {
      await RNFS.unlink(assetsDirectory);
    }
  } catch (e) {
    console.warn('Erro ao limpar cache de assets:', e);
  }
}

export async function getAssetsCacheSizeMb(): Promise<number> {
  try {
    const exists = await RNFS.exists(assetsDirectory);
    if (!exists) return 0;
    const entries = await RNFS.readDir(assetsDirectory);
    const totalBytes = entries.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    return Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
  } catch {
    return 0;
  }
}

export async function getCachedLyricsTranslation(
  title: string,
  artist: string,
  album?: string
): Promise<string[] | null> {
  try {
    if (await ensureAssetsDirectory()) {
      const { translation } = pathsFor(title, artist, album);
      if (await RNFS.exists(translation)) {
        const raw = await RNFS.readFile(translation, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function translateBatchToPortuguese(lines: string[]): Promise<string[]> {
  if (!lines.length) return [];
  const SEP = '\n';
  const joined = lines.join(SEP);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(joined)}`;
  const res = await fetchWithTimeout(url, 9000);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data?.[0])) {
    throw new Error('Formato inesperado');
  }
  const translatedJoined = data[0].map((chunk: any) => chunk?.[0] || '').join('');
  const split = translatedJoined.split('\n');
  if (split.length === lines.length) {
    return split.map((s: string) => s.trim());
  }

  // Fallback: translate line-by-line if a line count mismatch occurred
  const individual: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === '♪') {
      individual.push('');
      continue;
    }
    try {
      const r = await fetchWithTimeout(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(t)}`,
        6000
      );
      if (r.ok) {
        const j = await r.json();
        individual.push((j?.[0]?.map((c: any) => c?.[0] || '').join('') || t).trim());
      } else {
        individual.push(t);
      }
    } catch {
      individual.push(t);
    }
  }
  return individual;
}

/**
 * Translates an array of lyric lines into Portuguese and caches offline for subsequent plays.
 */
export async function translateLyricsLines(
  title: string,
  artist: string,
  lines: string[],
  album?: string
): Promise<string[]> {
  const cached = await getCachedLyricsTranslation(title, artist, album);
  if (cached && cached.length === lines.length) {
    return cached;
  }

  const out: string[] = new Array(lines.length).fill('');
  const translatableIndices: number[] = [];
  lines.forEach((line, i) => {
    const clean = line.trim();
    if (clean && clean !== '♪') {
      translatableIndices.push(i);
    }
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < translatableIndices.length; i += BATCH_SIZE) {
    const idxSlice = translatableIndices.slice(i, i + BATCH_SIZE);
    const textSlice = idxSlice.map((idx) => lines[idx].trim());
    const translatedSlice = await translateBatchToPortuguese(textSlice);
    idxSlice.forEach((origIdx, k) => {
      out[origIdx] = translatedSlice[k] || '';
    });
  }

  try {
    if (await ensureAssetsDirectory()) {
      const { translation } = pathsFor(title, artist, album);
      await RNFS.writeFile(translation, JSON.stringify(out), 'utf8');
    }
  } catch {
    // Non-fatal cache write failure
  }

  return out;
}
