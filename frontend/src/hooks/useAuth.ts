import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from '@/types/auth'
import { jwtDecode } from '@/utils/jwt'

export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', data)
      return res.data.data
    },
    onSuccess: async (data) => {
      // Ưu tiên đọc role + theater từ AuthResponse (BE đã expose). Fallback decode JWT.
      const decoded = jwtDecode(data.accessToken)
      const role = data.role ?? decoded.role

      // Giai đoạn demo đồ án: chỉ ADMIN/SUPER_ADMIN được vào hệ thống.
      // USER thường login OK ở BE nhưng FE chặn lại + clear refresh cookie BE vừa set.
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        api.post('/api/auth/logout').catch(() => {})
        toast.error('Tính năng dành cho người dùng đang được phát triển, vui lòng quay lại sau')
        return
      }

      // Sau A3: refresh token đi qua HttpOnly cookie (BE set qua Set-Cookie header),
      // FE chỉ lưu access token. Browser tự gửi cookie khi gọi /api/auth/refresh.
      setAuth(data.accessToken, {
        username: data.username ?? decoded.sub,
        role,
        theaterId: data.theaterId ?? null,
        theaterName: data.theaterName ?? null,
        theaterCity: data.theaterCity ?? null,
      })
      // Fetch profile để lấy avatarUrl sau login
      try {
        const profile = await api.get('/api/users/me')
        const avatarUrl = profile.data?.data?.avatarUrl
        if (avatarUrl) useAuthStore.getState().updateUser({ avatarUrl })
      } catch { /* ignore */ }
      toast.success('Đăng nhập thành công')
      // [DEMO ĐỒ ÁN] Tab Tổng quan đang ẩn → vào thẳng tab đầu tiên (Thể loại).
      navigate('/admin/genres')
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, 'Đăng nhập thất bại'))
    },
  })
}

export function useRegister() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/api/auth/register', data)
      return res.data.data
    },
    onSuccess: (data) => {
      const decoded = jwtDecode(data.accessToken)
      setAuth(data.accessToken, {
        username: decoded.sub,
        role: decoded.role,
      })
      toast.success('Đăng ký thành công')
      navigate('/')
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, 'Đăng ký thất bại'))
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  return () => {
    api.post('/api/auth/logout').catch(() => {})
    logout()
    toast.success('Đã đăng xuất')
    navigate('/login')
  }
}

/**
 * Forgot password — gửi email reset link.
 * Cố tình KHÔNG bubble error: BE trả 200 ngay cả khi email không tồn tại
 * (chống user enumeration), nhưng nếu có network error vẫn cần treat as success.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post('/api/auth/forgot-password', { email })
    },
  })
}

interface ResetPasswordPayload {
  token: string
  newPassword: string
  confirmPassword: string
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordPayload) => {
      await api.post('/api/auth/reset-password', data)
    },
  })
}

/** Xác thực email từ token query trong URL. */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      await api.get('/api/auth/verify-email', { params: { token } })
    },
  })
}

interface UploadAvatarResponse {
  avatarUrl: string
}

/** Upload avatar — multipart/form-data, cập nhật authStore + invalidate profile. */
export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<ApiResponse<UploadAvatarResponse>>(
        '/api/users/me/avatar', formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return res.data.data!
    },
    onSuccess: (data) => {
      if (data.avatarUrl) useAuthStore.getState().updateUser({ avatarUrl: data.avatarUrl })
      toast.success('Cập nhật ảnh đại diện thành công')
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: () => toast.error('Upload ảnh thất bại'),
  })
}
