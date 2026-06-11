import { Inbox, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  /** Title chính — câu ngắn, action-oriented. Vd "Chưa có vé nào" thay vì "No data". */
  message?: string
  /** Description dưới title — giải thích hoặc next step. */
  description?: string
  /** Icon Lucide React (default: Inbox). Match domain — vd Film cho phim, Ticket cho vé. */
  icon?: LucideIcon
  /** Nút CTA hiện dưới text. Click → navigate hoặc gọi action. */
  cta?: {
    label: string
    /** Link path (dùng <Link> nội bộ). Mutually exclusive với onClick. */
    to?: string
    onClick?: () => void
  }
  /** Override padding khi cần (vd inline trong card nhỏ). Default py-20. */
  className?: string
}

/**
 * Empty state chuẩn pattern e-commerce (Shopee/Lazada/Tiki):
 * <ul>
 *   <li>Icon mờ to → cảm xúc + nhận diện nhanh (vs text trắng đen)</li>
 *   <li>Title bold + description nhỏ → information hierarchy rõ</li>
 *   <li>CTA optional → hướng user ra khỏi trạng thái rỗng (tăng engagement)</li>
 * </ul>
 *
 * <p>Backward compat: chỉ truyền {@code message} vẫn chạy được — icon/description optional.
 */
export default function EmptyState({
  message = 'Không có dữ liệu',
  description,
  icon: Icon = Inbox,
  cta,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 text-center px-4 ${className}`}>
      <Icon size={48} className="text-[#3f382d] mb-4" strokeWidth={1.5} />
      <p className="text-amber-50 font-medium mb-1">{message}</p>
      {description && (
        <p className="text-gray-500 text-sm max-w-sm leading-relaxed">{description}</p>
      )}
      {cta && (
        <div className="mt-5">
          {cta.to ? (
            <Link to={cta.to}>
              <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
                {cta.label}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={cta.onClick}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
            >
              {cta.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
