import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';

export interface OfflineTrackMetadata {
  artworkUrl?: string;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Extracts embedded cover art (ID3v2 APIC, PNG, or JPEG) from an audio buffer.
 */
export function parseEmbeddedCover(buffer: ArrayBuffer): string | undefined {
  if (!buffer || buffer.byteLength < 10) return undefined;
  const bytes = new Uint8Array(buffer);

  // 1. Check ID3v2 APIC Tag
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const version = bytes[3];
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);

    let offset = 10;
    const maxOffset = Math.min(bytes.length, tagSize + 10);

    while (offset + 10 < maxOffset) {
      const frameId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const frameSize =
        version === 4
          ? ((bytes[offset + 4] & 0x7f) << 21) |
            ((bytes[offset + 5] & 0x7f) << 14) |
            ((bytes[offset + 6] & 0x7f) << 7) |
            (bytes[offset + 7] & 0x7f)
          : (bytes[offset + 4] << 24) |
            (bytes[offset + 5] << 16) |
            (bytes[offset + 6] << 8) |
            bytes[offset + 7];

      if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

      if (frameId === 'APIC') {
        const frameDataOffset = offset + 10;
        const encoding = bytes[frameDataOffset];
        let mimeEnd = frameDataOffset + 1;
        while (mimeEnd < frameDataOffset + frameSize && bytes[mimeEnd] !== 0) {
          mimeEnd++;
        }
        let mimeType = 'image/jpeg';
        if (mimeEnd > frameDataOffset + 1) {
          mimeType = String.fromCharCode(...bytes.subarray(frameDataOffset + 1, mimeEnd));
        }

        let picDataStart = mimeEnd + 2; // skip null + picture type byte
        if (encoding === 1 || encoding === 2) {
          while (
            picDataStart + 1 < frameDataOffset + frameSize &&
            !(bytes[picDataStart] === 0 && bytes[picDataStart + 1] === 0)
          ) {
            picDataStart += 2;
          }
          picDataStart += 2;
        } else {
          while (picDataStart < frameDataOffset + frameSize && bytes[picDataStart] !== 0) {
            picDataStart++;
          }
          picDataStart += 1;
        }

        if (picDataStart < frameDataOffset + frameSize) {
          const imgBytes = bytes.subarray(picDataStart, frameDataOffset + frameSize);
          return `data:${mimeType.trim() || 'image/jpeg'};base64,${uint8ArrayToBase64(imgBytes)}`;
        }
      }
      offset += 10 + frameSize;
    }
  }

  // 2. Fallback: scan first 512KB for embedded PNG or JPEG signatures
  const limit = Math.min(bytes.length - 8, 524288);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) {
      let eoi = i + 8;
      while (eoi + 7 < bytes.length && eoi - i < 2000000) {
        if (
          bytes[eoi] === 0x49 &&
          bytes[eoi + 1] === 0x45 &&
          bytes[eoi + 2] === 0x4e &&
          bytes[eoi + 3] === 0x44
        ) {
          eoi += 8;
          break;
        }
        eoi++;
      }
      if (eoi > i + 20) {
        return `data:image/png;base64,${uint8ArrayToBase64(bytes.subarray(i, eoi))}`;
      }
    }
  }

  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      let eoi = i + 3;
      while (eoi + 1 < bytes.length && eoi - i < 2000000) {
        if (bytes[eoi] === 0xff && bytes[eoi + 1] === 0xd9) {
          eoi += 2;
          break;
        }
        eoi++;
      }
      if (eoi > i + 100) {
        return `data:image/jpeg;base64,${uint8ArrayToBase64(bytes.subarray(i, eoi))}`;
      }
    }
  }

  return undefined;
}

export async function getArrayBufferFromUri(uri: string): Promise<ArrayBuffer | null> {
  try {
    const cleanUri = uri.replace(/^file:\/\//, '');
    let base64: string | null = null;

    if (cleanUri.startsWith('content://')) {
      const scanner = NativeModules?.FolderScanner;
      if (scanner && typeof scanner.readHeaderBase64 === 'function') {
        base64 = await scanner.readHeaderBase64(cleanUri, 1048576);
      }
    } else if (typeof RNFS.read === 'function') {
      try {
        // Read only the header slice needed for ID3v2 / embedded artwork instead of the whole MP3
        let readLength = 524288;
        const headerBase64 = await RNFS.read(cleanUri, 10, 0, 'base64');
        if (headerBase64) {
          const hdr = Buffer.from(headerBase64, 'base64');
          if (hdr.length >= 10 && hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33) {
            const tagSize =
              ((hdr[6] & 0x7f) << 21) |
              ((hdr[7] & 0x7f) << 14) |
              ((hdr[8] & 0x7f) << 7) |
              (hdr[9] & 0x7f);
            readLength = Math.min(2097152, Math.max(524288, tagSize + 10));
          }
        }
        base64 = await RNFS.read(cleanUri, readLength, 0, 'base64');
      } catch {
        base64 = null;
      }
    }

    if (!base64) {
      base64 = await RNFS.readFile(cleanUri, 'base64');
    }

    const buffer = Buffer.from(base64, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    return null;
  }
}

export async function getTextFromUri(uri: string): Promise<string> {
  try {
    const cleanUri = uri.replace(/^file:\/\//, '');
    if (cleanUri.startsWith('content://')) {
      const scanner = NativeModules?.FolderScanner;
      if (scanner && typeof scanner.readTextUri === 'function') {
        const text = await scanner.readTextUri(cleanUri);
        if (text) return text;
      }
    }
    return await RNFS.readFile(cleanUri, 'utf8');
  } catch {
    return '';
  }
}

export async function extractOfflineMetadata(uri: string): Promise<OfflineTrackMetadata> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return {};
  }
  const buffer = await getArrayBufferFromUri(uri);
  if (!buffer) return {};
  return { artworkUrl: parseEmbeddedCover(buffer) };
}

export const isAudioFile = (name: string): boolean =>
  ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus'].includes(
    name.toLowerCase().split('.').pop() || ''
  );

export const isImageFile = (name: string): boolean =>
  ['jpg', 'jpeg', 'png', 'webp'].includes(name.toLowerCase().split('.').pop() || '');

export const isLyricsFile = (name: string): boolean =>
  ['lrc', 'txt'].includes(name.toLowerCase().split('.').pop() || '');

export function normalizeMediaUri(uri: string): string {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:')
  ) {
    return uri;
  }
  return `file://${uri}`;
}
