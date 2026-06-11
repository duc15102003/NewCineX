import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  loading?: boolean
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Xác nhận', message, confirmText = 'Xóa', loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="sm" className="bg-[#201b11] border-white/5 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-gray-400 text-sm">{message}</p>
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
