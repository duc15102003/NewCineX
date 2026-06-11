import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088',
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials=true → browser gửi kèm HttpOnly cookie (refreshToken) cho mọi request.
  // CORS BE đã setAllowCredentials(true) + allowedOrigins cụ thể (không *).
  withCredentials: true,
})

// Request interceptor — gắn access token (15min TTL) vào Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — auto refresh token khi 401
let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 401 = access token hết hạn → thử refresh (refresh token đi qua HttpOnly cookie)
    const status = error.response?.status
    const isAuthRequest = originalRequest.url?.includes('/api/auth/login')
        || originalRequest.url?.includes('/api/auth/register')
        || originalRequest.url?.includes('/api/auth/refresh')
    if (status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      // Guest (chưa từng login): không có access token → 401 → reject thuần, KHÔNG redirect.
      // Trang public (home, movie detail) có thể vô tình gọi API auth (favorite, notifications)
      // — kể cả hook quên guard, guest cũng không bị đá về login.
      const accessToken = localStorage.getItem('token')
      if (!accessToken) {
        return Promise.reject(error)
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Refresh: body rỗng, browser tự gửi HttpOnly cookie refreshToken
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'}/api/auth/refresh`,
          {},
          { withCredentials: true },
        )

        const newToken = res.data.data.accessToken
        localStorage.setItem('token', newToken)

        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        forceLogout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

function forceLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  // Legacy cleanup (refresh token trước A3 hardening)
  localStorage.removeItem('refreshToken')
  window.location.href = '/login'
}

/**
 * Lấy message lỗi từ Axios error — dùng chung cho tất cả onError hooks.
 */
export function getErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string } } }).response
    if (res?.data?.message) return res.data.message
  }
  return fallback
}

export default api
