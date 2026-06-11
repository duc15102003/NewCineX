import { Link } from 'react-router-dom'
import { Monitor, Sparkles, Gem, Film, Armchair, TicketCheck } from 'lucide-react'
import { useMovies } from '@/hooks/useMovies'
import MovieGrid from '@/components/movie/MovieGrid'
import { MovieGridSkeleton } from '@/components/common/Skeleton'
import { cdnImage } from '@/utils/image'
import { useAuthStore } from '@/store/authStore'
import { useTheaterStore } from '@/store/theaterStore'

export default function HomePage() {
  // Theater context F1: cả "Đang chiếu" và "Sắp chiếu" đều lọc theo chi nhánh user đã chọn.
  // - "Đang chiếu" = phim có showtime endTime >= now tại CN đó
  // - "Sắp chiếu" = phim COMING_SOON đã có MovieRun upcoming tại CN đó (chuẩn CGV/Lotte)
  // Chi nhánh chưa có đợt chiếu nào → "Sắp chiếu" rỗng → đúng kỳ vọng user.
  const { currentTheater } = useTheaterStore()
  const { data: nowShowing, isLoading: loadingNow } = useMovies({
    showing: true, theaterId: currentTheater?.id, size: 10,
  })
  const { data: comingSoon, isLoading: loadingComing } = useMovies({
    status: 'COMING_SOON', theaterId: currentTheater?.id, size: 10,
  })
  const { isLoggedIn } = useAuthStore()

  return (
    <div>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-8 py-24 bg-gradient-to-b from-[#201b11] to-[#181309] overflow-hidden">
        {/* Background poster from first movie */}
        {nowShowing?.content?.[0]?.posterUrl && (
          <div className="absolute inset-0">
            <img
              src={cdnImage(nowShowing.content[0].posterUrl, 1200)}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-10 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#181309]/60 via-[#181309]/80 to-[#181309]" />
          </div>
        )}
        {/* Decorative gold glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-[#ffc107]/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-5xl font-bold mb-6 text-center text-amber-50 leading-tight">
            Đặt vé xem phim{' '}
            <span className="text-[#ffc107]">trực tuyến</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 text-center max-w-2xl">
            Hệ thống đặt vé xem phim online tiện lợi. Chọn phim, chọn suất, chọn
            ghế và thanh toán chỉ trong vài bước.
          </p>
          <Link
            to="/movies"
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold px-10 py-3 rounded-lg transition-colors shadow-lg shadow-[#ffc107]/20"
          >
            Khám phá ngay
          </Link>
        </div>
      </section>

      {/* Member Benefits Banner — guests only */}
      {/* {!isLoggedIn() && (
        <section className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-gradient-to-r from-[#ffc107]/10 to-[#201b11] border border-[#ffc107]/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ffc107]/20 flex items-center justify-center shrink-0">
                <Crown size={24} className="text-[#ffc107]" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Đặc quyền thành viên CineX</h3>
                <p className="text-gray-400 text-sm mt-0.5">Đăng ký để nhận ưu đãi 10% vé xem phim và tích điểm đổi bắp nước miễn phí.</p>
              </div>
            </div>
            <Link to="/register"
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap">
              Tham gia ngay
            </Link>
          </div>
        </section>
      )} */}

      {/* Đang chiếu */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="w-10 h-1 bg-[#ffc107] rounded-full mb-3" />
            <h2 className="text-2xl font-bold text-white">Đang chiếu</h2>
          </div>
          <Link to="/movies" className="text-[#ffc107] text-sm hover:underline">
            Xem tất cả →
          </Link>
        </div>
        {loadingNow ? (
          <MovieGridSkeleton count={10} />
        ) : (
          <MovieGrid movies={nowShowing?.content || []} emptyMessage="Chưa có phim đang chiếu" />
        )}
      </section>

      {/* Sắp chiếu */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="w-10 h-1 bg-[#ffc107] rounded-full mb-3" />
            <h2 className="text-2xl font-bold text-white">Sắp chiếu</h2>
          </div>
          <Link to="/movies?status=coming_soon" className="text-[#ffc107] text-sm hover:underline">
            Xem tất cả →
          </Link>
        </div>
        {loadingComing ? (
          <MovieGridSkeleton count={10} />
        ) : (
          <MovieGrid movies={comingSoon?.content || []} emptyMessage="Chưa có phim sắp chiếu" />
        )}
      </section>
      {/* Quy trình đặt vé */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="w-10 h-1 bg-[#ffc107] rounded-full mb-3 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Đặt vé chỉ 3 bước</h2>
          <p className="text-gray-400 text-sm mt-2">Nhanh chóng, tiện lợi, không cần xếp hàng</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '01', icon: Film, title: 'Chọn phim & suất chiếu', desc: 'Duyệt danh sách phim, chọn ngày giờ và phòng chiếu phù hợp.' },
            { step: '02', icon: Armchair, title: 'Chọn ghế yêu thích', desc: 'Xem sơ đồ ghế trực quan, chọn vị trí Standard, VIP hoặc Sweetbox.' },
            { step: '03', icon: TicketCheck, title: 'Thanh toán & nhận vé', desc: 'Thanh toán online an toàn, nhận vé điện tử với mã QR ngay lập tức.' },
          ].map(item => (
            <div key={item.step} className="relative bg-[#201b11] border border-white/5 rounded-2xl p-6 text-center group hover:border-[#ffc107]/30 transition-colors">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#ffc107] text-black text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center">
                {item.step}
              </span>
              <div className="w-12 h-12 rounded-full bg-[#ffc107]/10 flex items-center justify-center mx-auto mt-2 mb-4">
                <item.icon size={24} className="text-[#ffc107]" />
              </div>
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      {/* Cinema Experience Banner — guests only */}
      {!isLoggedIn() && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-6">
            <div className="w-10 h-1 bg-[#ffc107] rounded-full mb-3" />
            <h2 className="text-2xl font-bold text-white">Trải nghiệm điện ảnh đỉnh cao</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'Monitor', title: 'IMAX', desc: 'Màn hình khổng lồ, âm thanh vòm 360° cho trải nghiệm chân thực nhất.' },
              { icon: 'Sparkles', title: '4DX', desc: 'Ghế chuyển động, hiệu ứng gió, nước, mùi hương sống động.' },
              { icon: 'Gem', title: 'Gold Class', desc: 'Ghế da cao cấp, phục vụ đồ ăn tại chỗ, không gian riêng tư.' },
            ].map(item => (
              <div key={item.title} className="bg-[#201b11] border border-white/5 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-[#ffc107]/10 flex items-center justify-center mx-auto mb-4">
                  {item.icon === 'Monitor' && <Monitor size={24} className="text-[#ffc107]" />}
                  {item.icon === 'Sparkles' && <Sparkles size={24} className="text-[#ffc107]" />}
                  {item.icon === 'Gem' && <Gem size={24} className="text-[#ffc107]" />}
                </div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
