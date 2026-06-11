import { AlertTriangle, IdCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AGE_RATING_LABELS, AGE_RATING_MIN_AGE } from '@/utils/labels'
import type { AgeRating } from '@/types/movie'

interface AgeConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ageRating: AgeRating
  movieTitle: string
  onConfirm: () => void
  loading?: boolean
}

/**
 * Confirm dialog cho phim T13/T16/T18/C — chuẩn industry CGV/Lotte/BHD.
 *
 * <p>Pháp lý: rạp chỉ cần "nỗ lực hợp lý" (good faith effort) verify tuổi. Online không thể
 * check CCCD → checkbox xác nhận là disclaimer pháp lý + thông báo user phải mang CCCD tới quầy.
 * Verify vật lý CCCD ở cổng rạp là barrier thật (Phase 3 — POS reject button).
 */
export default function AgeConfirmDialog({
  open, onOpenChange, ageRating, movieTitle, onConfirm, loading,
}: AgeConfirmDialogProps) {
  const minAge = AGE_RATING_MIN_AGE[ageRating] ?? 0
  const ratingLabel = AGE_RATING_LABELS[ageRating] ?? ageRating
  const isStrict = ageRating === 'T18'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#201b11] border-[#3f382d] rounded-2xl max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isStrict ? 'bg-red-500/10 border border-red-500/30' : 'bg-orange-500/10 border border-orange-500/30'
            }`}>
              <AlertTriangle size={24} className={isStrict ? 'text-red-400' : 'text-orange-400'} />
            </div>
            <div>
              <DialogTitle className="text-amber-50 text-lg">Xác nhận độ tuổi</DialogTitle>
              <p className="text-xs text-gray-400 mt-0.5">{ratingLabel}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Dùng DialogBody (đã có px-6 py-2 mặc định) thay DialogDescription — vì
            description chỉ render <p>, không nhét được block-level children + thiếu padding ngang. */}
        <DialogBody className="text-gray-300 text-sm leading-relaxed space-y-3">
          <p>
            Phim <span className="text-amber-50 font-medium">{movieTitle}</span> được phân loại{' '}
            <span className="text-[#ffc107] font-semibold">{ageRating}</span>
            {minAge > 0 && <> — chỉ dành cho khán giả từ <span className="font-semibold">{minAge} tuổi</span> trở lên.</>}
          </p>

          <div className="flex gap-2 bg-[#2a2317] border border-[#3f382d] rounded-lg p-3">
            <IdCard size={18} className="text-[#ffc107] shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300">
              Vui lòng mang <span className="text-amber-50 font-medium">CCCD/CMND</span> khi đến rạp.
              Nhân viên có quyền từ chối check-in nếu không đủ tuổi và{' '}
              <span className="text-red-400">không hoàn tiền</span>.
            </div>
          </div>

          <p className="text-gray-400 text-xs">
            Bằng việc tiếp tục, bạn xác nhận đủ điều kiện độ tuổi để xem phim này.
          </p>
        </DialogBody>

        <DialogFooter className="gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 text-gray-300 hover:bg-white/5 rounded-lg"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            type="button"
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Đang giữ ghế...' : 'Tôi xác nhận đủ tuổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
