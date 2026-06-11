// Centralized color maps for status/type badges
// Single Responsibility: mỗi domain có color map riêng, dễ maintain
// Pattern (Phase 7a unified): bg-{c}/10 text-{c} border-{c}/30 — low opacity warm tone

// Booking status
export const BOOKING_STATUS_COLORS: Record<string, string> = {
  HOLDING: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
  CONFIRMED: 'bg-green-500/10 text-green-400 border-green-500/30',
  CHECKED_IN: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30',
  EXPIRED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  NO_SHOW: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

// Movie status
export const MOVIE_STATUS_COLORS: Record<string, string> = {
  NOW_SHOWING: 'bg-green-500/10 text-green-400 border-green-500/30',
  COMING_SOON: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ENDED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

/**
 * Age rating colors (TT 25/2024/BVHTTDL). Mức cao hơn = warning-tone hơn.
 * - P/K: an toàn → green/blue
 * - T13: bình thường → gold (CineX accent)
 * - T16: cảnh báo nhẹ → orange
 * - T18: nghiêm trọng → red
 * (Không có mức C — phim cấm phổ biến không lên rạp, xem AgeRating.java BE)
 */
export const AGE_RATING_COLORS: Record<string, string> = {
  P: 'bg-green-500/10 text-green-400 border-green-500/30',
  K: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  T13: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
  T16: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  T18: 'bg-red-500/10 text-red-400 border-red-500/30',
}

// Movie run status — đợt chiếu của 1 phim
export const MOVIE_RUN_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  NOW_SHOWING: 'bg-green-500/10 text-green-400 border-green-500/30',
  ENDED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

// Movie run type — loại đợt chiếu (chiếu lần đầu, chiếu lại, liên hoan, đặc biệt)
export const MOVIE_RUN_TYPE_COLORS: Record<string, string> = {
  FIRST_RUN: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
  REISSUE: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  FESTIVAL: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  SPECIAL: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

// Showtime status
export const SHOWTIME_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ONGOING: 'bg-green-500/10 text-green-400 border-green-500/30',
  FINISHED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30',
}

// Room status
export const ROOM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/30',
  MAINTENANCE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  INACTIVE: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

// Room type
export const ROOM_TYPE_COLORS: Record<string, string> = {
  TWO_D: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  THREE_D: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  IMAX: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
  FOUR_DX: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
}

// Storage state (genres, snacks, vouchers)
export const STORAGE_STATE_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/30',
  ARCHIVED: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

/**
 * Seat type colors — chuẩn industry rạp VN (CGV/Lotte/BHD).
 *
 * <p>STANDARD = GREEN (không xám — xám dành cho "đã bán").
 * HANDICAP = CYAN distinguish với STANDARD green.
 */
export const SEAT_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-green-500/20 text-green-300 border-green-500/50',
  VIP: 'bg-[#ffc107]/20 text-[#ffc107] border-[#ffc107]/50',
  COUPLE: 'bg-pink-500/20 text-pink-300 border-pink-500/50',
  SWEETBOX: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  DELUXE: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  HANDICAP: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
}

/**
 * Seat status colors — admin Seat Map Editor.
 * Booking page dùng pattern riêng (available/held/booked/myselection).
 */
export const SEAT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/10 text-green-400 border-green-500/30',
  BROKEN: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  BLOCKED: 'bg-red-900/30 text-red-400 border-red-900/50',
}

// User role — màu phân cấp theo quyền (cao hơn = warm hơn)
export const ROLE_COLORS: Record<string, string> = {
  USER: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ADMIN: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
  SUPER_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/30',
}

// Payment status
export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  COMPLETED: 'bg-green-500/10 text-green-400 border-green-500/30',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
  REFUNDED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

// Payment method — màu nhận diện cổng
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  VNPAY: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  MOMO: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  CASH: 'bg-green-500/10 text-green-400 border-green-500/30',
  TRANSFER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

// Theater status — vận hành chi nhánh
export const THEATER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/30',
  MAINTENANCE: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  CLOSED: 'bg-red-500/10 text-red-400 border-red-500/30',
}

// Pricing rule type
export const PRICING_RULE_TYPE_COLORS: Record<string, string> = {
  DAY_OF_WEEK: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  HOUR_RANGE: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  DATE_RANGE: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  COMPOSITE: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
}
