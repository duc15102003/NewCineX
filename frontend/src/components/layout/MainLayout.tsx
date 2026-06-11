import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import TheaterPickerModal from '@/components/theater/TheaterPickerModal'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#181309] text-white">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {/* First-time picker: render trong MainLayout — block user-facing pages cho đến khi chọn */}
      <TheaterPickerModal />
    </div>
  )
}
