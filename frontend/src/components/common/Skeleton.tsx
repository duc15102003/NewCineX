import { cn } from '@/lib/utils'

/**
 * Skeleton base — block shimmer dùng làm placeholder trong khi data đang load.
 * Pattern industry (Facebook/YouTube/Shopee): hiển thị KHUNG CONTENT đúng kích thước
 * thay vì spinner trống → giảm "perceived wait time" 30-40% (Nielsen).
 *
 * <p>Animation pulse từ Tailwind (built-in). Gradient nâu nhẹ match design system.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-[#2a2317] rounded-md', className)} />
  )
}

/** Khung 1 movie card (poster + title + rating) — dùng trong MovieGrid skeleton. */
export function MovieCardSkeleton() {
  return (
    <div className="bg-[#201b11] border border-white/5 rounded-2xl overflow-hidden">
      <Skeleton className="w-full aspect-[2/3] rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/** Grid skeleton thay cho MovieGrid khi loading. Default 10 item match page size. */
export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton cho trang detail phim — backdrop + poster + meta + showtime list. */
export function MovieDetailSkeleton() {
  return (
    <div>
      {/* Backdrop */}
      <Skeleton className="w-full h-64 rounded-none" />
      <div className="max-w-5xl mx-auto px-4 -mt-20 relative">
        <div className="flex flex-col md:flex-row gap-6">
          <Skeleton className="w-48 h-72 shrink-0" />
          <div className="flex-1 space-y-3 pt-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
