import { Link } from 'react-router-dom'
import { Clock, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MovieListItem } from '@/types/movie'
import { fmtRating, label, MOVIE_STATUS_LABELS } from '@/utils/labels'
import { cdnImage } from '@/utils/image'

interface MovieCardProps {
  movie: MovieListItem
}

const statusColor: Record<string, string> = {
  NOW_SHOWING: 'bg-green-500/10 text-green-400 border border-green-500/30',
  COMING_SOON: 'bg-[#ffc107]/10 text-[#ffc107] border border-[#ffc107]/30',
  ENDED: 'bg-gray-500/10 text-gray-400 border border-gray-500/30',
}

export default function MovieCard({ movie }: MovieCardProps) {
  // Lọc + giới hạn genres ở bước render để JSX gọn
  const visibleGenres = (movie.genres ?? [])
    .filter(g => g.storageState !== 'ARCHIVED')
    .slice(0, 3)

  return (
    <Link to={`/movies/${movie.id}`} className="group block h-full">
      {/* h-full + flex-col → mọi card cao bằng nhau bất kể nội dung */}
      <div className="bg-[#201b11] rounded-2xl overflow-hidden border border-[#3f382d] hover:border-[#ffc107]/50 transition-all flex flex-col h-full">
        {/* Poster — aspect cố định 2/3 */}
        <div className="relative aspect-[2/3] bg-[#2a2317] flex-shrink-0">
          {movie.posterUrl ? (
            <img
              src={cdnImage(movie.posterUrl, 400)}
              alt={movie.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              Chưa có ảnh
            </div>
          )}
          <Badge className={`absolute top-2 right-2 rounded-md ${statusColor[movie.status] || 'bg-gray-500/10 text-gray-400 border border-gray-500/30'}`}>
            {label(MOVIE_STATUS_LABELS, movie.status)}
          </Badge>
        </div>

        {/* Info — flex-1 chiếm phần còn lại; mỗi block có min-height cố định */}
        <div className="p-4 flex-1 flex flex-col gap-2">
          {/* Title: clamp 2 dòng + min-height cố định → mọi title chiếm cùng cao 2 dòng */}
          <h3 className="font-semibold text-sm text-amber-50 group-hover:text-[#ffc107] transition-colors line-clamp-2 min-h-[2.5rem] leading-tight">
            {movie.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {movie.duration} phút
            </span>
            <span className={`flex items-center gap-1 ${movie.rating ? 'text-[#ffc107]' : 'text-gray-600'}`}>
              <Star size={12} fill={movie.rating ? 'currentColor' : 'none'} />
              {fmtRating(movie.rating)}
            </span>
          </div>

          {/* Genres area — luôn có min-height = 1 dòng badge để phim không genre vẫn cùng chiều cao */}
          <div className="mt-auto flex flex-wrap gap-1 min-h-[20px]">
            {visibleGenres.map(g => (
              <span key={g.id} className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-gray-400">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
