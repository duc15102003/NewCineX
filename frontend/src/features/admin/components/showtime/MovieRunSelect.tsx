import type { useForm } from 'react-hook-form'
import { label, MOVIE_RUN_TYPE_LABELS, fmtDate } from '@/utils/labels'
import type { ShowtimeFormData } from './types'
import { SELECT_CLS } from './types'

export interface MovieRun {
  id: number
  runType: string
  status: string
  startDate: string
  endDate: string | null
}

export interface MovieRunSelectProps {
  show: boolean
  runs: MovieRun[]
  register: ReturnType<typeof useForm<ShowtimeFormData>>['register']
}

/** Dropdown đợt chiếu — chỉ hiện khi đã chọn phim. Để trống → BE auto-pick. */
export default function MovieRunSelect({ show, runs, register }: MovieRunSelectProps) {
  if (!show) return null
  if (runs.length === 0) {
    return (
      <div className="col-span-12 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-300">
        Phim này chưa có đợt chiếu nào tại chi nhánh hiện tại. Vào trang Phim,
        bấm icon{' '}
        <span className="inline-block px-1.5 py-0.5 rounded bg-[#2a2317] text-[#ffc107]">📅</span>{' '}
        để tạo đợt chiếu trước.
      </div>
    )
  }
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Đợt chiếu
        <span className="text-gray-500 text-xs ml-2">(để trống → tự chọn đợt phù hợp)</span>
      </label>
      <select {...register('movieRunId')} className={SELECT_CLS}>
        <option value="">Tự chọn (ưu tiên đang chiếu)</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {label(MOVIE_RUN_TYPE_LABELS, r.runType)} · {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
            {' '}[{r.status === 'NOW_SHOWING' ? 'đang chiếu' : r.status === 'SCHEDULED' ? 'sắp chiếu' : 'đã kết thúc'}]
          </option>
        ))}
      </select>
    </div>
  )
}
