import { useEffect, useState } from 'react'
import { X, RotateCcw, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MOVIE_STATUS_LABELS } from '@/utils/labels'
import type { AdminMovieFilter, Genre } from '@/types/movie'

// Admin Dark Brown override cho <Input> shared (mặc định mang public tokens).
// tailwind-merge giữ class sau → bg/focus đổi đúng.
const ADMIN_INPUT_CLS =
  'bg-[#2a2317] focus:ring-[#ffc107] focus:border-[#ffc107]'

interface MovieFilterDrawerProps {
  open: boolean
  onClose: () => void
  /** Filter hiện tại (chỉ các field nâng cao — không gồm keyword/sort/page) */
  value: AdminMovieFilter
  /** Apply filter (sẽ reset page về 0 ở caller) */
  onApply: (filter: AdminMovieFilter) => void
  genres: Genre[]
  /** True nếu drawer này phục vụ admin (hiển thị thêm "bao gồm đã xóa") */
  isAdmin?: boolean
}

/**
 * Drawer slide từ phải sang — chứa các filter nâng cao cho list phim.
 * Form dùng state local, chỉ commit khi bấm "Áp dụng".
 * Reset trả về object rỗng (clear hết filter ngoài keyword/sort).
 */
export default function MovieFilterDrawer({
  open,
  onClose,
  value,
  onApply,
  genres,
  isAdmin = false,
}: MovieFilterDrawerProps) {
  const [draft, setDraft] = useState<AdminMovieFilter>(value)

  // Sync draft khi drawer mở (user có thể đã thay đổi filter ở ngoài)
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  // Khóa scroll body khi drawer mở
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Đóng bằng Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function setField<K extends keyof AdminMovieFilter>(key: K, val: AdminMovieFilter[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }))
  }

  function handleReset() {
    setDraft({})
  }

  function handleApply() {
    // Loại bỏ field rỗng/NaN trước khi apply
    const cleaned: AdminMovieFilter = {}
    for (const [k, v] of Object.entries(draft)) {
      if (v === undefined || v === null || v === '') continue
      if (typeof v === 'number' && Number.isNaN(v)) continue
      ;(cleaned as Record<string, unknown>)[k] = v
    }
    onApply(cleaned)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      {/* Drawer panel — slide từ phải, width 420px. Admin Dark Brown theme. */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-[#201b11] border-l border-white/5 shadow-2xl rounded-l-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Lọc nâng cao</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Thể loại */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Thể loại</label>
            <select
              value={draft.genreId ?? ''}
              onChange={(e) =>
                setField('genreId', e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]"
            >
              <option value="">Tất cả thể loại</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trạng thái */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Trạng thái</label>
            <select
              value={draft.status ?? ''}
              onChange={(e) =>
                setField(
                  'status',
                  (e.target.value || undefined) as AdminMovieFilter['status'],
                )
              }
              className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(MOVIE_STATUS_LABELS).map(([v, lbl]) => (
                <option key={v} value={v}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Đạo diễn */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Đạo diễn</label>
            <Input
              placeholder="VD: Christopher Nolan"
              value={draft.director ?? ''}
              onChange={(e) => setField('director', e.target.value || undefined)}
              className={ADMIN_INPUT_CLS}
            />
          </div>

          {/* Diễn viên */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Diễn viên</label>
            <Input
              placeholder="VD: Leonardo DiCaprio"
              value={draft.cast ?? ''}
              onChange={(e) => setField('cast', e.target.value || undefined)}
              className={ADMIN_INPUT_CLS}
            />
          </div>

          {/* Ngôn ngữ */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Ngôn ngữ</label>
            <Input
              placeholder="VD: Tiếng Việt / English"
              value={draft.language ?? ''}
              onChange={(e) => setField('language', e.target.value || undefined)}
              className={ADMIN_INPUT_CLS}
            />
          </div>

          {/* Thời lượng */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Thời lượng (phút)</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Từ"
                value={draft.minDuration ?? ''}
                onChange={(e) =>
                  setField('minDuration', e.target.value ? Number(e.target.value) : undefined)
                }
                className={ADMIN_INPUT_CLS}
              />
              <Input
                type="number"
                placeholder="Đến"
                value={draft.maxDuration ?? ''}
                onChange={(e) =>
                  setField('maxDuration', e.target.value ? Number(e.target.value) : undefined)
                }
                className={ADMIN_INPUT_CLS}
              />
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">
              Số sao (0 - 10)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.1"
                placeholder="Từ"
                value={draft.minRating ?? ''}
                onChange={(e) =>
                  setField('minRating', e.target.value ? Number(e.target.value) : undefined)
                }
                className={ADMIN_INPUT_CLS}
              />
              <Input
                type="number"
                step="0.1"
                placeholder="Đến"
                value={draft.maxRating ?? ''}
                onChange={(e) =>
                  setField('maxRating', e.target.value ? Number(e.target.value) : undefined)
                }
                className={ADMIN_INPUT_CLS}
              />
            </div>
          </div>

          {/* Ngày phát hành */}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Ngày khởi chiếu</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={draft.releaseDateFrom ?? ''}
                onChange={(e) => setField('releaseDateFrom', e.target.value || undefined)}
                className={ADMIN_INPUT_CLS}
              />
              <Input
                type="date"
                value={draft.releaseDateTo ?? ''}
                onChange={(e) => setField('releaseDateTo', e.target.value || undefined)}
                className={ADMIN_INPUT_CLS}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.hasActiveShowtimes}
                onChange={(e) =>
                  setField('hasActiveShowtimes', e.target.checked || undefined)
                }
                className="accent-[#ffc107]"
              />
              Đang có suất chiếu
            </label>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.includeDeleted ?? true}
                  onChange={(e) => setField('includeDeleted', e.target.checked)}
                  className="accent-[#ffc107]"
                />
                Hiển thị phim đã lưu trữ
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-5 border-t border-white/5">
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            <RotateCcw size={14} className="mr-1.5" />
            Đặt lại
          </Button>
          <Button
            onClick={handleApply}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
          >
            <Check size={14} className="mr-1.5" />
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  )
}
