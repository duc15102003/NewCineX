import { Check } from 'lucide-react'

type Step = 1 | 2 | 3

interface Props {
  current: Step
}

const STEPS = [
  { id: 1, label: 'Chọn ghế' },
  { id: 2, label: 'Thanh toán' },
  { id: 3, label: 'Nhận vé' },
] as const

/**
 * Step indicator cho booking flow user — chuẩn e-commerce / cinema.
 * Hiển thị 3 bước với trạng thái: hoàn thành (xanh), hiện tại (gold), chưa tới (xám).
 */
export default function BookingSteps({ current }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <ol className="flex items-center">
        {STEPS.map((step, idx) => {
          const done = step.id < current
          const active = step.id === current
          const isLast = idx === STEPS.length - 1
          return (
            <li key={step.id} className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1'}`}>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
                  done
                    ? 'bg-green-500/20 border-green-500/60 text-green-300'
                    : active
                      ? 'bg-[#ffc107] border-[#ffc107] text-black'
                      : 'bg-[#2a2317] border-white/15 text-gray-500'
                }`}>
                  {done ? <Check size={14} /> : step.id}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${
                  done ? 'text-green-300' : active ? 'text-amber-50' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 mx-2 sm:mx-3 h-px ${done ? 'bg-green-500/40' : 'bg-white/10'}`} />
              )}
            </li>
          )
        })}
      </ol>
      {/* Mobile fallback: hiển thị label step hiện tại dưới progress vì ẩn label sm:hidden */}
      <p className="text-center text-xs text-amber-50 mt-2 sm:hidden">
        Bước {current}/3: <span className="font-semibold">{STEPS[current - 1].label}</span>
      </p>
    </div>
  )
}
