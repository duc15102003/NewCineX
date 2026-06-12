import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  message?: string
  onRetry?: () => void
}

/**
 * Error state cho data fetching fail — thay vì để section trống, hiển thị
 * icon + message + nút Thử lại. Chuẩn UX khi API down hoặc network hỏng.
 *
 * <p>Trước đó nhiều page chỉ check {@code isLoading} → khi {@code isError}
 * user thấy "không có data" / "không có phim" — hiểu sai bản chất lỗi.
 */
export default function DataErrorState({
  message = 'Không tải được dữ liệu. Vui lòng thử lại.',
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 bg-[#201b11] border border-red-500/20 rounded-2xl">
      <AlertCircle size={32} className="text-red-400 mb-3" />
      <p className="text-gray-300 text-sm text-center mb-4">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-[#ffc107]/40 text-[#ffc107] hover:bg-[#ffc107]/10 hover:text-[#ffc107]"
        >
          <RefreshCcw size={14} className="mr-1.5" />
          Thử lại
        </Button>
      )}
    </div>
  )
}
