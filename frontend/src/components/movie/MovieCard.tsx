import { Link } from 'react-router-dom'
import { Clock, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MovieListItem } from '@/types/movie'
import { label, MOVIE_STATUS_LABELS } from '@/utils/labels'

interface MovieCardProps {
  movie: MovieListItem
}

const statusColor: Record<string, string> = {
  NOW_SHOWING: 'bg-green-600',
  COMING_SOON: 'bg-[#ca8a04]',
  ENDED: 'bg-gray-600',
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link to={`/movies/${movie.id}`} className="group">
      <div className="bg-[#0a1929] rounded-xl overflow-hidden border border-white/5 hover:border-[#eab308]/50 transition-all">
        {/* Poster */}
        <div className="relative aspect-[2/3] bg-[#0d2137]">
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              Chưa có ảnh
            </div>
          )}
          <Badge className={`absolute top-2 right-2 ${statusColor[movie.status] || 'bg-gray-600'}`}>
            {label(MOVIE_STATUS_LABELS, movie.status)}
          </Badge>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-sm truncate group-hover:text-[#eab308] transition-colors">
            {movie.title}
          </h3>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {movie.duration} phút
            </span>
            <span className={`flex items-center gap-1 ${movie.rating ? 'text-[#eab308]' : 'text-gray-600'}`}>
              <Star size={12} fill={movie.rating ? 'currentColor' : 'none'} />
              {movie.rating ?? '—'}
            </span>
          </div>

          {movie.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {movie.genres
                .filter((g: any) => g.storageState !== 'ARCHIVED')
                .slice(0, 3)
                .map((g: any) => (
                  <span key={g.id ?? g} className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-gray-400">
                    {g.name ?? g}
                  </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
