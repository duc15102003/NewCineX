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
      <DialogContent size="sm" className="bg-[#0a1929] border-white/5 text-white text-center">
        <div className="flex flex-col items-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#eab308]/10 flex items-center justify-center">
            <Ticket size={28} className="text-[#eab308]" />
          </div>
          <h3 className="text-lg font-bold">Đăng nhập để đặt vé</h3>
          <p className="text-gray-400 text-sm max-w-xs">
            Bạn cần đăng nhập hoặc tạo tài khoản để đặt vé xem phim, tích điểm và nhận ưu đãi.
          </p>
          <div className="flex gap-3 pt-2">
            <Link to="/login">
              <Button className="border border-[#eab308] text-[#eab308] hover:bg-[#eab308]/10 bg-transparent">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
                Đăng ký miễn phí
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
