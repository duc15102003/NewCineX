import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, Film, Clapperboard } from 'lucide-react'
import { useMovies, useGenres } from '@/hooks/useMovies'
import MovieGrid from '@/components/movie/MovieGrid'
import SearchBar from '@/components/movie/SearchBar'
import GenreFilter from '@/components/movie/GenreFilter'
import Loading from '@/components/common/Loading'
import DataErrorState from '@/components/common/DataErrorState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import SortDropdown, { MOVIE_SORT_OPTIONS } from '@/components/common/SortDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import MovieFilterDrawer from '@/components/admin/MovieFilterDrawer'
import { useTheaterStore } from '@/store/theaterStore'
import type { MovieFilter } from '@/types/movie'

const STATUS_TABS = [
  { value: 'showing', label: 'Đang chiếu', Icon: Film },
  { value: 'coming_soon', label: 'Sắp chiếu', Icon: Clapperboard },
]

export default function MovieListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('status') || 'showing'

  const [tab, setTab] = useState(initialTab)
  usePageTitle(tab === 'showing' ? 'Phim đang chiếu' : 'Phim sắp chiếu')
  const [keyword, setKeyword] = useState('')
  const [genreId, setGenreId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<string>('createdAt,desc')
  // Filter nâng cao (rating, duration, đạo diễn, ngôn ngữ...) — không gồm keyword/genreId/tab
  const [advancedFilter, setAdvancedFilter] = useState<MovieFilter>({})
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Theater context — phim đang chiếu/sắp chiếu lọc theo chi nhánh user chọn (F1).
  const { currentTheater } = useTheaterStore()

  // "Đang chiếu" = phim có showtime endTime >= now tại CN đang chọn
  // "Sắp chiếu" = phim COMING_SOON có MovieRun upcoming tại CN đó (BE auto join)
  const { data: moviePage, isLoading, isError, refetch } = useMovies({
    ...advancedFilter,
    keyword: keyword || undefined,
    genreId: genreId || undefined,
    theaterId: currentTheater?.id,
    ...(tab === 'showing' ? { showing: true } : { status: 'COMING_SOON' }),
    sort,
    page,
    size: 20,
  })

  const { data: genres = [] } = useGenres()

  const activeFilterCount = useMemo(() => {
    return Object.entries(advancedFilter).filter(([, v]) => v !== undefined && v !== null && v !== '').length
  }, [advancedFilter])

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
      {/* Theater context banner — chỉ hiển thị ở tab "Đang chiếu" (sắp chiếu lọc theo phim chứ
          không theo chi nhánh). */}
      {/* {tab === 'showing' && currentTheater && (
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <MapPin size={14} className="text-[#ffc107]" />
          <span>Đang xem lịch chiếu tại</span>
          <span className="text-amber-50 font-medium">{currentTheater.name}</span>
          <span className="text-gray-600">— đổi chi nhánh ở header để xem nơi khác</span>
        </div>
      )} */}

      {/* Status Tabs — segmented control style, border-b accent cho active */}
      <div className="flex items-center gap-8 mb-8 border-b border-[#3f382d]">
        {STATUS_TABS.map(({ value, label: tabLabel, Icon }) => {
          const active = tab === value
          return (
            <button
              key={value}
              onClick={() => handleTabChange(value)}
              className={`relative flex items-center gap-2 pb-3 text-base font-semibold transition-colors ${active ? 'text-[#ffc107]' : 'text-gray-400 hover:text-amber-50'
                }`}
            >
              <Icon size={18} className={active ? 'text-[#ffc107]' : ''} />
              {tabLabel}
              {/* Underline accent — chỉ active mới có thanh gold ở dưới */}
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#ffc107] rounded-t" />
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar — search + filter + sort, đồng bộ với admin pages */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <SearchBar value={keyword} onChange={handleKeywordChange} />
          </div>
          <FilterTrigger onClick={() => setDrawerOpen(true)} activeCount={activeFilterCount} />
          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setAdvancedFilter({}); setPage(0) }}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter"
            >
              <X size={14} />
            </Button>
          )}
          <div className="w-48">
            <SortDropdown
              options={MOVIE_SORT_OPTIONS}
              value={sort}
              onChange={(v) => { setSort(v); setPage(0) }}
            />
          </div>
        </div>
        <GenreFilter genres={genres} selected={genreId} onSelect={(id) => { setGenreId(id); setPage(0) }} />
      </div>

      {/* Movie Grid */}
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <DataErrorState
          message="Không tải được danh sách phim. Có thể do mất kết nối — vui lòng thử lại."
          onRetry={() => refetch()}
        />
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

      <MovieFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        value={advancedFilter}
        onApply={(f) => { setAdvancedFilter(f); setPage(0) }}
        genres={genres}
      />
    </div>
  )
}
