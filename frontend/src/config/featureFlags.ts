/**
 * Feature flags — kiểm soát hiển thị UI cho phiên bản cinex-team.
 *
 * <p>cinex-team là phiên bản RÚT GỌN của cinex để team demo: chỉ giữ luồng
 * cốt lõi (xem phim → đặt vé), ẩn các module mở rộng (voucher, loyalty,
 * VAT, multi-theater, ...). Code logic của những module này vẫn còn trong
 * codebase — chỉ ẨN UI để tránh user confusion khi demo.
 *
 * <p><b>Quy tắc dùng:</b>
 * <ul>
 *   <li>Conditional render component: {@code {FEATURES.voucher && <VoucherSection />}}</li>
 *   <li>Filter menu items: {@code NAV_ITEMS.filter(item => FEATURES.admin[item.key])}</li>
 *   <li>KHÔNG xóa code module bị ẩn — chỉ wrap render bằng flag</li>
 * </ul>
 *
 * <p><b>Khi nào bật lại?</b> Đổi flag → tất cả UI tương ứng hiện lại,
 * không cần sửa code business logic. Tích hợp full lại cinex thì set tất cả = true.
 */

export const FEATURES = {
  // ───── Customer-facing (luồng đặt vé) ─────────────────────────
  /** Cho phép chọn chi nhánh. false → mặc định 1 chi nhánh, ẩn switcher. */
  multiTheater: false,

  /** Voucher / khuyến mãi: input code + list voucher available trong booking summary. */
  voucher: false,

  /** Loyalty redeem: input đổi điểm trong booking summary. */
  loyaltyRedeem: false,

  /** Loyalty tier + page /loyalty + LoyaltyCard trong /profile + tier discount row. */
  loyaltyTier: false,

  /** Hiển thị VAT row trong breakdown thanh toán + ticket detail. */
  vatDisplay: false,

  /** Giảm giá theo nhóm (≥ N vé) — hint + row breakdown. */
  groupDiscount: false,

  /** Applied pricing rules chips trên showtime card + movie detail. */
  pricingRules: false,

  /** Nút "Tạo hàng loạt suất chiếu" (AutoSchedule) trong /admin/showtimes. */
  autoSchedule: false,

  /** Phim yêu thích — Heart button trên movie detail + page /favorites + link header. */
  favorites: false,

  /** Icon chuông thông báo header + page /notifications. */
  notifications: false,

  /** ReviewSection (rating + comment) trên MovieDetail page. */
  reviews: false,

  // ───── Admin sidebar (NAV_ITEMS keys) ─────────────────────────
  /** BRANCH_ADMIN cinex.hn chỉ thấy 5 mục cốt lõi: thể loại, phim, phòng, suất, user.
   *  Bật lại các mục bị ẩn → đổi flag tương ứng = true. */
  admin: {
    dashboard: false,    // Tổng quan — ẨN. Khi /admin truy cập → redirect /admin/users
    genres: true,        // Thể loại
    movies: true,        // Phim
    rooms: true,         // Phòng chiếu
    showtimes: true,     // Suất chiếu
    users: true,         // Người dùng (default landing page khi không có dashboard)

    // Các page ẩn cho cinex-team
    theaters: false,     // Chi nhánh (SUPER_ADMIN — đơn rạp không cần)
    bookings: false,     // Đặt vé (audit booking)
    payments: false,     // Giao dịch
    snacks: false,       // Đồ ăn
    combos: false,       // Combo
    vouchers: false,     // Khuyến mãi
    reviews: false,      // Đánh giá
    pricing: false,      // Quy tắc giá
    configs: false,      // Cấu hình hệ thống
    pos: false,          // POS đồ ăn
    ticketPos: false,    // POS bán vé
    checkIn: false,      // Quét vé
  },
} as const

/**
 * Khi {@link FEATURES.multiTheater} = false → app auto-pick chi nhánh có city
 * khớp giá trị này. Hà Nội là chi nhánh mặc định của cinex-team demo.
 *
 * <p>Nếu seed data không có chi nhánh nào ở Hà Nội → fallback chi nhánh đầu tiên.
 */
export const DEFAULT_THEATER_CITY = 'Hà Nội'
