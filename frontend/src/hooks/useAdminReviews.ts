import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

/**
 * Hook chuyên biệt cho trang AdminReviewPage — gọi endpoint /api/reviews/admin
 * (chỉ ROLE_ADMIN). Tách file riêng theo Single Responsibility: 1 domain = 1 hook file.
 *
 * Note: useReviews.ts cũng có useAdminReviews cho mục đích re-use cross-module,
 * file này expose interface giàu hơn (sort/userId) và là API canonical cho trang admin.
 */

export interface AdminReview {
  id: number
  storageState: string
  username: string
  avatarUrl: string | null
  movieId: number
  movieTitle: string
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
}

/**
 * Map 1-1 với BE ReviewFilter.java.
 */
export interface AdminReviewFilter {
  // Search: LIKE trên user.username/fullName/email + movie.title + comment
  keyword?: string
  movieId?: number
  userId?: number
  minRating?: number
  maxRating?: number
  hasComment?: boolean
  createdFrom?: string  // ISO datetime
  createdTo?: string
  includeDeleted?: boolean
  page?: number
  size?: number
  sort?: string
}

function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

/**
 * Admin xem tất cả review xuyên phim (kiểm duyệt).
 */
export function useAdminReviewsPage(params: AdminReviewFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'reviews', 'page', params],
    queryFn: async () => {
      const cleaned = cleanParams({
        ...params,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })
      const res = await api.get<ApiResponse<PageResponse<AdminReview>>>('/api/reviews/admin', {
        params: cleaned,
      })
      return res.data.data
    },
  })
}

/**
 * Admin xóa 1 review (BE check role ADMIN bypass ownership).
 */
export function useAdminDeleteReviewMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: number) => {
      await api.delete(`/api/reviews/${reviewId}`)
    },
    onSuccess: () => {
      toast.success('Đã xóa đánh giá')
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi xóa')),
  })
}

/**
 * Bulk delete — gọi nối tiếp từng review vì BE chưa có endpoint batch.
 * Lý do gọi tuần tự (không Promise.all): tránh race condition với version control
 * và đảm bảo toast hiển thị 1 lần khi hoàn tất.
 */
export function useAdminBulkDeleteReviews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        await api.delete(`/api/reviews/${id}`)
      }
    },
    onSuccess: (_, ids) => {
      toast.success(`Đã xóa ${ids.length} đánh giá`)
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi xóa hàng loạt')),
  })
}

/** Khôi phục 1 review đã xóa (admin moderation). */
export function useAdminRestoreReviewMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: number) => {
      await api.put(`/api/reviews/${reviewId}/restore`)
    },
    onSuccess: () => {
      toast.success('Đã khôi phục đánh giá')
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi khôi phục')),
  })
}

/** Bulk restore — tuần tự cùng pattern bulk delete. */
export function useAdminBulkRestoreReviews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        await api.put(`/api/reviews/${id}/restore`)
      }
    },
    onSuccess: (_, ids) => {
      toast.success(`Đã khôi phục ${ids.length} đánh giá`)
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi khôi phục hàng loạt')),
  })
}
