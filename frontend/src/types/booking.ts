export interface SeatItem {
  id: number
  rowLabel: string
  colNumber: number
  seatNumber: string
  seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'SWEETBOX' | 'DELUXE' | 'HANDICAP'
  status: 'AVAILABLE' | 'BROKEN' | 'BLOCKED'
  aisle: boolean
  storageState: string | null
}

export interface SeatMapData {
  roomId: number
  roomName: string
  totalSeats: number
  seatMap: Record<string, SeatItem[]>
}

/**
 * Showtime detail trả về từ GET /api/showtimes/{id} — dùng cho SeatSelectionPage
 * + BookingSummary. Match BE ShowtimeResponse (xem mục pricing trong CLAUDE.md).
 */
export interface ShowtimeDetail {
  id: number
  movieId: number
  movieTitle: string
  moviePosterUrl: string | null
  movieAgeRating: string | null
  roomId: number
  roomName: string
  roomType: string
  theaterId: number
  theaterName: string | null
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  sweetboxPrice: number | null
  deluxePrice: number | null
  effectiveBasePrice: number | null
  effectiveVipPrice: number | null
  effectiveCouplePrice: number | null
  effectiveSweetboxPrice: number | null
  effectiveDeluxePrice: number | null
  appliedRules: AppliedPricingRule[] | null
  availableSeats: number
  status: string
}

export interface AppliedPricingRule {
  code: string
  name: string
  discountPercent: number
}

/** Request giữ ghế khi đặt vé — voucher + redeem điểm tích đều optional. */
export interface HoldSeatsRequest {
  showtimeId: number
  seatIds: number[]
  voucherCode?: string
  /** Số điểm khách dùng đổi giảm giá — 0 hoặc bỏ qua = không dùng. */
  redeemPoints?: number
}

export interface HoldSeatsResponse {
  bookingId: number
  bookingCode: string
  holdExpiry: string
  totalAmount: number
  seats: BookingSeatInfo[]
}

export interface BookingSeatInfo {
  seatId: number
  seatNumber: string
  seatType: string
  price: number
  status: string
}

export interface BookingListItem {
  id: number
  storageState: string
  bookingCode: string
  status: string
  movieTitle: string
  moviePosterUrl: string | null
  startTime: string
  roomName: string
  totalAmount: number
  seatCount: number
  createdAt: string
}

export interface BookingDetail {
  id: number
  storageState: string
  bookingCode: string
  status: string
  movieTitle: string
  moviePosterUrl: string | null
  /** Phân loại độ tuổi — null nếu phim cũ chưa set. */
  movieAgeRating?: string | null
  showtimeId: number
  startTime: string
  endTime: string
  roomName: string
  roomType: string
  seats: BookingSeatInfo[]
  /** Giá vé niêm yết gốc (SUM seat prices) trước mọi giảm giá — dùng cho audit. */
  seatTotalAmount?: number
  /** Breakdown VAT (industry: subtotal + vat + total). VAT-inclusive — giá vé đã bao gồm VAT. */
  subtotalAmount?: number
  vatAmount?: number
  vatPercent?: number
  /** Tiền giảm theo hạng thành viên — null/0 cho counter-sale + STANDARD. */
  tierDiscountAmount?: number
  /** Hạng lúc đặt vé: STANDARD/SILVER/GOLD/PLATINUM — null cho counter-sale. */
  tierAtBooking?: string | null
  /** Tiền giảm group booking — 0/undefined nếu booking dưới ngưỡng. */
  groupDiscountAmount?: number
  /** Số điểm khách đã dùng đổi giảm giá — 0 nếu không dùng. */
  pointsRedeemed?: number
  /** Tiền giảm tương ứng số điểm đã đổi. */
  loyaltyDiscountAmount?: number
  totalAmount: number
  confirmedAt: string | null
  cancelledAt: string | null
  createdAt: string
}

export interface PaymentResponse {
  id: number
  bookingId: number
  bookingCode: string
  amount: number
  method: string
  transactionCode: string
  status: string
  paymentUrl: string | null
}

export interface TicketData {
  bookingCode: string
  movieTitle: string
  moviePosterUrl: string | null
  startTime: string
  endTime: string
  roomName: string
  roomType: string
  seats: BookingSeatInfo[]
  totalAmount: number
  paymentMethod: string | null
  qrCodeBase64: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  fullName: string | null
  phone: string | null
  /** Ngày sinh (YYYY-MM-DD) — null nếu user chưa khai. Phase 2 age-rating: nếu set, BE auto-block phim không đủ tuổi. */
  dateOfBirth: string | null
  avatarUrl: string | null
  role: string
  enabled: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string | null
}
