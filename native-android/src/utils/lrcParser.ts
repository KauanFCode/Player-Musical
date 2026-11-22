import { LrcLine } from '../types/music';

/**
 * Parses an LRC-formatted lyrics string into sorted time-coded lines.
 */
export function parseLrc(lrcText: string): LrcLine[] {
  if (!lrcText || !lrcText.trim()) return [];

  const lines = lrcText.split(/\r?\n/);
  const timed: LrcLine[] = [];
  const plain: LrcLine[] = [];
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    timeRegex.lastIndex = 0;
    const matches = Array.from(trimmed.matchAll(timeRegex));

    if (matches.length > 0) {
      const cleanText = trimmed.replace(timeRegex, '').trim();
      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const msFraction = match[3]
          ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10)
          : 0;
        const timeMs = (minutes * 60 + seconds) * 1000 + msFraction;
        timed.push({ timeMs, text: cleanText || '♪' });
      }
    } else if (!trimmed.startsWith('[')) {
      plain.push({ timeMs: -1, text: trimmed });
    }
  }

  if (timed.length > 0) {
    return timed.sort((a, b) => a.timeMs - b.timeMs);
  }
  return plain;
}

/**
 * Returns the active lyric index for the current playback position in ms.
 */
export function getActiveLyricIndex(
  lines: LrcLine[],
  positionMs: number,
  leadTimeMs = 350
): number {
  if (!lines || lines.length === 0) return -1;

  const effectiveMs = positionMs + leadTimeMs;
  let activeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].timeMs;
    if (t < 0) continue;
    if (t <= effectiveMs) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Formats milliseconds into m:ss.
 */
export function formatTime(millis: number): string {
  if (!Number.isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/**
 * Extracts clean title, artist, and album from filenames like:
 * "01 - Artist - Title - Album.mp3" or "Artist - Title.mp3".
 */
export function parseFilename(filename: string): {
  title: string;
  artist: string;
  album: string;
} {
  if (!filename) {
    return { title: 'Música', artist: 'Artista Desconhecido', album: '' };
  }

  let clean = filename.replace(/\.[^/.]+$/, '').trim();
  clean = clean.replace(/_/g, ' ').replace(/\s+/g, ' ');
  clean = clean.replace(/^(?:track|faixa)?\s*\d{1,3}\s*[.\-_]?\s*/i, '').trim();
  clean = clean
    .replace(
      /[([{].*?(official|video|lyric|hd|4k|remastered|audio|explicit|128kbps|320kbps|clip).*?[)\]}]/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.includes(' - ')) {
    const parts = clean.split(' - ').map((p) => p.trim()).filter(Boolean);
    const effective = /^\d+$/.test(parts[0]) ? parts.slice(1) : parts;

    if (effective.length >= 3) {
      return {
        artist: effective[0],
        title: effective[1],
        album: effective.slice(2).join(' - '),
      };
    }
    if (effective.length === 2) {
      return {
        artist: effective[0],
        title: effective[1],
        album: '',
      };
    }
    if (effective.length === 1) {
      return {
        title: effective[0],
        artist: 'Artista Desconhecido',
        album: '',
      };
    }
  }

  return {
    title: clean || filename,
    artist: 'Artista Desconhecido',
    album: '',
  };
}
