import { create } from 'zustand'

/**
 * Admin theater context — chi nhánh admin đang xem.
 *
 * <p>Industry standard (Vista Veezi / Cinetixx): admin LUÔN có 1 chi nhánh
 * active. KHÔNG có mode "tất cả chi nhánh" vì showtime/room/booking/payment
 * đều theater-scoped — cross-branch view chỉ tạo confusion. SUPER_ADMIN
 * switch giữa các CN qua dropdown ở topbar; BRANCH_ADMIN lock vào CN được gán.
 *
 * <p>{@code null} chỉ xuất hiện trong khoảnh khắc đầu tiên trước khi
 * {@code AdminTheaterSelector} auto-pick chi nhánh đầu tiên. Operational
 * pages có thể dùng nullish-coalescing để xử lý ngắn gọn.
 *
 * <p>Persist localStorage để giữ context qua page reload.
 */

export interface CurrentAdminTheater {
  id: number
  code: string
  name: string
  city: string
}

interface AdminTheaterState {
  /** null = chưa chọn (auto-pick first ngay sau khi theaters load). */
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
