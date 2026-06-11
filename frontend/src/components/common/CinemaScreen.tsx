/**
 * Component "MÀN HÌNH" dùng chung — pattern Cinema (CGV/Lotte/BHD).
 *
 * <p>Đồng bộ visual giữa các trang:
 * - SeatSelectionPage (booking user)
 * - SeatEditorGrid (admin Editor)
 * - POSSeatGrid (POS bán vé)
 * - GenerateSeatsDialog custom panel
 *
 * <p>Variant {@code size}:
 * - {@code lg}: trang chính (booking, POS, editor) — width 75%
 * - {@code sm}: dialog/mini preview — width 100% bounded
 */
interface CinemaScreenProps {
  size?: 'lg' | 'sm'
}

export default function CinemaScreen({ size = 'lg' }: CinemaScreenProps) {
  const widthClass = size === 'lg' ? 'w-3/4' : 'w-full max-w-md'
  const labelClass = size === 'lg'
    ? 'text-xs tracking-[0.3em]'
    : 'text-[10px] tracking-wider'
  const beamHeight = size === 'lg' ? 'h-8' : 'h-4'

  return (
    <div className="flex justify-center mb-6">
      <div className={`${widthClass} text-center`}>
        <div className="h-1 bg-gradient-to-r from-transparent via-[#ffc107] to-transparent rounded-full" />
        <div className={`${beamHeight} bg-gradient-to-b from-[#ffc107]/10 to-transparent`} />
        <p className={`text-gray-500 uppercase -mt-3 ${labelClass}`}>Màn hình</p>
      </div>
    </div>
  )
}
