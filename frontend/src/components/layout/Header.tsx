import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="bg-[#0a1929] border-b border-white/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-[#eab308]">CineX</Link>
        <Link to="/login" className="text-sm text-gray-300 hover:text-white">Đăng nhập</Link>
      </div>
    </header>
  )
}
