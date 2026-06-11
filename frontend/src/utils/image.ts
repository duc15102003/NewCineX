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
