import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, Archive, ArchiveRestore, Send } from 'lucide-react'

interface StatusDropdownProps {
  onArchive: () => void
  onRestore: () => void
  archiveLoading?: boolean
  restoreLoading?: boolean
  /** Optional: extra action "Đăng nháp" — chỉ trang Suất chiếu cần. */
  onPublish?: () => void
  publishLoading?: boolean
}

export default function StatusDropdown({ onArchive, onRestore, archiveLoading, restoreLoading, onPublish, publishLoading }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(!open)}
        className="border-white/10 text-gray-300 hover:bg-white/5">
        Lưu trữ <ChevronDown size={14} className={`ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-[#201b11] border border-white/10 rounded-xl shadow-2xl shadow-black/40 py-1 z-50">
          {onPublish && (
            <button
              onClick={() => { onPublish(); setOpen(false) }}
              disabled={publishLoading}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Send size={15} className="text-[#ffc107]" /> Đăng suất nháp
            </button>
          )}
          <button
            onClick={() => { onArchive(); setOpen(false) }}
            disabled={archiveLoading}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Archive size={15} className="text-orange-400" /> Lưu trữ
          </button>
          <button
            onClick={() => { onRestore(); setOpen(false) }}
            disabled={restoreLoading}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArchiveRestore size={15} className="text-green-400" /> Khôi phục
          </button>
        </div>
      )}
    </div>
  )
}
