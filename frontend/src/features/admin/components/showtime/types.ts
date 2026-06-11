/**
 * Types chung cho ShowtimeFormDialog và sub-components — tách để tránh
 * circular import giữa các sub.
 */

export interface ShowtimeFormData {
  movieId: number
  movieRunId?: number | ''
  theaterId: number | ''
  roomId: number
  startTime: string
  /** Giá ghế thường — dùng chung cho STANDARD + HANDICAP (NĐ 28/2012). */
  basePrice: number
  vipPrice: number
  couplePrice: number
  sweetboxPrice: number
  deluxePrice: number
}

/** ClassName chuẩn cho select trong form Showtime — đồng bộ với input. */
export const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'
