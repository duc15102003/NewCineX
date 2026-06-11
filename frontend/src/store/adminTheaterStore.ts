import { create } from 'zustand'

/**
 * Admin theater context — chi nhánh admin đang FILTER VIEW.
 *
 * <p>Khác với {@code useTheaterStore} (user-facing): admin có thể chọn
 * "Tất cả chi nhánh" (null) → list room/showtime/booking toàn hệ thống.
 * User-facing bắt buộc chọn 1 chi nhánh cụ thể (modal block UI).
 *
 * <p>Mục đích: admin tổng (super admin) cần xem cross-branch report; branch
 * manager filter nhanh data theo chi nhánh phụ trách → CHỌN 1 ID.
 *
 * <p>Persist localStorage để giữ state qua page reload.
 */

export interface CurrentAdminTheater {
  id: number
  code: string
  name: string
  city: string
}

interface AdminTheaterState {
  /** null = "Tất cả chi nhánh"; có giá trị = filter theo theater đó. */
  currentTheater: CurrentAdminTheater | null
  setCurrentTheater: (t: CurrentAdminTheater | null) => void
}

const STORAGE_KEY = 'adminCurrentTheater'

function load(): CurrentAdminTheater | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useAdminTheaterStore = create<AdminTheaterState>((set) => ({
  currentTheater: load(),

  setCurrentTheater: (t) => {
    if (t === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    }
    set({ currentTheater: t })
  },
}))
