import { Controller, type Control, type useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { DAY_OPTIONS, type FormData } from './types'

type Register = ReturnType<typeof useForm<FormData>>['register']

export interface DayOfWeekPickerProps {
  selectedDays: string[]
  onToggle: (day: string) => void
  register: Register
}

/** Chọn nhiều thứ trong tuần dạng pill — value join CSV vào hidden input. */
export function DayOfWeekPicker({ selectedDays, onToggle, register }: DayOfWeekPickerProps) {
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">Áp dụng cho các thứ</label>
      <div className="flex flex-wrap gap-2">
        {DAY_OPTIONS.map(d => {
          const selected = selectedDays.includes(d.value)
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onToggle(d.value)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                selected
                  ? 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30'
                  : 'bg-[#2a2317] text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          )
        })}
      </div>
      <input type="hidden" {...register('dayOfWeek')} />
    </div>
  )
}

/**
 * Hour range — UI là time picker (HH:mm) nhưng value lưu là số (0-23).
 * BE chỉ care về giờ nguyên, phút bỏ qua. Time picker UX rõ hơn cho admin.
 */
export function HourRangeInputs({ control }: { control: Control<FormData> }) {
  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu áp dụng</label>
        <Controller name="hourStart" control={control}
          render={({ field }) => (
            <Input type="time" step={3600}
              value={typeof field.value === 'number' ? `${String(field.value).padStart(2, '0')}:00` : ''}
              onChange={(e) => {
                const v = e.target.value
                if (!v) { field.onChange(null); return }
                const h = Number(v.split(':')[0])
                if (h >= 0 && h <= 23) field.onChange(h)
              }}
              className="[color-scheme:dark]"
              style={{ colorScheme: 'dark' }} />
          )} />
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ kết thúc áp dụng</label>
        <Controller name="hourEnd" control={control}
          render={({ field }) => (
            <Input type="time" step={3600}
              value={typeof field.value === 'number' ? `${String(Math.min(field.value, 23)).padStart(2, '0')}:00` : ''}
              onChange={(e) => {
                const v = e.target.value
                if (!v) { field.onChange(null); return }
                const h = Number(v.split(':')[0])
                if (h >= 0 && h <= 23) field.onChange(h)
              }}
              className="[color-scheme:dark]"
              style={{ colorScheme: 'dark' }} />
          )} />
      </div>
    </>
  )
}

export function DateRangeInputs({ register }: { register: Register }) {
  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Ngày bắt đầu</label>
        <Input type="date" {...register('dateStart')} />
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Ngày kết thúc</label>
        <Input type="date" {...register('dateEnd')} />
      </div>
    </>
  )
}
