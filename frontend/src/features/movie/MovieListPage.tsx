import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMovies, useGenres } from '@/hooks/useMovies'
import MovieGrid from '@/components/movie/MovieGrid'
import SearchBar from '@/components/movie/SearchBar'
import GenreFilter from '@/components/movie/GenreFilter'
import Loading from '@/components/common/Loading'
import { Button } from '@/components/ui/button'

const STATUS_TABS = [
  { value: 'showing', label: 'Đang chiếu' },
  { value: 'coming_soon', label: 'Sắp chiếu' },
]

export default function MovieListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('status') || 'showing'

  const [tab, setTab] = useState(initialTab)
  const [keyword, setKeyword] = useState('')
  const [genreId, setGenreId] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  // "Đang chiếu" = showing=true (có suất chiếu từ bây giờ)
  // "Sắp chiếu" = status=COMING_SOON (admin set)
  const { data: moviePage, isLoading } = useMovies({
    keyword: keyword || undefined,
    genreId: genreId || undefined,
    ...(tab === 'showing' ? { showing: true } : { status: 'COMING_SOON' }),
    page,
    size: 20,
  })

  const { data: genres = [] } = useGenres()

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value)
    setPage(0)
  }, [])

  function handleTabChange(newTab: string) {
    setTab(newTab)
    setPage(0)
    setSearchParams({ status: newTab })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[#0a1929] rounded-xl p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => handleTabChange(t.value)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.value
                ? 'bg-[#eab308] text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="space-y-4 mb-8">
        <SearchBar value={keyword} onChange={handleKeywordChange} />
        <GenreFilter genres={genres} selected={genreId} onSelect={(id) => { setGenreId(id); setPage(0) }} />
      </div>

      {/* Movie Grid */}
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <MovieGrid
            movies={moviePage?.content || []}
            emptyMessage="Không tìm thấy phim nào"
          />

          {/* Pagination */}
          {moviePage && moviePage.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                Trước
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-400">
                Trang {page + 1} / {moviePage.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={moviePage.last}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                Sau
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
