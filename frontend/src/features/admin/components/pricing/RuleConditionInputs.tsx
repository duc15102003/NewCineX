import type { useForm } from 'react-hook-form'
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

export function HourRangeInputs({ register }: { register: Register }) {
  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu</label>
        <Input type="number" min={0} max={23} {...register('hourStart')} placeholder="18" />
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ kết thúc</label>
        <Input type="number" min={0} max={24} {...register('hourEnd')} placeholder="22" />
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
