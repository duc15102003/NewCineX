import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface ComboItem {
  id?: number
  snackId: number
  snackName?: string
  snackImageUrl?: string | null
  snackPrice?: number
  quantity: number
}

export interface Combo {
  id: number
  storageState: string
  /** Chi nhánh sở hữu combo — combo chỉ chứa snack của cùng theater. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
  code: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  active: boolean
  items: ComboItem[]
  regularPrice: number
  /** Số tiền tiết kiệm = regularPrice - price. NULL nếu combo không có lợi. */
  savingsAmount: number | null
  /** Phần trăm tiết kiệm làm tròn. NULL nếu combo không có lợi. */
  savingsPercent: number | null
  createdAt: string
  updatedAt: string
  /**
   * BE tính: combo có thật sự bán được không.
   * True ⇔ active && !ARCHIVED && tất cả snack ingredient còn hàng + không archived.
   * False → POS auto-hide combo này; admin nhìn thấy badge "Tạm hết".
   */
  effectiveAvailable: boolean
  /**
   * Danh sách tên snack đang thiếu khiến combo bị block. Empty khi
   * effectiveAvailable=true. Dùng cho tooltip "Tạm hết do: A, B".
   */
  unavailableItems: string[]
}

export function useAdminCombos(params: { theaterId?: number; page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'combos', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Combo>>>('/api/combos', { params })
      return res.data.data
    },
  })
}

/** Combo active để bán — theaterId bắt buộc nếu muốn lọc theo rạp (POS / booking add-on).
 *  enabled=false → skip fetch (vd FEATURES.admin.combos=false thì POS không cần). */
export function usePublicCombos(theaterId?: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['combos', 'public', theaterId ?? 'all'],
    enabled,
    queryFn: async () => {
      const params = theaterId ? { theaterId } : undefined
      const res = await api.get<ApiResponse<Combo[]>>('/api/combos/public', { params })
      return res.data.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCombo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<Combo>>('/api/combos', data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Tạo combo thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateCombo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<Combo>>(`/api/combos/${id}`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Cập nhật combo thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useArchiveCombo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/api/combos/${id}`) },
    onSuccess: () => {
      toast.success('Đã lưu trữ')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkArchiveCombos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/combos/bulk-archive', ids) },
    onSuccess: () => {
      toast.success('Đã lưu trữ')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreCombos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/combos/bulk-restore', ids) },
    onSuccess: () => {
      toast.success('Đã khôi phục')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

/** Upload ảnh combo — multipart, pattern y hệt useUploadSnackImage. */
export function useUploadComboImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/api/combos/${id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success('Upload ảnh thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'combos'] })
      qc.invalidateQueries({ queryKey: ['combos', 'public'] })
    },
    onError: () => toast.error('Upload ảnh thất bại'),
  })
}

/**
 * Snacks options dropdown — cache cho combo form.
 * Yêu cầu theaterId: combo chỉ chứa snack của cùng chi nhánh.
 */
export function useSnacksOptions(theaterId?: number | null) {
  return useQuery({
    queryKey: ['snacks', 'options', theaterId],
    enabled: theaterId != null,
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<{ id: number; name: string; price: number; imageUrl: string | null; theaterId: number }>>>(
        '/api/snacks', { params: { size: 100, theaterId } },
      )
      return res.data.data?.content ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
