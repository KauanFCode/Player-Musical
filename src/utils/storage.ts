const KEYS = {
  FAVORITES: 'player2_favorites',
  LYRIC_OFFSETS: 'player2_lyric_offsets',
  TOUR_DONE: 'player2_tour_completed',
  TRANSLATIONS: 'player2_lyrics_pt_cache',
} as const;

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids: string[]): void {
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(ids));
  } catch {
    // Ignore quota errors
  }
}

export function loadLyricOffsets(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEYS.LYRIC_OFFSETS);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveLyricOffsets(offsets: Record<string, number>): void {
  try {
    localStorage.setItem(KEYS.LYRIC_OFFSETS, JSON.stringify(offsets));
  } catch {
    // Ignore quota errors
  }
}

export function loadHasCompletedTour(): boolean {
  try {
    return localStorage.getItem(KEYS.TOUR_DONE) === 'true';
  } catch {
    return false;
  }
}

export function saveHasCompletedTour(done: boolean): void {
  try {
    localStorage.setItem(KEYS.TOUR_DONE, done ? 'true' : 'false');
  } catch {
    // Ignore quota errors
  }
}

export function getCachedLyricsTranslation(trackId: string): string[] | null {
  try {
    const raw = localStorage.getItem(KEYS.TRANSLATIONS);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string[]>;
    return Array.isArray(map[trackId]) ? map[trackId] : null;
  } catch {
    return null;
  }
}

export function saveLyricsTranslation(trackId: string, lines: string[]): void {
  try {
    const raw = localStorage.getItem(KEYS.TRANSLATIONS);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    map[trackId] = lines;
    localStorage.setItem(KEYS.TRANSLATIONS, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

export function clearTranslatedLyricsCache(): void {
  try {
    localStorage.removeItem(KEYS.TRANSLATIONS);
  } catch {
    // Ignore
  }
}
