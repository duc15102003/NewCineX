import { create } from 'zustand'

interface User {
  username: string
  /** USER / ADMIN / SUPER_ADMIN — match Role enum BE. */
  role: string
  avatarUrl?: string | null
  /** Chi nhánh user thuộc về — null cho USER + SUPER_ADMIN. Có id cho branch ADMIN. */
  theaterId?: number | null
  theaterName?: string | null
  theaterCity?: string | null
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  isLoggedIn: () => boolean
  /** Bất kỳ admin nào (branch ADMIN hoặc SUPER_ADMIN). */
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  /** Branch ADMIN (có theater_id). */
  isBranchAdmin: () => boolean
}

function parseUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

/**
 * Auth store sau hardening A3:
 * - {@code token} (access token, 15 phút TTL) — giữ trong localStorage để gắn Authorization header.
 *   Compromise XSS có thể dùng access token, nhưng vô hại sau 15 phút.
 * - {@code refreshToken} — KHÔNG còn lưu FE. BE set HttpOnly cookie qua Set-Cookie header
 *   → JS không đọc được → XSS không chiếm refresh token được. Browser tự gửi kèm cookie
 *   khi gọi /api/auth/refresh (axios cần {@code withCredentials: true}).
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: parseUser(),

  setAuth: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },

  updateUser: (partial) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...partial }
    localStorage.setItem('user', JSON.stringify(updated))
    set({ user: updated })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Cleanup legacy: refreshToken trước A3 hardening còn nằm trong localStorage
    localStorage.removeItem('refreshToken')
    set({ token: null, user: null })
  },

  isLoggedIn: () => !!get().token,
  isAdmin: () => {
    const role = get().user?.role
    return role === 'ADMIN' || role === 'SUPER_ADMIN'
  },
  isSuperAdmin: () => get().user?.role === 'SUPER_ADMIN',
  isBranchAdmin: () => get().user?.role === 'ADMIN' && get().user?.theaterId != null,
}))
