import { Controller, type useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { PriceInput } from '@/components/ui/price-input'
import type { SeatType } from '@/hooks/useAdminRooms'
import type { ShowtimeFormData } from './types'

export interface PriceTierInputsProps {
  control: ReturnType<typeof useForm<ShowtimeFormData>>['control']
  errors: ReturnType<typeof useForm<ShowtimeFormData>>['formState']['errors']
  /** Danh sách loại ghế phòng có — undefined khi chưa fetch xong hoặc chưa chọn phòng. */
  seatTypes: { seatType: SeatType; count: number }[] | undefined
  hasRoomSelected: boolean
}

interface TierConfig {
  field: 'basePrice' | 'vipPrice' | 'couplePrice' | 'sweetboxPrice' | 'deluxePrice'
  /** Loại ghế phải có trong phòng để hiển thị tier này. STANDARD/HANDICAP dùng chung basePrice. */
  matchTypes: SeatType[]
  labelText: string
  placeholder: string
  /** Tier "thường" bắt buộc (mọi phòng đều có ghế STANDARD). Còn lại optional. */
  required: boolean
  /** Suffix hiển thị bên label, VD: "(bao gồm ghế khuyết tật)". */
  suffix?: (counts: Record<SeatType, number>) => string | null
}

// Mọi tier đều BẮT BUỘC: tier nào hiển thị nghĩa là phòng có loại ghế đó,
// nên admin phải set giá rõ ràng — không để BE auto-fill (giá hiển thị cho
// khách hàng cần admin chủ động kiểm soát).
const PRICE_TIERS: TierConfig[] = [
  {
    field: 'basePrice',
    matchTypes: ['STANDARD', 'HANDICAP'],
    labelText: 'Giá ghế thường (đ)',
    placeholder: 'VD: 75.000',
    required: true,
    suffix: (counts) => counts.HANDICAP > 0 ? '· bao gồm ghế khuyết tật' : null,
  },
  { field: 'vipPrice', matchTypes: ['VIP'], labelText: 'Giá VIP (đ)', placeholder: 'VD: 100.000', required: true },
  { field: 'couplePrice', matchTypes: ['COUPLE'], labelText: 'Giá ghế đôi (đ)', placeholder: 'VD: 180.000', required: true },
  { field: 'sweetboxPrice', matchTypes: ['SWEETBOX'], labelText: 'Giá Sweetbox (đ)', placeholder: 'VD: 350.000', required: true },
  { field: 'deluxePrice', matchTypes: ['DELUXE'], labelText: 'Giá Deluxe (đ)', placeholder: 'VD: 250.000', required: true },
]

/**
 * Input giá ĐỘNG theo loại ghế phòng có. Chuẩn industry (CGV/Lotte).
 * - Chưa chọn phòng → ẩn cả block giá, hiện hint.
 * - Đã chọn phòng → query BE lấy seat types → render input tương ứng.
 * - STANDARD + HANDICAP → 1 input "Giá ghế thường" (NĐ 28/2012 không thu phụ phí ghế khuyết tật).
 */
export default function PriceTierInputs({
  control, errors, seatTypes, hasRoomSelected,
}: PriceTierInputsProps) {
  if (!hasRoomSelected) {
    return (
      <div className="col-span-12 rounded-xl border border-white/5 bg-[#2a2317]/40 px-4 py-3 text-xs text-gray-400">
        Chọn phòng chiếu để hiển thị các ô nhập giá theo loại ghế của phòng đó.
      </div>
    )
  }
  if (!seatTypes) {
    return (
      <div className="col-span-12 text-xs text-gray-400">Đang tải danh sách loại ghế của phòng…</div>
    )
  }

  // Build map: seatType → count để check + render badge số lượng
  const counts: Record<SeatType, number> = {
    STANDARD: 0, VIP: 0, COUPLE: 0, SWEETBOX: 0, DELUXE: 0, HANDICAP: 0,
  }
  seatTypes.forEach((s) => { counts[s.seatType] = s.count })

  // Lọc tier có ít nhất 1 loại ghế match trong phòng
  const activeTiers = PRICE_TIERS.filter((t) => t.matchTypes.some((mt) => counts[mt] > 0))

  if (activeTiers.length === 0) {
    return (
      <div className="col-span-12 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-300">
        Phòng này chưa có ghế nào ACTIVE. Vào trang Phòng → tạo seat layout trước.
      </div>
    )
  }

  // Layout: tối đa 3 cột/row để cân với grid 12
  const colSpan = activeTiers.length === 1 ? 'col-span-12'
    : activeTiers.length === 2 ? 'col-span-6'
    : 'col-span-4'

  return (
    <>
      {activeTiers.map((tier) => {
        const totalCount = tier.matchTypes.reduce((sum, mt) => sum + counts[mt], 0)
        const suffix = tier.suffix?.(counts)
        return (
          <div key={tier.field} className={colSpan}>
            <label className="text-sm text-gray-400 mb-1.5 block truncate">
              {tier.labelText}
              {tier.required && <span className="text-red-400"> *</span>}
            </label>
            <Controller
              name={tier.field}
              control={control}
              rules={tier.required
                ? { required: 'Giá vé là bắt buộc', min: { value: 1, message: 'Giá phải > 0' } }
                : { min: { value: 0, message: 'Giá không được âm' } }}
              render={({ field }) => (
                <PriceInput value={field.value} onChange={field.onChange} placeholder={tier.placeholder} />
              )}
            />
            <p className="text-gray-500 text-xs mt-1">
              {totalCount} ghế{suffix ? ` ${suffix}` : ''}
            </p>
            {errors[tier.field] && (
              <p className="text-red-400 text-xs mt-1">{String(errors[tier.field]?.message)}</p>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Validate thứ tự giá tier — chỉ check tier phòng có thật.
 * Quy tắc: base ≤ vip ≤ couple ≤ sweetbox; base ≤ vip ≤ deluxe.
 * Sweetbox và Deluxe độc lập nhau (Sweetbox là couple cao cấp, Deluxe là single recliner).
 */
export function validatePriceTier(data: ShowtimeFormData, presentTypes: Set<SeatType>): boolean {
  const base = Number(data.basePrice) || 0
  const vip = Number(data.vipPrice) || 0
  const couple = Number(data.couplePrice) || 0
  const sweetbox = Number(data.sweetboxPrice) || 0
  const deluxe = Number(data.deluxePrice) || 0

  const hasVip = presentTypes.has('VIP')
  const hasCouple = presentTypes.has('COUPLE')
  const hasSweetbox = presentTypes.has('SWEETBOX')
  const hasDeluxe = presentTypes.has('DELUXE')

  if (hasVip && vip > 0 && vip < base) {
    toast.error('Giá VIP phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  if (hasCouple && couple > 0 && couple < base) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  if (hasCouple && hasVip && couple > 0 && vip > 0 && couple < vip) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá VIP')
    return false
  }
  if (hasSweetbox && sweetbox > 0 && hasCouple && couple > 0 && sweetbox < couple) {
    toast.error('Giá Sweetbox phải lớn hơn hoặc bằng giá ghế đôi')
    return false
  }
  if (hasDeluxe && deluxe > 0 && hasVip && vip > 0 && deluxe < vip) {
    toast.error('Giá Deluxe phải lớn hơn hoặc bằng giá VIP')
    return false
  }
  if (hasDeluxe && deluxe > 0 && deluxe < base) {
    toast.error('Giá Deluxe phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  return true
}
