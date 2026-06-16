/**
 * Inject Cloudinary auto-format + auto-quality transform vào URL.
 *
 * <p>Cloudinary URL format: {@code https://res.cloudinary.com/<cloud>/image/upload/[transforms/]<public_id>}.
 * Thêm {@code f_auto,q_auto} sau {@code /upload/} → Cloudinary tự pick định dạng tối ưu:
 * <ul>
 *   <li>Chrome/Edge/Firefox/Safari 14+ → WebP (giảm ~30% size so với JPG)</li>
 *   <li>Safari cũ → JPG fallback</li>
 *   <li>{@code q_auto} → adjust chất lượng theo subject (poster phim cần sharp, banner mờ OK)</li>
 * </ul>
 *
 * <p>Không phải Cloudinary URL (vd ảnh test localhost) → trả nguyên url. Idempotent: nếu đã có
 * {@code f_auto} thì không inject 2 lần.
 *
 * @param url URL gốc (có thể null/empty — trả về undefined để JSX tránh render thẻ rỗng)
 * @param width optional — chèn {@code w_<n>} responsive (kèm {@code c_limit} không upscale)
 */
export function cdnImage(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined
  if (!url.includes('res.cloudinary.com')) return url
  if (url.includes('/upload/f_auto')) return url

  const transforms = ['f_auto', 'q_auto']
  if (width) transforms.push(`w_${width}`, 'c_limit')
  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}

/**
 * Validate file ảnh trước khi upload — đồng bộ với BE FileUploadService:
 * <ul>
 *   <li>MIME type: JPG / PNG / WebP (BE check magic bytes thêm)</li>
 *   <li>Size: ≤ 5MB</li>
 * </ul>
 *
 * <p>Pattern industry: validate FE-side để fail fast + UX tốt (toast ngay)
 * thay vì đợi BE response 400. BE vẫn là source of truth (defense in depth).
 *
 * @return null nếu OK, string error message nếu không hợp lệ
 */
export function validateImageUpload(file: File): string | null {
  const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const MAX_BYTES = 5 * 1024 * 1024 // 5MB

  if (!VALID_TYPES.includes(file.type)) {
    return `Định dạng không hỗ trợ — chỉ chấp nhận JPG, PNG, WebP (file của bạn: ${file.type || 'unknown'})`
  }
  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    return `Ảnh quá lớn (${sizeMB}MB) — tối đa 5MB`
  }
  return null
}
