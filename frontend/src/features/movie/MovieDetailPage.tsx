import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import api from '@/api/axios'
import { Clock, Star, Calendar, Film, Heart } from 'lucide-react'
import ReviewSection from '@/components/movie/ReviewSection'
import { label, ROOM_TYPE_LABELS } from '@/utils/labels'
import { useIsFavorite, useAddFavorite, useRemoveFavorite } from '@/hooks/useFavorites'

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
import Loading from '@/components/common/Loading'
import { useAuthStore } from '@/store/authStore'
import LoginPromptModal from '@/components/common/LoginPromptModal'

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const movieId = Number(id)
  const { data: movie, isLoading } = useMovie(movieId)

  // Chọn ngày xem suất chiếu (mặc định hôm nay)
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)

  const { data: showtimes = [] } = useShowtimes(movieId, selectedDate)

  const { data: cutoffConfig } = useQuery({
    queryKey: ['config', 'cutoff-minutes'],
    queryFn: async () => {
      const res = await api.get('/api/configs/public/booking.cutoff_after_start_minutes')
      return res.data.data as string
    },
    staleTime: 5 * 60 * 1000,
  })
  const cutoffMinutes = Number(cutoffConfig ?? 15)

  const { isLoggedIn } = useAuthStore()
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const { data: isFavorite } = useIsFavorite(movieId)
  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()

  // Tạo 7 ngày tới để chọn
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
    return { day, month, weekday }
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN') + 'đ'
  }

  if (isLoading) return <Loading />
  if (!movie) return <div className="text-center py-20 text-gray-400">Phim không tồn tại</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Movie info — top section with backdrop blur effect */}
      <div className="relative rounded-2xl overflow-hidden mb-12">
        {/* Backdrop: blurred poster as background */}
        {movie.posterUrl && (
          <img
            src={movie.posterUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20 scale-110 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-[#0d2137]/80 pointer-events-none" />

        {/* Content over backdrop */}
        <div className="relative flex flex-col md:flex-row gap-8 p-8">
          {/* Poster */}
          <div className="w-full md:w-64 flex-shrink-0">
            {movie.posterUrl ? (
              <img src={movie.posterUrl} alt={movie.title} className="w-full rounded-xl shadow-2xl" />
            ) : (
              <div className="w-full aspect-[2/3] bg-[#0d2137] rounded-xl flex items-center justify-center text-gray-600">
                Chưa có ảnh
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-3">
              <h1 className="text-3xl font-bold">{movie.title}</h1>
              {isLoggedIn() && (
                <button
                  onClick={() => isFavorite ? removeFavorite.mutate(movieId) : addFavorite.mutate(movieId)}
                  className={`shrink-0 mt-1 p-2 rounded-full transition-all ${
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
                .filter((g: any) => g.storageState !== 'ARCHIVED')
                .map((g: any) => (
                  <Badge key={g.id} variant="secondary">{g.name}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
              <span className="flex items-center gap-1"><Clock size={14} /> {movie.duration} phút</span>
              <span className={`flex items-center gap-1 ${movie.rating ? 'text-[#eab308]' : 'text-gray-600'}`}>
                <Star size={14} fill={movie.rating ? 'currentColor' : 'none'} />
                {movie.rating ? `${movie.rating}/10` : 'Chưa có đánh giá'}
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
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-[#0a1929] text-gray-400 border-white/10 hover:border-white/20'
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
              <div key={st.id} className="bg-[#0a1929] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{formatTime(st.startTime)} - {formatTime(st.endTime)}</p>
                  <p className="text-sm text-gray-400">{st.roomName} ({label(ROOM_TYPE_LABELS, st.roomType)})</p>
                  <div className="text-xs mt-1 space-y-0.5">
                    <span className="text-gray-300">Thường: <span className="text-white font-medium">{formatPrice(st.basePrice)}</span></span>
                    {st.vipPrice && <span className="text-gray-300 ml-2">VIP: <span className="text-[#eab308] font-medium">{formatPrice(st.vipPrice)}</span></span>}
                    {st.couplePrice && <span className="text-gray-300 ml-2">Đôi: <span className="text-purple-400 font-medium">{formatPrice(st.couplePrice)}</span></span>}
                  </div>
                </div>
                {isLoggedIn() ? (
                  <Link to={`/booking/seats/${st.id}`}>
                    <Button size="sm" className="bg-[#eab308] hover:bg-[#ca8a04] text-black">
                      Đặt vé
                    </Button>
                  </Link>
                ) : (
                  <Button size="sm" className="bg-[#eab308] hover:bg-[#ca8a04] text-black"
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
