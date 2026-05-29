import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import Loading from '@/components/common/Loading'

// Lazy load — tách chunk theo route group
const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
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
const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage'))

// Admin — chunk riêng
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@/features/admin/DashboardPage'))
const AdminGenrePage = lazy(() => import('@/features/admin/AdminGenrePage'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))
const AdminRoomPage = lazy(() => import('@/features/admin/AdminRoomPage'))
const AdminShowtimePage = lazy(() => import('@/features/admin/AdminShowtimePage'))
const AdminUserPage = lazy(() => import('@/features/admin/AdminUserPage'))
const AdminBookingPage = lazy(() => import('@/features/admin/AdminBookingPage'))
const AdminSnackPage = lazy(() => import('@/features/admin/AdminSnackPage'))
const AdminVoucherPage = lazy(() => import('@/features/admin/AdminVoucherPage'))
const SeatMapEditorPage = lazy(() => import('@/features/admin/SeatMapEditorPage'))
const CheckInPage = lazy(() => import('@/features/admin/CheckInPage'))
const AdminConfigPage = lazy(() => import('@/features/admin/AdminConfigPage'))
const POSPage = lazy(() => import('@/features/admin/POSPage'))
const TicketPOSPage = lazy(() => import('@/features/admin/TicketPOSPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public routes with layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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
              <Route path="/favorites" element={<FavoritesPage />} />
            </Route>

          </Route>

          {/* Admin routes — outside MainLayout, use AdminLayout */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              {/* <Route path="/admin" element={<DashboardPage />} /> */}{/* Dashboard — Đức */}
              <Route path="/admin" element={<AdminMoviePage />} />{/* Mặc định vào quản lý phim */}
              <Route path="/admin/genres" element={<AdminGenrePage />} />
              <Route path="/admin/movies" element={<AdminMoviePage />} />
              <Route path="/admin/rooms" element={<AdminRoomPage />} />
              <Route path="/admin/rooms/:roomId/seats" element={<SeatMapEditorPage />} />
              <Route path="/admin/showtimes" element={<AdminShowtimePage />} />
              <Route path="/admin/bookings" element={<AdminBookingPage />} />
              <Route path="/admin/snacks" element={<AdminSnackPage />} />
              <Route path="/admin/vouchers" element={<AdminVoucherPage />} />
              <Route path="/admin/users" element={<AdminUserPage />} />
              <Route path="/admin/pos" element={<POSPage />} />
              <Route path="/admin/ticket-pos" element={<TicketPOSPage />} />
              <Route path="/admin/check-in" element={<CheckInPage />} />
              <Route path="/admin/configs" element={<AdminConfigPage />} />
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
