import MovieCard from './MovieCard'
import EmptyState from '@/components/common/EmptyState'
import type { MovieListItem } from '@/types/movie'

interface MovieGridProps {
  movies: MovieListItem[]
  emptyMessage?: string
}

export default function MovieGrid({ movies, emptyMessage }: MovieGridProps) {
  if (movies.length === 0) {
    return <EmptyState message={emptyMessage || 'Không có phim nào'} />
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  )
}
