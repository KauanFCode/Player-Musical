export interface ExtractedAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkBlob?: Blob;
}

function decodeId3Text(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  const encoding = bytes[0];
  const payload = bytes.subarray(1);

  try {
    if (encoding === 0) {
      return new TextDecoder('latin1').decode(payload).replace(/\0+$/g, '').trim();
    }
    if (encoding === 1) {
      if (payload.length >= 2 && payload[0] === 0xfe && payload[1] === 0xff) {
        return new TextDecoder('utf-16be')
          .decode(payload.subarray(2))
          .replace(/\0+$/g, '')
          .trim();
      }
      if (payload.length >= 2 && payload[0] === 0xff && payload[1] === 0xfe) {
        return new TextDecoder('utf-16le')
          .decode(payload.subarray(2))
          .replace(/\0+$/g, '')
          .trim();
      }
      return new TextDecoder('utf-16le').decode(payload).replace(/\0+$/g, '').trim();
    }
    if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(payload).replace(/\0+$/g, '').trim();
    }
    if (encoding === 3) {
      return new TextDecoder('utf-8').decode(payload).replace(/\0+$/g, '').trim();
    }
  } catch {
    // Fallback below
  }

  return new TextDecoder('utf-8', { fatal: false })
    .decode(payload)
    .replace(/\0+$/g, '')
    .trim();
}

function scanFallbackImageBlob(bytes: Uint8Array): Blob | undefined {
  const limit = Math.min(bytes.length - 8, 524288);

  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x89 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x4e &&
      bytes[i + 3] === 0x47
    ) {
      let eoi = i + 8;
      while (eoi + 7 < bytes.length && eoi - i < 2500000) {
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
        return new Blob([bytes.slice(i, eoi)], { type: 'image/png' });
      }
    }
  }

  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      let eoi = i + 3;
      while (eoi + 1 < bytes.length && eoi - i < 2500000) {
        if (bytes[eoi] === 0xff && bytes[eoi + 1] === 0xd9) {
          eoi += 2;
          break;
        }
        eoi++;
      }
      if (eoi > i + 100) {
        return new Blob([bytes.slice(i, eoi)], { type: 'image/jpeg' });
      }
    }
  }

  return undefined;
}

/**
 * Extracts ID3v2 metadata (TIT2, TPE1, TALB, APIC) or embedded PNG/JPEG cover art
 * directly from an audio ArrayBuffer.
 */
export function extractMetadataFromBuffer(buffer: ArrayBuffer): ExtractedAudioMetadata {
  if (!buffer || buffer.byteLength < 10) return {};
  const bytes = new Uint8Array(buffer);
  const result: ExtractedAudioMetadata = {};

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const version = bytes[3];
    const flags = bytes[5];
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);

    let offset = 10;
    // Skip ID3v2 extended header if present (bit 6)
    if ((flags & 0x40) !== 0 && offset + 4 <= bytes.length) {
      const extSize =
        version === 4
          ? ((bytes[offset] & 0x7f) << 21) |
            ((bytes[offset + 1] & 0x7f) << 14) |
            ((bytes[offset + 2] & 0x7f) << 7) |
            (bytes[offset + 3] & 0x7f)
          : (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
      offset += version === 4 ? extSize : extSize + 4;
    }

    const maxOffset = Math.min(bytes.length, tagSize + 10);

    while (offset + 10 <= maxOffset) {
      if (bytes[offset] === 0) break;
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
          : ((bytes[offset + 4] << 24) |
              (bytes[offset + 5] << 16) |
              (bytes[offset + 6] << 8) |
              bytes[offset + 7]) >>>
            0;

      if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

      const frameStart = offset + 10;
      const frameEnd = frameStart + frameSize;
      const frameBytes = bytes.subarray(frameStart, frameEnd);

      if (frameId === 'TIT2') {
        const decoded = decodeId3Text(frameBytes);
        if (decoded) result.title = decoded;
      } else if (frameId === 'TPE1') {
        const decoded = decodeId3Text(frameBytes);
        if (decoded) result.artist = decoded;
      } else if (frameId === 'TALB') {
        const decoded = decodeId3Text(frameBytes);
        if (decoded) result.album = decoded;
      } else if (frameId === 'APIC' && !result.artworkBlob) {
        const encoding = frameBytes[0];
        let mimeEnd = 1;
        while (mimeEnd < frameBytes.length && frameBytes[mimeEnd] !== 0) {
          mimeEnd++;
        }
        let mimeType = 'image/jpeg';
        if (mimeEnd > 1) {
          mimeType = String.fromCharCode(...frameBytes.subarray(1, mimeEnd)).trim();
        }
        if (mimeType === '-->' || mimeType === '') {
          mimeType = 'image/jpeg';
        }

        let picDataStart = mimeEnd + 2; // null + picture type byte
        if (encoding === 1 || encoding === 2) {
          while (
            picDataStart + 1 < frameBytes.length &&
            !(frameBytes[picDataStart] === 0 && frameBytes[picDataStart + 1] === 0)
          ) {
            picDataStart += 2;
          }
          picDataStart += 2;
        } else {
          while (picDataStart < frameBytes.length && frameBytes[picDataStart] !== 0) {
            picDataStart++;
          }
          picDataStart += 1;
        }

        if (picDataStart < frameBytes.length) {
          const imgBytes = frameBytes.slice(picDataStart);
          result.artworkBlob = new Blob([imgBytes], { type: mimeType });
        }
      }

      offset = frameEnd;
    }
  }

  if (!result.artworkBlob) {
    result.artworkBlob = scanFallbackImageBlob(bytes);
  }

  return result;
}

export async function extractMetadataFromFile(file: File | Blob): Promise<ExtractedAudioMetadata> {
  try {
    // Only need the first 3MB at most for ID3v2 headers & embedded covers
    const slice = file.slice(0, Math.min(file.size, 3 * 1024 * 1024));
    const buffer = await slice.arrayBuffer();
    return extractMetadataFromBuffer(buffer);
  } catch {
    return {};
  }
}

export const isAudioFile = (name: string): boolean =>
  ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus', 'webm'].includes(
    name.toLowerCase().split('.').pop() || ''
  );

export const isImageFile = (name: string): boolean =>
  ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(name.toLowerCase().split('.').pop() || '');

export const isLyricsFile = (name: string): boolean =>
  ['lrc', 'txt'].includes(name.toLowerCase().split('.').pop() || '');
