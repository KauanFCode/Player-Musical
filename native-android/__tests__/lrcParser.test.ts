import {
  formatTime,
  getActiveLyricIndex,
  parseFilename,
  parseLrc,
} from '../src/utils/lrcParser';

describe('lrcParser', () => {
  it('parses synced LRC timestamps and sorts lines', () => {
    const raw = `
[ar:Artist]
[00:10.50] Second line
[00:02.00] First line
[00:25.123][00:35.00] Chorus
`;
    const parsed = parseLrc(raw);
    expect(parsed).toEqual([
      { timeMs: 2000, text: 'First line' },
      { timeMs: 10500, text: 'Second line' },
      { timeMs: 25123, text: 'Chorus' },
      { timeMs: 35000, text: 'Chorus' },
    ]);
  });

  it('falls back to plain lyrics when no timestamps exist', () => {
    const parsed = parseLrc('Line one\nLine two');
    expect(parsed).toEqual([
      { timeMs: -1, text: 'Line one' },
      { timeMs: -1, text: 'Line two' },
    ]);
  });

  it('finds active lyric index with leadTimeMs', () => {
    const lines = parseLrc('[00:05.00] A\n[00:10.00] B\n[00:20.00] C');
    expect(getActiveLyricIndex(lines, 1000, 350)).toBe(-1);
    expect(getActiveLyricIndex(lines, 4700, 350)).toBe(0);
    expect(getActiveLyricIndex(lines, 9700, 350)).toBe(1);
    expect(getActiveLyricIndex(lines, 25000, 350)).toBe(2);
  });

  it('formats milliseconds into m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65000)).toBe('1:05');
    expect(formatTime(-5)).toBe('0:00');
  });

  it('parses filenames into title, artist, and album', () => {
    expect(parseFilename('01 - Pink Floyd - Time - DSOTM.mp3')).toEqual({
      artist: 'Pink Floyd',
      title: 'Time',
      album: 'DSOTM',
    });
    expect(parseFilename('Daft_Punk_-_One_More_Time_(Official Video).mp3')).toEqual({
      artist: 'Daft Punk',
      title: 'One More Time',
      album: '',
    });
    expect(parseFilename('Instrumental.wav')).toEqual({
      artist: 'Artista Desconhecido',
      title: 'Instrumental',
      album: '',
    });
  });
});
