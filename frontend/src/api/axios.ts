import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — auto refresh token khi hết hạn
let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = []

const processQueue = (error: any, token: string | null) => {
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

    // 401 = token hết hạn → thử refresh
    // NGOẠI TRỪ: request login/register (chưa có token → không cần refresh)
    const status = error.response?.status
    const isAuthRequest = originalRequest.url?.includes('/api/auth/login')
        || originalRequest.url?.includes('/api/auth/register')
    if (status === 401 && !originalRequest._retry && !isAuthRequest) {
      // Nếu đang refresh → chờ kết quả
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

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      if (!refreshToken) {
        // Không có refresh token → đá về login
        forceLogout()
        return Promise.reject(error)
      }

      try {
        // Gọi refresh API (dùng axios mới, không qua interceptor)
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'}/api/auth/refresh`,
          { refreshToken },
        )

        const newToken = res.data.data.accessToken
        const newRefreshToken = res.data.data.refreshToken

        // Lưu token mới
        localStorage.setItem('token', newToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Retry request gốc + tất cả request đang chờ
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh cũng fail → đá về login
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
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

/**
 * Lấy message lỗi từ Axios error — dùng chung cho tất cả onError hooks.
 * Thay vì (e: any) => e.response?.data?.message → getErrorMessage(e)
 */
export function getErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string } } }).response
    if (res?.data?.message) return res.data.message
  }
  return fallback
}

export default api
