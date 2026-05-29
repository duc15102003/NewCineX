import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import MainLayout from '@/components/layout/MainLayout'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))
const AdminGenrePage = lazy(() => import('@/features/admin/AdminGenrePage'))
const AdminShowtimePage = lazy(() => import('@/features/admin/AdminShowtimePage'))
const AdminRoomPage = lazy(() => import('@/features/admin/AdminRoomPage'))
const SeatMapEditorPage = lazy(() => import('@/features/admin/SeatMapEditorPage'))
const AdminUserPage = lazy(() => import('@/features/admin/AdminUserPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-[#051424] flex items-center justify-center text-white">Loading...</div>}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="/admin/movies" element={<AdminMoviePage />} />
            <Route path="/admin/genres" element={<AdminGenrePage />} />
            <Route path="/admin/showtimes" element={<AdminShowtimePage />} />
            <Route path="/admin/rooms" element={<AdminRoomPage />} />
            <Route path="/admin/rooms/:id/seats" element={<SeatMapEditorPage />} />
            <Route path="/admin/users" element={<AdminUserPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
