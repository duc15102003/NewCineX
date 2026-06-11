import { create } from 'zustand'

/**
 * Theater context của user — chi nhánh user đang chọn.
 *
 * <p><b>Pattern theo chuẩn rạp:</b> giống CGV/Lotte mobile app, user phải chọn chi nhánh
 * khi mở web lần đầu. Tất cả phim/showtime/booking flow filter theo chi nhánh này.
 *
 * <p><b>Persist localStorage:</b> chọn 1 lần dùng cả sessions sau. Khi đổi chi nhánh
 * (đi du lịch tỉnh khác), user click badge ở header → đổi.
 */

export interface CurrentTheater {
  id: number
  code: string
  name: string
  city: string
}

interface TheaterState {
  currentTheater: CurrentTheater | null
  setCurrentTheater: (t: CurrentTheater) => void
  clearCurrentTheater: () => void
}

const STORAGE_KEY = 'currentTheater'

function load(): CurrentTheater | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useTheaterStore = create<TheaterState>((set) => ({
  currentTheater: load(),

  setCurrentTheater: (t) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    set({ currentTheater: t })
  },

  clearCurrentTheater: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ currentTheater: null })
  },
}))
