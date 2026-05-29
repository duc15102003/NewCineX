import { create } from 'zustand'

interface User {
  username: string
  role: string
  avatarUrl?: string | null
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (token: string, refreshToken: string, user: User) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  isLoggedIn: () => boolean
  isAdmin: () => boolean
}

function parseUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: parseUser(),

  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, refreshToken, user })
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
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    set({ token: null, refreshToken: null, user: null })
  },

  isLoggedIn: () => !!get().token,
  isAdmin: () => get().user?.role === 'ADMIN',
}))
