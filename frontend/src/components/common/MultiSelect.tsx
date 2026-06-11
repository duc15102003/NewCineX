import { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Option {
  value: number
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: number[]
  onChange: (selected: number[]) => void
  placeholder?: string
}

export default function MultiSelect({ options, selected, onChange, placeholder = 'Tìm kiếm...' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside → đóng dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Options chưa chọn + filter theo search
  const available = options.filter(
    (o) => !selected.includes(o.value) && o.label.toLowerCase().includes(search.toLowerCase()),
  )

  // Tags đã chọn
  const selectedOptions = options.filter((o) => selected.includes(o.value))

  function addItem(value: number) {
    onChange([...selected, value])
    setSearch('')
  }

  function removeItem(value: number) {
    onChange(selected.filter((v) => v !== value))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Tags đã chọn */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-[#ffc107]/20 text-[#ffc107] border border-[#ffc107]/30 rounded-md"
            >
              {o.label}
              <button
                type="button"
                onClick={() => removeItem(o.value)}
                className="hover:text-yellow-200 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 bg-[#2a2317] border-white/10 text-white text-sm h-9"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-[#2a2317] border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {available.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {search ? 'Không tìm thấy' : 'Đã chọn hết'}
            </div>
          ) : (
            available.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => addItem(o.value)}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[#ffc107] transition-colors"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
