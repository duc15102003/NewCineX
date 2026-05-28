import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-7xl font-bold text-[#eab308] mb-4">404</h1>
      <p className="text-xl text-gray-300 mb-2">Trang không tồn tại</p>
      <p className="text-gray-500 mb-8">Đường dẫn bạn truy cập không đúng hoặc đã bị xóa.</p>
      <Link to="/">
        <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
          Về trang chủ
        </Button>
      </Link>
    </div>
  )
}
