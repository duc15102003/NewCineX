import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtDateTime, fmtVnd } from '@/utils/labels'
import type { POSShowtime } from '@/hooks/usePOS'

export interface POSShowtimePickerProps {
  showtimes: POSShowtime[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Carousel cuộn ngang chọn suất chiếu cho POS. */
export default function POSShowtimePicker({ showtimes, selectedId, onSelect }: POSShowtimePickerProps) {
  return (
    <Card className="bg-[#201b11] border-[#3f382d] rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">Suất chiếu hôm nay ({showtimes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {showtimes.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Không có suất chiếu hôm nay</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {showtimes.map(s => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex-shrink-0 w-56 p-4 rounded-2xl border text-left transition-all ${
                  selectedId === s.id
                    ? 'border-[#ffc107] bg-[#ffc107]/10 shadow-lg shadow-[#ffc107]/10'
                    : 'border-white/5 hover:border-white/15 bg-[#2a2317]'
                }`}
              >
                <p className="text-white font-semibold text-sm truncate">{s.movieTitle}</p>
                <p className="text-gray-500 text-xs mt-1">{s.roomName}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400 text-xs">{fmtDateTime(s.startTime)}</span>
                  <span className="text-[#ffc107] text-sm font-bold">{fmtVnd(s.basePrice)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
