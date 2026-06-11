import { ArrowUpDown } from 'lucide-react'

export interface SortOption {
  value: string // dạng "field,direction" — VD: "rating,desc"
  label: string
}

interface SortDropdownProps {
  options: SortOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Dropdown sort reusable cho mọi list trang admin.
 * Style theo Admin Dark Brown: bg-[#2a2317] border-white/10 focus ring #ffc107.
 * Value gửi đi dạng "field,direction" — đúng convention Spring Pageable.
 */
export default function SortDropdown({ options, value, onChange, className = '' }: SortDropdownProps) {
  return (
    <div className={`relative ${className}`}>
      <ArrowUpDown
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-[#2a2317] text-white text-sm pl-9 pr-8 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#2a2317]">
            {opt.label}
          </option>
        ))}
      </select>
      {/* Mũi tên xuống */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

/**
 * Các option sort mặc định cho list phim.
 * Field khớp với BE Movie entity (createdAt, rating, ratingCount, releaseDate, title).
 */
export const MOVIE_SORT_OPTIONS: SortOption[] = [
  { value: 'createdAt,desc', label: 'Mới nhất' },
  { value: 'rating,desc', label: 'Đánh giá cao' },
  { value: 'ratingCount,desc', label: 'Phổ biến' },
  { value: 'releaseDate,desc', label: 'Mới ra mắt' },
  { value: 'releaseDate,asc', label: 'Sắp khởi chiếu' },
  { value: 'title,asc', label: 'Theo tên A-Z' },
]
