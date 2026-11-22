jest.mock('react-native', () => ({
  NativeModules: {},
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(),
}));

import { Buffer } from 'buffer';
import {
  isAudioFile,
  isImageFile,
  isLyricsFile,
  normalizeMediaUri,
  parseEmbeddedCover,
} from '../src/utils/metadataExtractor';

describe('metadataExtractor', () => {
  it('identifies audio, image, and lyrics file extensions', () => {
    expect(isAudioFile('song.MP3')).toBe(true);
    expect(isAudioFile('track.flac')).toBe(true);
    expect(isAudioFile('cover.jpg')).toBe(false);

    expect(isImageFile('cover.PNG')).toBe(true);
    expect(isImageFile('art.webp')).toBe(true);
    expect(isImageFile('song.mp3')).toBe(false);

    expect(isLyricsFile('lyrics.lrc')).toBe(true);
    expect(isLyricsFile('notes.TXT')).toBe(true);
    expect(isLyricsFile('song.mp3')).toBe(false);
  });

  it('normalizes local file paths without double-prefixing', () => {
    expect(normalizeMediaUri('/storage/emulated/0/a.jpg')).toBe(
      'file:///storage/emulated/0/a.jpg'
    );
    expect(normalizeMediaUri('file:///a.jpg')).toBe('file:///a.jpg');
    expect(normalizeMediaUri('content://media/1')).toBe('content://media/1');
    expect(normalizeMediaUri('https://example.com/a.jpg')).toBe(
      'https://example.com/a.jpg'
    );
  });

  it('extracts embedded JPEG from ID3v2 APIC frame', () => {
    // Minimal ID3v2.3 header + APIC frame containing a fake JPEG
    const mime = Buffer.from('image/jpeg\0', 'ascii');
    const desc = Buffer.from([0x03, 0x00]); // pictureType=3 (Front cover), empty desc
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const framePayload = Buffer.concat([Buffer.from([0x00]), mime, desc, jpeg]);
    const frameHeader = Buffer.alloc(10);
    Buffer.from('APIC', 'ascii').copy(frameHeader, 0);
    frameHeader.writeUInt32BE(framePayload.length, 4);

    const tagSize = 10 + framePayload.length;
    const id3Header = Buffer.from([
      0x49, 0x44, 0x33, // "ID3"
      0x03, 0x00,       // v2.3
      0x00,             // flags
      0x00, 0x00, (tagSize >> 7) & 0x7f, tagSize & 0x7f,
    ]);

    const full = Buffer.concat([id3Header, frameHeader, framePayload]);
    const ab = full.buffer.slice(full.byteOffset, full.byteOffset + full.byteLength);
    const result = parseEmbeddedCover(ab);

    expect(result).toBeDefined();
    expect(result?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
