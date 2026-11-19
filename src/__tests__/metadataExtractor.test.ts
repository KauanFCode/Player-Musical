import { describe, expect, it } from 'vitest';
import {
  extractMetadataFromBuffer,
  isAudioFile,
  isImageFile,
  isLyricsFile,
} from '../utils/metadataExtractor';

function encodeTextFrame(frameId: string, text: string): Uint8Array {
  const textBytes = new TextEncoder().encode(text);
  const payload = new Uint8Array(1 + textBytes.length);
  payload[0] = 0x03; // UTF-8
  payload.set(textBytes, 1);

  const frame = new Uint8Array(10 + payload.length);
  for (let i = 0; i < 4; i++) frame[i] = frameId.charCodeAt(i);
  frame[4] = (payload.length >>> 24) & 0xff;
  frame[5] = (payload.length >>> 16) & 0xff;
  frame[6] = (payload.length >>> 8) & 0xff;
  frame[7] = payload.length & 0xff;
  frame.set(payload, 10);
  return frame;
}

function encodeApicFrame(mime: string, imageBytes: Uint8Array): Uint8Array {
  const mimeBytes = new TextEncoder().encode(mime);
  const payload = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length);
  let pos = 0;
  payload[pos++] = 0x00; // Latin-1
  payload.set(mimeBytes, pos);
  pos += mimeBytes.length;
  payload[pos++] = 0x00; // null after mime
  payload[pos++] = 0x03; // picture type: Front Cover
  payload[pos++] = 0x00; // empty description null
  payload.set(imageBytes, pos);

  const frame = new Uint8Array(10 + payload.length);
  'APIC'.split('').forEach((c, i) => {
    frame[i] = c.charCodeAt(0);
  });
  frame[4] = (payload.length >>> 24) & 0xff;
  frame[5] = (payload.length >>> 16) & 0xff;
  frame[6] = (payload.length >>> 8) & 0xff;
  frame[7] = payload.length & 0xff;
  frame.set(payload, 10);
  return frame;
}

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

  it('extracts TIT2, TPE1, TALB, and APIC artwork from ID3v2.3 tag', () => {
    const tit2 = encodeTextFrame('TIT2', 'Música Teste');
    const tpe1 = encodeTextFrame('TPE1', 'João Silva');
    const talb = encodeTextFrame('TALB', 'Álbum 2.0');
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const apic = encodeApicFrame('image/jpeg', jpeg);

    const tagSize = tit2.length + tpe1.length + talb.length + apic.length;
    const header = new Uint8Array([
      0x49, 0x44, 0x33, // ID3
      0x03, 0x00,       // v2.3
      0x00,             // flags
      (tagSize >>> 21) & 0x7f,
      (tagSize >>> 14) & 0x7f,
      (tagSize >>> 7) & 0x7f,
      tagSize & 0x7f,
    ]);

    const full = new Uint8Array(header.length + tagSize);
    let offset = 0;
    for (const part of [header, tit2, tpe1, talb, apic]) {
      full.set(part, offset);
      offset += part.length;
    }

    const meta = extractMetadataFromBuffer(full.buffer);
    expect(meta.title).toBe('Música Teste');
    expect(meta.artist).toBe('João Silva');
    expect(meta.album).toBe('Álbum 2.0');
    expect(meta.artworkBlob).toBeDefined();
    expect(meta.artworkBlob?.type).toBe('image/jpeg');
    expect(meta.artworkBlob?.size).toBe(jpeg.length);
  });

  it('falls back to scanning embedded PNG signature without ID3 header', () => {
    const pngBytes = new Uint8Array([
      0x00, 0x00, 0x00,
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const meta = extractMetadataFromBuffer(pngBytes.buffer);
    expect(meta.artworkBlob).toBeDefined();
    expect(meta.artworkBlob?.type).toBe('image/png');
  });
});
