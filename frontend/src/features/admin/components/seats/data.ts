import { Film, Layers, Sparkles, Wind } from 'lucide-react'
import { createElement } from 'react'

export type RoomType = 'TWO_D' | 'THREE_D' | 'IMAX' | 'FOUR_DX'
export type Mode = 'preset' | 'custom'

export interface PresetInfo {
  key: RoomType
  icon: React.ReactNode
  label: string
  size: string
  totalSeats: number
  features: string[]
  iconBg: string
}

/** Cấu hình preset layout cho 4 loại phòng — chuẩn industry CGV/Lotte. */
export const PRESETS: PresetInfo[] = [
  { key: 'TWO_D',   icon: createElement(Film, { size: 28 }),     iconBg: 'bg-blue-500/20 text-blue-400',     label: 'Phòng 2D',   size: '10 hàng × 12 cột', totalSeats: 100, features: ['20 ghế VIP giữa rạp', '5 cặp ghế đôi hàng J', '2 ghế ♿ khuyết tật', '2 lối đi (cột 4, 9)'] },
  { key: 'THREE_D', icon: createElement(Layers, { size: 28 }),   iconBg: 'bg-purple-500/20 text-purple-400', label: 'Phòng 3D',   size: '10 hàng × 12 cột', totalSeats: 100, features: ['Vùng VIP RỘNG hơn (kính 3D)', '5 cặp ghế đôi hàng J', '2 ghế ♿ khuyết tật', '2 lối đi (cột 4, 9)'] },
  { key: 'IMAX',    icon: createElement(Sparkles, { size: 28 }), iconBg: 'bg-[#ffc107]/20 text-[#ffc107]',   label: 'Phòng IMAX', size: '14 hàng × 18 cột', totalSeats: 240, features: ['Vùng VIP cực lớn', '2 hàng Deluxe (recliner)', '2 ghế ♿ khuyết tật', '2 lối đi (cột 5, 14)'] },
  { key: 'FOUR_DX', icon: createElement(Wind, { size: 28 }),     iconBg: 'bg-pink-500/20 text-pink-400',     label: 'Phòng 4DX',  size: '8 hàng × 10 cột',  totalSeats: 76,  features: ['Ghế đặc biệt rung + gió', 'Vùng VIP giữa', '2 ghế ♿ khuyết tật', '1 lối đi (cột 5)'] },
]

export type MiniCell = 'S' | 'V' | 'C' | 'D' | 'H' | 'A'

export const MINI_CELL_COLORS: Record<MiniCell, string> = {
  S: 'bg-green-600', V: 'bg-yellow-600', C: 'bg-pink-600',
  D: 'bg-blue-600', H: 'bg-cyan-600', A: 'bg-transparent border border-dashed border-gray-500',
}

export const MINI_CELL_NAMES: Record<MiniCell, string> = {
  S: 'Thường', V: 'VIP', C: 'Đôi', D: 'Deluxe', H: '♿ Khuyết tật', A: 'Lối đi',
}

/** Layout preview ASCII cho mỗi RoomType. S/V/C/D/H ghế, A lối đi. */
export const MINI_LAYOUTS: Record<RoomType, MiniCell[][]> = {
  TWO_D: [
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['H','S','S','A','S','S','S','S','S','A','S','H'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','V','V','V','V','V','A','S','S'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','V','V','V','V','V','A','S','S'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','S','S','S','S','S','A','S','S'],
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['C','C','C','A','C','C','C','C','C','A','C','C'],
  ],
  THREE_D: [
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['H','S','S','A','S','S','S','S','S','A','S','H'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['C','C','C','A','C','C','C','C','C','A','C','C'],
  ],
  IMAX: [
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
    ['H','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','H'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],['S','S','S','S','A','D','D','D','D','D','D','D','D','D','A','S','S','S'],
    ['S','S','S','S','A','D','D','D','D','D','D','D','D','D','A','S','S','S'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
  ],
  FOUR_DX: [
    ['S','S','S','S','A','S','S','S','S','S'],['H','S','S','S','A','S','S','S','S','H'],
    ['S','S','V','V','A','V','V','V','S','S'],['S','S','V','V','A','V','V','V','S','S'],
    ['S','S','V','V','A','V','V','V','S','S'],['S','S','V','V','A','V','V','V','S','S'],
    ['S','S','S','S','A','S','S','S','S','S'],['S','S','S','S','A','S','S','S','S','S'],
  ],
}
