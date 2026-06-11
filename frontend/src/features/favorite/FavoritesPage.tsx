import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Loading from '@/components/common/Loading'
import EmptyState from '@/components/common/EmptyState'
import { Link } from 'react-router-dom'
import { useFavorites, useRemoveFavorite } from '@/hooks/useFavorites'
import { fmtRating } from '@/utils/labels'
import { cdnImage } from '@/utils/image'

export default function FavoritesPage() {
  const { data, isLoading } = useFavorites()
  const removeMut = useRemoveFavorite()

  if (isLoading) return <Loading />

  const movies = data?.content ?? []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Phim yêu thích</h1>

      {movies.length === 0 ? (
        <EmptyState
          icon={Heart}
          message="Bạn chưa thích phim nào"
          description="Bấm icon trái tim trên trang chi tiết để lưu phim yêu thích vào đây."
          cta={{ label: 'Khám phá phim', to: '/movies' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {movies.map((m) => (
            <div key={m.movieId} className="bg-[#201b11] rounded-2xl overflow-hidden border border-white/5 group relative">
              <Link to={`/movies/${m.movieId}`}>
                <div className="aspect-[2/3] bg-[#2a2317]">
                  {m.posterUrl ? (
                    <img
                      src={cdnImage(m.posterUrl, 400)}
                      alt={m.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">Chưa có ảnh</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm truncate group-hover:text-[#ffc107] transition-colors">{m.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{m.duration} phút • ⭐ {fmtRating(m.rating)}</p>
                </div>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMut.mutate(m.movieId)}
                className="absolute top-2 right-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                title="Bỏ yêu thích"
              >
                <Heart size={16} fill="currentColor" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
