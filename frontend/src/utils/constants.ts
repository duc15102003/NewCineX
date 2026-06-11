// Centralized constants — magic numbers/strings ở 1 nơi, dễ maintain
// Tránh hardcode `size: 50` rải rác trong page admin.

/** Page size mặc định cho table admin (list endpoint phân trang). */
export const ADMIN_LIST_PAGE_SIZE = 50

/** Page size cho dropdown options (snack, theater,... trong form). */
export const OPTIONS_DROPDOWN_PAGE_SIZE = 100

/** Page size cho voucher khả dụng ở booking checkout (UI hiển thị paged). */
export const VOUCHER_AVAILABLE_PAGE_SIZE = 10

/** Debounce cho search input (ms). */
export const SEARCH_DEBOUNCE_MS = 300

/** Default booking hold time (FE preview — BE đọc từ SystemConfig). */
export const DEFAULT_BOOKING_HOLD_MINUTES = 10
