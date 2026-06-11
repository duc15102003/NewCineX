import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Ticket } from 'lucide-react'

interface LoginPromptModalProps {
  open: boolean
  onClose: () => void
}

export default function LoginPromptModal({ open, onClose }: LoginPromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="sm" className="bg-[#201b11] border-white/5 text-white text-center rounded-2xl">
        <div className="flex flex-col items-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#ffc107]/10 flex items-center justify-center">
            <Ticket size={28} className="text-[#ffc107]" />
          </div>
          <h3 className="text-lg font-bold">Đăng nhập để đặt vé</h3>
          <p className="text-gray-400 text-sm max-w-xs">
            Bạn cần đăng nhập hoặc tạo tài khoản để đặt vé xem phim, tích điểm và nhận ưu đãi.
          </p>
          <div className="flex gap-3 pt-2">
            <Link to="/login">
              <Button className="border border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107]/10 bg-transparent rounded-lg">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
                Đăng ký miễn phí
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
