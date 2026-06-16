import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtDateTime, fmtVnd } from '@/utils/labels'
import { SEAT_TYPE_PRICE_TEXT } from '@/utils/colors'
import type { POSShowtime } from '@/hooks/usePOS'

export interface POSShowtimePickerProps {
  showtimes: POSShowtime[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/**
 * Carousel cuộn ngang chọn suất chiếu cho POS.
 *
 * <p>Hiển thị giá theo loại ghế CÓ trong phòng — BE để các cột
 * vip/couple/sweetbox/deluxe nullable, null = phòng không có loại đó.
 * Trước đây card chỉ show {@code basePrice} → NV không biết phòng
 * có VIP/Đôi không, phải mở seat grid ra mới thấy.
 */
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
                className={`flex-shrink-0 w-60 p-4 rounded-2xl border text-left transition-all ${
                  selectedId === s.id
                    ? 'border-[#ffc107] bg-[#ffc107]/10 shadow-lg shadow-[#ffc107]/10'
                    : 'border-white/5 hover:border-white/15 bg-[#2a2317]'
                }`}
              >
                <p className="text-white font-semibold text-sm truncate">{s.movieTitle}</p>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-gray-500 truncate">{s.roomName}</span>
                  <span className="text-gray-400 ml-2 shrink-0">{fmtDateTime(s.startTime)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                  <PriceRow seatType="STANDARD" label="Thường" price={s.basePrice} />
                  {s.vipPrice != null && <PriceRow seatType="VIP" label="VIP" price={s.vipPrice} />}
                  {s.couplePrice != null && <PriceRow seatType="COUPLE" label="Đôi" price={s.couplePrice} />}
                  {s.sweetboxPrice != null && <PriceRow seatType="SWEETBOX" label="Sweetbox" price={s.sweetboxPrice} />}
                  {s.deluxePrice != null && <PriceRow seatType="DELUXE" label="Deluxe" price={s.deluxePrice} />}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 1 dòng giá theo loại ghế. Màu giá match màu ghế trên seat grid —
 * STANDARD xanh, VIP gold, COUPLE pink, SWEETBOX purple, DELUXE blue.
 */
function PriceRow({ seatType, label, price }: {
  seatType: keyof typeof SEAT_TYPE_PRICE_TEXT
  label: string
  price: number
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-mono font-semibold ${SEAT_TYPE_PRICE_TEXT[seatType]}`}>
        {fmtVnd(price)}
      </span>
    </div>
  )
}
