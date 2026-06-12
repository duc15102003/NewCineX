import { useEffect } from 'react'

const SUFFIX = ' - CineX'

/**
 * Set document.title cho 1 page — restore "CineX" khi unmount.
 *
 * <p>Trước đó toàn bộ tab hiển thị "Vite + React" → user mở nhiều tab không
 * phân biệt được. Chuẩn UX web: title page-specific + suffix brand. Cũng giúp
 * SEO khi page lên Google (nếu sau này thêm SSR / public crawler).
 *
 * <p>Pattern dùng vanilla useEffect thay vì react-helmet để tránh thêm dep
 * 30KB chỉ cho 1 việc nhỏ. SEO nâng cao (meta description, og tags) khi cần
 * mới dùng react-helmet.
 *
 * @example
 *   usePageTitle('Đặt vé xem phim')           // → "Đặt vé xem phim - CineX"
 *   usePageTitle(`Chi tiết ${movie.title}`)   // → "Chi tiết Inception - CineX"
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title + SUFFIX
    return () => {
      document.title = prev
    }
  }, [title])
}
