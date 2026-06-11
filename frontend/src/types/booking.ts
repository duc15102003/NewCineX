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

export interface HoldSeatsRequest {
  showtimeId: number
  seatIds: number[]
  voucherCode?: string
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
