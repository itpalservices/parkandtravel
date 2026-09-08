/**
 * Client-side image compression for vehicle-photo uploads.
 *
 * Why this exists: camera photos captured directly on phones/tablets are routinely 3-10MB —
 * comfortably under our own 10MB app limit, but often larger than a reverse proxy's default
 * request-body cap (e.g. nginx's default client_max_body_size is 1MB), which silently rejects
 * the upload with no useful error before it ever reaches the backend. Shrinking every photo to
 * ~1MB client-side avoids that entirely and makes uploads faster on mobile networks.
 *
 * Re-encoding through a canvas also normalizes whatever the source format/MIME actually was
 * (some devices report camera captures with an empty or nonstandard `file.type`) into a plain
 * JPEG the backend is guaranteed to accept.
 */

export interface CompressImageOptions {
  /** Target upper bound for the encoded file, in bytes. Default 1MB. */
  maxSizeBytes?: number;
  /** Longest edge, in pixels, to downscale to before compressing. Default 1920. */
  maxDimension?: number;
  /** Lowest JPEG quality we'll fall back to before accepting whatever size results. */
  minQuality?: number;
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxSizeBytes: 1024 * 1024,
  maxDimension: 1920,
  minQuality: 0.4,
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function withJpegExtension(originalName: string): string {
  const base = originalName.replace(/\.[a-zA-Z0-9]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Compresses/normalizes an image file down to roughly `maxSizeBytes`, downscaling dimensions
 * and reducing JPEG quality as needed. Returns `null` if the file can't be read or decoded as
 * an image at all (e.g. an unsupported format like HEIC in a browser that can't render it) —
 * callers should treat that as "unsupported file" and tell the user, not as "already fine".
 *
 * Already-small, already-compliant files (jpeg/png/webp under the size cap) are returned
 * untouched to avoid pointless re-encoding.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File | null> {
  const { maxSizeBytes, maxDimension, minQuality } = { ...DEFAULT_OPTIONS, ...options };

  const alreadyCompliant = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (alreadyCompliant && file.size <= maxSizeBytes) {
    return file;
  }

  let dataUrl: string;
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch {
    return null;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return null;
  }

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) return null;

  let blob: Blob | null = null;
  let dimensionScale = 1;

  for (let dimAttempt = 0; dimAttempt < 4 && !blob; dimAttempt++) {
    const fitScale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const scale = fitScale * dimensionScale;
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.9;
    for (let qAttempt = 0; qAttempt < 6; qAttempt++) {
      const candidate = await canvasToBlob(canvas, quality);
      if (!candidate) break;
      if (candidate.size <= maxSizeBytes || quality <= minQuality) {
        blob = candidate;
        break;
      }
      quality -= 0.15;
    }

    dimensionScale *= 0.7;
  }

  if (!blob) return null;

  return new File([blob], withJpegExtension(file.name), { type: 'image/jpeg', lastModified: Date.now() });
}
