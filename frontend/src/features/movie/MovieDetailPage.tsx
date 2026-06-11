import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Clock, Star, Calendar, Film, Heart } from 'lucide-react'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import ReviewSection from '@/components/movie/ReviewSection'
import { fmtRating, label, ROOM_TYPE_LABELS, toLocalDateString, AGE_RATING_SHORT, AGE_RATING_DESC, AGE_RATING_LABELS, fmtTime } from '@/utils/labels'
import PriceWithRules from '@/components/common/PriceWithRules'
import { cdnImage } from '@/utils/image'
import { AGE_RATING_COLORS } from '@/utils/colors'
import { useIsFavorite, useAddFavorite, useRemoveFavorite } from '@/hooks/useFavorites'
import { useTheaterStore } from '@/store/theaterStore'

function getYouTubeEmbedUrl(url: string): string {
  try {
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${id}`
    }
    if (url.includes('watch?v=')) {
      const id = new URL(url).searchParams.get('v')
      return `https://www.youtube.com/embed/${id}`
    }
    return url // Already embed or unknown format
  } catch { return url }
}
import { useMovie, useShowtimes } from '@/hooks/useMovies'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MovieDetailSkeleton } from '@/components/common/Skeleton'
import { useAuthStore } from '@/store/authStore'
import LoginPromptModal from '@/components/common/LoginPromptModal'

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const movieId = Number(id)
  const { data: movie, isLoading } = useMovie(movieId)

  // Chọn ngày xem suất chiếu (mặc định hôm nay). Dùng local timezone tránh shift múi giờ.
  const today = toLocalDateString(new Date())
  const [selectedDate, setSelectedDate] = useState(today)

  // Filter showtime theo chi nhánh user đã chọn (F1).
  const { currentTheater } = useTheaterStore()
  const { data: showtimes = [] } = useShowtimes(movieId, selectedDate, currentTheater?.id)

  const { data: cutoffMinutes = 15 } = usePublicConfigNumber('booking.cutoff_after_start_minutes', 15)

  const { isLoggedIn } = useAuthStore()
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const { data: isFavorite } = useIsFavorite(movieId)
  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()

  // Tạo 7 ngày tới để chọn (local timezone)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return toLocalDateString(d)
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
    return { day, month, weekday }
  }

  if (isLoading) return <MovieDetailSkeleton />
  if (!movie) return <div className="text-center py-20 text-gray-400">Phim không tồn tại</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Movie info — top section with backdrop blur effect */}
      <div className="relative rounded-2xl overflow-hidden mb-12">
        {/* Backdrop: blurred poster as background */}
        {movie.posterUrl && (
          <img
            src={cdnImage(movie.posterUrl, 600)}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20 scale-110 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-[#2a2317]/80 pointer-events-none" />

        {/* Content over backdrop */}
        <div className="relative flex flex-col md:flex-row gap-8 p-8">
          {/* Poster */}
          <div className="w-full md:w-64 flex-shrink-0">
            {movie.posterUrl ? (
              // Poster chính hiển thị above-the-fold → eager + high priority (LCP candidate)
              <img
                src={cdnImage(movie.posterUrl, 500)}
                alt={movie.title}
                fetchPriority="high"
                className="w-full rounded-xl shadow-2xl"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-[#2a2317] rounded-xl flex items-center justify-center text-gray-600">
                Chưa có ảnh
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-3xl font-bold text-amber-50 leading-tight">{movie.title}</h1>
              {/* Age rating badge — chuẩn TT 25/2024/BVHTTDL. Hiển thị nhãn đầy đủ
                  (vd "P · Mọi đối tượng") để user không phải đoán "P là gì". */}
              {movie.ageRating && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${AGE_RATING_COLORS[movie.ageRating] ?? ''}`}
                  title={label(AGE_RATING_LABELS, movie.ageRating)}
                >
                  {AGE_RATING_SHORT[movie.ageRating] ?? movie.ageRating} · {AGE_RATING_DESC[movie.ageRating] ?? ''}
                </span>
              )}
              {isLoggedIn() && (
                <button
                  onClick={() => isFavorite ? removeFavorite.mutate(movieId) : addFavorite.mutate(movieId)}
                  className={`shrink-0 p-2 rounded-full transition-all ${
                    isFavorite
                      ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                      : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                  title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {movie.genres
                .filter(g => g.storageState !== 'ARCHIVED')
                .map(g => (
                  <Badge key={g.id} variant="secondary">{g.name}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
              <span className="flex items-center gap-1"><Clock size={14} /> {movie.duration} phút</span>
              <span className={`flex items-center gap-1 ${movie.rating ? 'text-[#ffc107]' : 'text-gray-600'}`}>
                <Star size={14} fill={movie.rating ? 'currentColor' : 'none'} />
                {`${fmtRating(movie.rating)}/10`}
              </span>
              {movie.language && <span className="flex items-center gap-1"><Film size={14} /> {movie.language}</span>}
              {movie.releaseDate && (
                <span className="flex items-center gap-1"><Calendar size={14} /> {movie.releaseDate}</span>
              )}
              {movie.endDate && (
                <span className="flex items-center gap-1"><Calendar size={14} /> Đến {movie.endDate}</span>
              )}
            </div>

            {movie.director && <p className="text-sm text-gray-400 mb-1"><strong className="text-gray-300">Đạo diễn:</strong> {movie.director}</p>}
            {movie.cast && <p className="text-sm text-gray-400 mb-4"><strong className="text-gray-300">Diễn viên:</strong> {movie.cast}</p>}
            {movie.description && <p className="text-gray-300 leading-relaxed">{movie.description}</p>}

            {/* Trailer */}
            {movie.trailerUrl && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Trailer</h3>
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={getYouTubeEmbedUrl(movie.trailerUrl)}
                    className="w-full h-full"
                    allowFullScreen
                    title="Trailer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Showtimes */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Suất chiếu</h2>

        {/* Date selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {dates.map((dateStr) => {
            const { day, month, weekday } = formatDate(dateStr)
            const isSelected = selectedDate === dateStr
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex flex-col items-center min-w-[60px] px-3 py-2 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[#ffc107] text-black border-[#ffc107]'
                    : 'bg-[#201b11] text-gray-400 border-white/10 hover:border-white/20'
                }`}
              >
                <span className="text-xs">{weekday}</span>
                <span className="text-lg font-bold">{day}</span>
                <span className="text-xs">{month}</span>
              </button>
            )
          })}
        </div>

        {/* Showtime list — chỉ hiện suất chưa bắt đầu */}
        {(() => {
          const cutoff = new Date(Date.now() - cutoffMinutes * 60 * 1000)
          const futureShowtimes = showtimes.filter(st => new Date(st.startTime) > cutoff)
          return futureShowtimes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Không có suất chiếu cho ngày này</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {futureShowtimes.map((st) => (
              <div key={st.id} className="bg-[#201b11] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{fmtTime(st.startTime)} - {fmtTime(st.endTime)}</p>
                  <p className="text-sm text-gray-400">{st.roomName} ({label(ROOM_TYPE_LABELS, st.roomType)})</p>
                  <div className="text-xs mt-1 space-x-3">
                    <PriceWithRules
                      label="Thường:"
                      basePrice={st.basePrice}
                      effectivePrice={st.effectiveBasePrice ?? st.basePrice}
                      priceColorClass="text-white"
                    />
                    {st.vipPrice != null && (
                      <PriceWithRules
                        label="VIP:"
                        basePrice={st.vipPrice}
                        effectivePrice={st.effectiveVipPrice ?? st.vipPrice}
                      />
                    )}
                    {st.couplePrice != null && (
                      <PriceWithRules
                        label="Đôi:"
                        basePrice={st.couplePrice}
                        effectivePrice={st.effectiveCouplePrice ?? st.couplePrice}
                        priceColorClass="text-purple-400"
                      />
                    )}
                    {st.sweetboxPrice != null && (
                      <PriceWithRules
                        label="Sweetbox:"
                        basePrice={st.sweetboxPrice}
                        effectivePrice={st.effectiveSweetboxPrice ?? st.sweetboxPrice}
                        priceColorClass="text-pink-400"
                      />
                    )}
                    {st.deluxePrice != null && (
                      <PriceWithRules
                        label="Deluxe:"
                        basePrice={st.deluxePrice}
                        effectivePrice={st.effectiveDeluxePrice ?? st.deluxePrice}
                        priceColorClass="text-cyan-400"
                      />
                    )}
                  </div>
                  {/* Chỉ hiện chip giảm giá (chuẩn rạp VN: ẩn surge để giữ tâm lý mua hàng) */}
                  {st.appliedRules && st.appliedRules.some(r => r.discountPercent < 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {st.appliedRules.filter(r => r.discountPercent < 0).map(r => (
                        <span
                          key={r.code}
                          className="text-[10px] px-1.5 py-0.5 rounded-md border bg-green-500/10 text-green-400 border-green-500/30"
                          title={r.name}
                        >
                          {r.name} {r.discountPercent}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isLoggedIn() ? (
                  <Link to={`/booking/seats/${st.id}`}>
                    <Button size="sm" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black">
                      Đặt vé
                    </Button>
                  </Link>
                ) : (
                  <Button size="sm" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black"
                    onClick={() => setLoginModalOpen(true)}>
                    Đặt vé
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
        })()}
      </div>
      {/* Reviews */}
      <div className="mt-12">
        <ReviewSection movieId={movieId} />
      </div>

      <LoginPromptModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  )
}
