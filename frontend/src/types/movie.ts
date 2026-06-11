/** Genre object trả về từ BE — có id + storageState để FE hiển thị badge "đã lưu trữ" + filter. */
export interface GenreResponse {
  id: number
  storageState: string
  name: string
  description: string | null
}

export interface MovieListItem {
  id: number
  storageState: string
  title: string
  posterUrl: string | null
  duration: number
  rating: number | null
  /** Đạo diễn — hiển thị trên list để admin scan, lọc nhanh. */
  director: string | null
  /** Phân loại tuổi P/K/T13/T16/T18 — badge nhỏ. */
  ageRating: string | null
  /** Ngôn ngữ — VD "Tiếng Anh - Phụ đề Việt". */
  language: string | null
  status: string
  /** Trước đây sai type string[]; thực ra BE trả Set<GenreResponse>. */
  genres: GenreResponse[]
  createdAt: string
  updatedAt: string
}

/**
 * Phân loại tuổi (TT 25/2024/BVHTTDL). KHÔNG có 'C' vì C = "Cấm phổ biến"
 * = phim bị cấm phát hành công khai, không lên rạp được — không có chỗ
 * trong booking system. Xem AgeRating.java BE để hiểu chi tiết.
 */
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18'

export interface MovieDetail {
  id: number
  storageState: string
  title: string
  description: string | null
  duration: number
  releaseDate: string | null
  endDate: string | null
  posterUrl: string | null
  trailerUrl: string | null
  director: string | null
  cast: string | null
  language: string | null
  rating: number | null
  status: string
  /** Phân loại tuổi (TT 25/2024/BVHTTDL): P / K / T13 / T16 / T18 / C. */
  ageRating?: AgeRating
  genres: GenreResponse[]
  createdAt: string
  updatedAt: string
}

export interface Genre {
  id: number
  name: string
  description: string | null
}

/** Một pricing rule đang áp dụng — BE expose qua ShowtimeResponse.appliedRules. */
export interface AppliedPricingRule {
  code: string
  name: string
  /** Phần trăm so với giá gốc: âm = giảm (-20), dương = tăng (+30). FE đọc dấu để chọn màu badge. */
  discountPercent: number
}

export interface ShowtimeItem {
  id: number
  movieTitle: string
  moviePosterUrl: string | null
  roomName: string
  roomType: string
  startTime: string
  endTime: string
  /** Giá GỐC từ DB — hiển thị gạch ngang nếu khác effective. */
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  sweetboxPrice: number | null
  deluxePrice: number | null
  /** Giá CUỐI (sau PricingEngine) — đây là giá thực sự thu, dùng cho tính tiền và hiển thị chính. */
  effectiveBasePrice?: number
  effectiveVipPrice?: number | null
  effectiveCouplePrice?: number | null
  effectiveSweetboxPrice?: number | null
  effectiveDeluxePrice?: number | null
  appliedRules?: AppliedPricingRule[]
  status: string
  /** Sau refactor MovieRun: showtime thuộc 1 đợt chiếu cụ thể. */
  movieRunId?: number | null
  runType?: MovieRunType | null
  runStartDate?: string | null
  runEndDate?: string | null
  createdAt: string
  updatedAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

/**
 * Filter movie cho cả admin và user-facing list.
 * Map 1-1 với BE MovieFilter.java
 * - Số dùng `number` (FE), BE bind sang BigDecimal/Integer/LocalDate
 * - Ngày dùng string YYYY-MM-DD (input type="date")
 */
export interface MovieFilter {
  keyword?: string
  status?: 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED'
  genreId?: number
  /** Filter theo chi nhánh (F1) — chỉ phim có showtime tại chi nhánh này. */
  theaterId?: number
  director?: string
  cast?: string
  language?: string
  minDuration?: number
  maxDuration?: number
  minRating?: number
  maxRating?: number
  releaseDateFrom?: string
  releaseDateTo?: string
  hasActiveShowtimes?: boolean
  showing?: boolean
  page?: number
  size?: number
  sort?: string // VD: "rating,desc"
}

/**
 * AdminMovieFilter = MovieFilter + flag includeDeleted để xem cả phim đã lưu trữ.
 */
export interface AdminMovieFilter extends MovieFilter {
  includeDeleted?: boolean
}

// ============================================================
// MovieRun — đợt chiếu của 1 phim
// 1 movie có nhiều run (FIRST_RUN, REISSUE, FESTIVAL, ...)
// ============================================================

export type MovieRunStatus = 'SCHEDULED' | 'NOW_SHOWING' | 'ENDED'
export type MovieRunType = 'FIRST_RUN' | 'REISSUE' | 'FESTIVAL' | 'SPECIAL'

export interface MovieRun {
  id: number
  movieId: number
  movieTitle: string
  moviePosterUrl: string | null
  /** Chi nhánh sở hữu đợt chiếu — mỗi rạp 1 run riêng cho cùng phim. */
  theaterId: number
  theaterName: string | null
  theaterCity: string | null
  startDate: string // YYYY-MM-DD
  /** null = open-ended (chưa quyết ngày ngưng chiếu). Hiển thị "—" hoặc "Đang chiếu mở". */
  endDate: string | null
  runType: MovieRunType
  status: MovieRunStatus
  notes: string | null
  storageState: string
  createdAt: string
}

export interface MovieRunRequest {
  movieId: number
  /** Chi nhánh áp dụng. Branch ADMIN: BE override từ JWT. */
  theaterId: number
  startDate: string
  /** Optional — bỏ trống nếu chưa quyết ngày ngưng. */
  endDate?: string | null
  runType: MovieRunType
  notes?: string
}
