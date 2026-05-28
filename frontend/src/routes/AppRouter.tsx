import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import MainLayout from '@/components/layout/MainLayout'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const AdminRoomPage = lazy(() => import('@/features/admin/AdminRoomPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-[#051424] flex items-center justify-center text-white">Loading...</div>}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="/admin/rooms" element={<AdminRoomPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
