// Centralized color maps for status/type badges
// Single Responsibility: mỗi domain có color map riêng, dễ maintain

// Booking status
export const BOOKING_STATUS_COLORS: Record<string, string> = {
  HOLDING: 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30',
  CONFIRMED: 'bg-green-500/20 text-green-400 border-green-500/30',
  CHECKED_IN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  EXPIRED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Movie status
export const MOVIE_STATUS_COLORS: Record<string, string> = {
  NOW_SHOWING: 'bg-green-500/20 text-green-400 border-green-500/30',
  COMING_SOON: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ENDED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Showtime status
export const SHOWTIME_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ONGOING: 'bg-green-500/20 text-green-400 border-green-500/30',
  FINISHED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// Room status
export const ROOM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
  MAINTENANCE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  INACTIVE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Room type
export const ROOM_TYPE_COLORS: Record<string, string> = {
  TWO_D: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  THREE_D: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  IMAX: 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20',
  FOUR_DX: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
}

// Storage state (genres, snacks, vouchers)
export const STORAGE_STATE_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
  ARCHIVED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

// User role
export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30',
  USER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}
