import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminShowtime {
  id: number
  movieTitle: string
  moviePosterUrl: string | null
  roomName: string
  roomType: string
  /** Chi nhánh — hiển thị cột riêng ở "Tất cả chi nhánh" mode. BE đã expose từ ShowtimeListResponse. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  sweetboxPrice: number | null
  deluxePrice: number | null
  status: string
  storageState: string
  /** Định dạng chiếu — null cho suất legacy trước migration 035. FE fallback "—" hoặc TWO_D. */
  format?: string | null
  /** Mode ngôn ngữ — null cho legacy. */
  languageMode?: string | null
  // Optional nested fields (legacy response shape)
  movie?: { title: string; posterUrl?: string | null }
  room?: { name: string; type?: string }
}

/**
 * Params filter cho list showtime — match với BE ShowtimeFilter.java.
 * Tất cả field optional, undefined = không lọc.
 */
export interface AdminShowtimeParams {
  keyword?: string
  movieId?: number
  roomId?: number
  theaterId?: number              // Filter theo chi nhánh (admin context)
  status?: string                 // SCHEDULED | ONGOING | FINISHED | CANCELLED
  roomType?: string               // TWO_D | THREE_D | IMAX | FOUR_DX
  startDate?: string              // YYYY-MM-DD — lọc theo ngày cụ thể
  startTimeFrom?: string          // YYYY-MM-DDTHH:mm — datetime range from
  startTimeTo?: string            // YYYY-MM-DDTHH:mm — datetime range to
  minPrice?: number
  maxPrice?: number
  includeDeleted?: boolean
  page?: number
  size?: number
}

/**
 * Detail response (GET /api/showtimes/{id}) — đầy đủ field để fill form.
 * Khác với AdminShowtime (list) thiếu movieId/roomId/theaterId/movieRunId.
 */
export interface AdminShowtimeDetail {
  id: number
  movieId: number
  movieRunId: number | null
  theaterId: number
  roomId: number
  startTime: string
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  /** Giá Sweetbox — null = phòng không có hoặc chưa set, BE sẽ fallback couplePrice × 2 khi book. */
  sweetboxPrice: number | null
  /** Giá Deluxe — null = phòng không có hoặc chưa set, BE sẽ fallback vipPrice × 1.5 khi book. */
  deluxePrice: number | null
  status: string
  /** Định dạng (TWO_D/THREE_D/IMAX/IMAX_3D/FOUR_DX/SCREEN_X) — null cho legacy. */
  format?: string | null
  /** Mode ngôn ngữ (SUB_VI/DUB_VI/ORIGINAL) — null cho legacy. */
  languageMode?: string | null
}

/** Fetch showtime detail — dùng cho form edit, cần đầy đủ các FK. */
export function useShowtimeDetail(id: number | undefined) {
  return useQuery({
    queryKey: ['showtime', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminShowtimeDetail>>(`/api/showtimes/${id}`)
      return res.data.data
    },
  })
}

export function useAdminShowtimes(params: AdminShowtimeParams = {}) {
  return useQuery({
    queryKey: ['admin', 'showtimes', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminShowtime>>>('/api/showtimes', {
        params: { includeDeleted: true, ...params },
      })
      return res.data.data
    },
  })
}

export function useCreateShowtime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await api.post<ApiResponse<unknown>>('/api/showtimes', data); return res.data.data },
    onSuccess: () => { toast.success('Tạo suất chiếu thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateShowtime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/showtimes/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/showtimes/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/showtimes/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

/** Chế độ rải slot — chuẩn Vista/Veezi/Cinetixx. */
export type AutoScheduleSlotMode = 'WINDOW' | 'TEMPLATES'

/** Định dạng chiếu — chuẩn industry CGV/Lotte/BHD. */
export type ShowtimeFormat =
  | 'TWO_D' | 'THREE_D' | 'IMAX' | 'IMAX_3D' | 'FOUR_DX' | 'SCREEN_X'

/** Mode ngôn ngữ — chuẩn rạp VN. */
export type ShowtimeLanguageMode = 'SUB_VI' | 'DUB_VI' | 'ORIGINAL'

/**
 * Auto-schedule request matching BE AutoScheduleRequest DTO.
 * Tạo hàng loạt suất chiếu cho 1 phim trên N phòng × M ngày.
 */
export interface AutoScheduleRequest {
  movieId: number
  theaterId: number
  roomIds: number[]
  dateFrom: string        // YYYY-MM-DD
  dateTo: string          // YYYY-MM-DD
  startHour: number       // 0-23
  endHour: number         // 1-24
  // bufferMinutes đã bỏ — BE luôn lấy từ system_config (showtime.buffer_minutes)
  basePrice: number
  vipPrice?: number
  couplePrice?: number
  sweetboxPrice?: number
  deluxePrice?: number
  /**
   * Ngày trong tuần được chiếu — ISO 1=Mon..7=Sun. null/empty = mọi ngày.
   * Dùng khi rạp chỉ chiếu cuối tuần hoặc loại weekday.
   */
  weekdays?: number[]
  /** WINDOW (auto-fill) hoặc TEMPLATES (giờ cố định). Default WINDOW. */
  slotMode?: AutoScheduleSlotMode
  /** Giờ cố định "HH:mm" khi slotMode=TEMPLATES — vd ["10:00","13:00","16:00","19:00"]. */
  fixedTimes?: string[]
  /** Định dạng áp cho tất cả suất sinh ra — default TWO_D nếu BE nhận null. */
  format?: ShowtimeFormat
  /** Mode ngôn ngữ — default SUB_VI nếu BE nhận null. */
  languageMode?: ShowtimeLanguageMode
  /** Tạo dưới dạng DRAFT (chưa public). Default false → SCHEDULED ngay. */
  asDraft?: boolean
}

export interface AutoScheduleResult {
  created: number
  skipped: number
  details: Array<{
    roomId: number
    roomName: string
    startTime: string
    status: 'CREATED' | 'SKIPPED'
    reason?: string
    showtimeId?: number
  }>
}

/** Publish 1 suất DRAFT → SCHEDULED (visible cho user). */
export function usePublishShowtime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/showtimes/${id}/publish`)
    },
    onSuccess: () => {
      toast.success('Đã publish suất chiếu')
      qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Publish thất bại')),
  })
}

/** Bulk publish DRAFT → SCHEDULED. */
export function useBulkPublishShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await api.post<ApiResponse<number>>('/api/showtimes/bulk-publish', { ids })
      return res.data.data ?? 0
    },
    onSuccess: (count) => {
      toast.success(`Đã publish ${count} suất chiếu`)
      qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Bulk publish thất bại')),
  })
}

export function useAutoScheduleShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: AutoScheduleRequest) => {
      const res = await api.post<ApiResponse<AutoScheduleResult>>('/api/showtimes/auto-schedule', req)
      return res.data
    },
    onSuccess: (resp) => {
      const data = resp.data
      if (data.created > 0) {
        toast.success(`Đã tạo ${data.created} suất chiếu` + (data.skipped > 0 ? `, skip ${data.skipped}` : ''))
      } else {
        toast.warning(`Không tạo được suất nào (skip ${data.skipped})`)
      }
      qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Auto-schedule thất bại')),
  })
}
