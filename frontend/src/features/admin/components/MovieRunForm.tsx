import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DialogBody, DialogFooter } from '@/components/ui/dialog'
import { MOVIE_RUN_TYPE_LABELS } from '@/utils/labels'
import type { MovieRun, MovieRunType } from '@/types/movie'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface MovieRunFormData {
  startDate: string
  /** Optional — empty = open-ended (chiếu vô thời hạn cho đến khi admin quyết ngưng). */
  endDate: string
  runType: MovieRunType
  notes: string
}

export interface MovieRunFormProps {
  editingRun: MovieRun | null
  saving: boolean
  onSubmit: (data: MovieRunFormData) => void
  onCancel: () => void
}

/** Form tạo/sửa MovieRun. Reset khi editingRun đổi. */
export default function MovieRunForm({ editingRun, saving, onSubmit, onCancel }: MovieRunFormProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MovieRunFormData>()

  useEffect(() => {
    if (editingRun) {
      reset({
        startDate: editingRun.startDate?.slice(0, 10) ?? '',
        endDate: editingRun.endDate?.slice(0, 10) ?? '',
        runType: editingRun.runType,
        notes: editingRun.notes ?? '',
      })
    } else {
      reset({ startDate: '', endDate: '', runType: 'FIRST_RUN', notes: '' })
    }
  }, [editingRun, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-6">
            <label className="text-sm text-gray-400 mb-1.5 block">
              Ngày bắt đầu <span className="text-red-400">*</span>
            </label>
            <Input type="date" {...register('startDate', { required: 'Ngày bắt đầu là bắt buộc' })} />
            {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate.message}</p>}
          </div>
          <div className="col-span-6">
            <label className="text-sm text-gray-400 mb-1.5 block">
              Ngày kết thúc
              <span className="text-gray-500 text-xs ml-2">(để trống nếu chưa quyết)</span>
            </label>
            <Input type="date" {...register('endDate')} />
          </div>
          <div className="col-span-12">
            <label className="text-sm text-gray-400 mb-1.5 block">
              Loại đợt chiếu <span className="text-red-400">*</span>
            </label>
            <select {...register('runType', { required: 'Loại là bắt buộc' })} className={SELECT_CLS}>
              {Object.entries(MOVIE_RUN_TYPE_LABELS).map(([value, lbl]) => (
                <option key={value} value={value}>{lbl}</option>
              ))}
            </select>
          </div>
          <div className="col-span-12">
            <label className="text-sm text-gray-400 mb-1.5 block">Ghi chú</label>
            <Textarea {...register('notes', { maxLength: { value: 500, message: 'Tối đa 500 ký tự' } })}
              rows={3} placeholder="VD: Đợt chiếu kỷ niệm 10 năm phát hành..." />
            {errors.notes && <p className="text-red-400 text-xs mt-1">{errors.notes.message}</p>}
          </div>
          <div className="col-span-12 text-xs text-gray-500 space-y-1">
            <p>• Trạng thái (Chưa khởi chiếu / Đang chiếu / Đã kết thúc) hệ thống tự cập nhật mỗi ngày.</p>
            <p>• <b>Để trống ngày kết thúc</b> nếu phim chiếu vô thời hạn — set sau khi quyết ngưng.
              Đây là cách CGV/Lotte làm: công bố ngày khởi chiếu, kết thúc dựa trên doanh thu.</p>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel}
          className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
        <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
          disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
      </DialogFooter>
    </form>
  )
}
