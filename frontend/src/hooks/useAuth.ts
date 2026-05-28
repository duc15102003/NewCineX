import { useMutation } from '@tanstack/react-query'
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
      const decoded = jwtDecode(data.accessToken)
      setAuth(data.accessToken, data.refreshToken, {
        username: decoded.sub,
        role: decoded.role,
      })
      // Fetch profile để lấy avatarUrl sau login
      try {
        const profile = await api.get('/api/users/me')
        const avatarUrl = profile.data?.data?.avatarUrl
        if (avatarUrl) useAuthStore.getState().updateUser({ avatarUrl })
      } catch { /* ignore */ }
      toast.success('Đăng nhập thành công')
      navigate('/')
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
      setAuth(data.accessToken, data.refreshToken, {
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
