import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import StaffAllowedPathGuard from './StaffAllowedPathGuard'
import Loading from '@/components/common/Loading'
import { FEATURES } from '@/config/featureFlags'

// Lazy load — tách chunk theo route group
const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'))
const MovieListPage = lazy(() => import('@/features/movie/MovieListPage'))
const MovieDetailPage = lazy(() => import('@/features/movie/MovieDetailPage'))
const SeatSelectionPage = lazy(() => import('@/features/booking/SeatSelectionPage'))
const PaymentPage = lazy(() => import('@/features/booking/PaymentPage'))
const PaymentResultPage = lazy(() => import('@/features/booking/PaymentResultPage'))
const MockPaymentGateway = lazy(() => import('@/features/booking/MockPaymentGateway'))
const MyTicketsPage = lazy(() => import('@/features/booking/MyTicketsPage'))
const TicketDetailPage = lazy(() => import('@/features/booking/TicketDetailPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const FavoritesPage = lazy(() => import('@/features/favorite/FavoritesPage'))
const NotificationListPage = lazy(() => import('@/features/notification/NotificationListPage'))
const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage'))

// Admin — chunk riêng
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@/features/admin/DashboardPage'))
const AdminGenrePage = lazy(() => import('@/features/admin/AdminGenrePage'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))
const AdminRoomPage = lazy(() => import('@/features/admin/AdminRoomPage'))
const AdminTheaterPage = lazy(() => import('@/features/admin/AdminTheaterPage'))
const AdminPricingPage = lazy(() => import('@/features/admin/AdminPricingPage'))
const LoyaltyPage = lazy(() => import('@/features/loyalty/LoyaltyPage'))
const AdminComboPage = lazy(() => import('@/features/admin/AdminComboPage'))
const AdminShowtimePage = lazy(() => import('@/features/admin/AdminShowtimePage'))
const AdminUserPage = lazy(() => import('@/features/admin/AdminUserPage'))
const AdminBookingPage = lazy(() => import('@/features/admin/AdminBookingPage'))
const AdminPaymentPage = lazy(() => import('@/features/admin/AdminPaymentPage'))
const AdminSnackPage = lazy(() => import('@/features/admin/AdminSnackPage'))
const AdminVoucherPage = lazy(() => import('@/features/admin/AdminVoucherPage'))
const SeatMapEditorPage = lazy(() => import('@/features/admin/SeatMapEditorPage'))
const CheckInPage = lazy(() => import('@/features/admin/CheckInPage'))
const AdminConfigPage = lazy(() => import('@/features/admin/AdminConfigPage'))
const AdminReviewPage = lazy(() => import('@/features/admin/AdminReviewPage'))
const POSPage = lazy(() => import('@/features/admin/POSPage'))
const TicketPOSPage = lazy(() => import('@/features/admin/TicketPOSPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public routes with layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/movies" element={<MovieListPage />} />
            <Route path="/movies/:id" element={<MovieDetailPage />} />

            {/* Payment result — public vì redirect từ cổng thanh toán có thể mất session */}
            <Route path="/payment/result" element={<PaymentResultPage />} />

            {/* Protected routes (cần login) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/booking/seats/:showtimeId" element={<SeatSelectionPage />} />
              <Route path="/payment/:bookingId" element={<PaymentPage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-tickets/:id" element={<TicketDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              {FEATURES.favorites && <Route path="/favorites" element={<FavoritesPage />} />}
              {FEATURES.notifications && <Route path="/notifications" element={<NotificationListPage />} />}
              {FEATURES.loyaltyTier && <Route path="/loyalty" element={<LoyaltyPage />} />}
            </Route>

          </Route>

          {/* Admin routes — outside MainLayout, use AdminLayout */}
          {/* Routes wrap theo FEATURES.admin để khi user gõ URL trực tiếp các
              page bị ẩn → React Router không match → fallback NotFound. */}
          <Route element={<AdminRoute />}>
            <Route element={<StaffAllowedPathGuard />}>
              <Route element={<AdminLayout />}>
                {/* Khi dashboard ẨN: /admin redirect sang /admin/users (default landing
                    cho cinex-team — admin đăng nhập luôn vào trang quản lý người dùng). */}
                {FEATURES.admin.dashboard
                  ? <Route path="/admin" element={<DashboardPage />} />
                  : <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                }
                {FEATURES.admin.genres && <Route path="/admin/genres" element={<AdminGenrePage />} />}
                {FEATURES.admin.movies && <Route path="/admin/movies" element={<AdminMoviePage />} />}
                {FEATURES.admin.theaters && <Route path="/admin/theaters" element={<AdminTheaterPage />} />}
                {FEATURES.admin.rooms && <Route path="/admin/rooms" element={<AdminRoomPage />} />}
                {FEATURES.admin.rooms && <Route path="/admin/rooms/:roomId/seats" element={<SeatMapEditorPage />} />}
                {FEATURES.admin.showtimes && <Route path="/admin/showtimes" element={<AdminShowtimePage />} />}
                {FEATURES.admin.bookings && <Route path="/admin/bookings" element={<AdminBookingPage />} />}
                {FEATURES.admin.payments && <Route path="/admin/payments" element={<AdminPaymentPage />} />}
                {FEATURES.admin.snacks && <Route path="/admin/snacks" element={<AdminSnackPage />} />}
                {FEATURES.admin.combos && <Route path="/admin/combos" element={<AdminComboPage />} />}
                {FEATURES.admin.vouchers && <Route path="/admin/vouchers" element={<AdminVoucherPage />} />}
                {FEATURES.admin.users && <Route path="/admin/users" element={<AdminUserPage />} />}
                {FEATURES.admin.pos && <Route path="/admin/pos" element={<POSPage />} />}
                {FEATURES.admin.ticketPos && <Route path="/admin/ticket-pos" element={<TicketPOSPage />} />}
                {FEATURES.admin.checkIn && <Route path="/admin/check-in" element={<CheckInPage />} />}
                {FEATURES.admin.pricing && <Route path="/admin/pricing" element={<AdminPricingPage />} />}
                {FEATURES.admin.configs && <Route path="/admin/configs" element={<AdminConfigPage />} />}
                {FEATURES.admin.reviews && <Route path="/admin/reviews" element={<AdminReviewPage />} />}
              </Route>
            </Route>
          </Route>

          {/* Mock cổng thanh toán — trang riêng không có layout */}
          <Route path="/payment/gateway" element={<MockPaymentGateway />} />

          {/* 404 */}
          <Route element={<MainLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
