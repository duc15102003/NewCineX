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
 * - {@code md}: dialog preview lớn (Generate Seats) — width 80%, beam vừa
 * - {@code sm}: mini preview compact — width max-md
 */
interface CinemaScreenProps {
  size?: 'lg' | 'md' | 'sm'
}

export default function CinemaScreen({ size = 'lg' }: CinemaScreenProps) {
  const widthClass = size === 'lg' ? 'w-3/4'
    : size === 'md' ? 'w-full'
    : 'w-full max-w-md'
  const labelClass = size === 'lg' ? 'text-xs tracking-[0.3em]'
    : size === 'md' ? 'text-xs tracking-[0.2em]'
    : 'text-[10px] tracking-wider'
  const beamHeight = size === 'lg' ? 'h-8'
    : size === 'md' ? 'h-6'
    : 'h-4'

  return (
    // w-full ép wrapper chiếm full width parent — tránh bị shrink khi đặt
    // trong flex-col items-center (PresetMiniMap, SeatEditorGrid...).
    <div className="flex justify-center mb-6 w-full">
      <div className={`${widthClass} text-center`}>
        <div className="h-1 bg-gradient-to-r from-transparent via-[#ffc107] to-transparent rounded-full" />
        <div className={`${beamHeight} bg-gradient-to-b from-[#ffc107]/10 to-transparent`} />
        <p className={`text-gray-500 uppercase -mt-3 ${labelClass}`}>Màn hình</p>
      </div>
    </div>
  )
}
