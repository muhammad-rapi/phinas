/** The centred square of a w x h image (the part a round avatar shows). */
export function squareCrop(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h)
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size }
}

/** The server takes JPEG data URLs up to this length. */
export const AVATAR_MAX_CHARS = 60000

/**
 * Turns a picked image into a small square JPEG data URL for the profile photo.
 * Rejects with a readable message when the file is not an image or stays too large.
 */
export async function toAvatar(file: File, px = 160): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file gambar (JPG, PNG, atau WebP).')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Gambar ini tidak bisa dibuka.')
  }
  const { sx, sy, size } = squareCrop(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Gambar ini tidak bisa diproses.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, px, px)
  bitmap.close()
  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= AVATAR_MAX_CHARS) return url
  }
  throw new Error('Gambar ini terlalu rumit untuk dijadikan foto. Coba gambar lain.')
}
