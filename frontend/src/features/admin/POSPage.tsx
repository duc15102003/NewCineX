import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingCart, Plus, Minus, Trash2, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import Loading from '@/components/common/Loading'

interface CartItem {
  snackId: number
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')

  const { data: snacks, isLoading } = useQuery({
    queryKey: ['pos', 'snacks'],
    queryFn: async () => {
      const res = await api.get('/api/snacks', { params: { size: 50 } })
      return res.data.data.content ?? []
    },
  })

  const createOrderMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/api/snack-orders', data)
      return res.data.data
    },
    onSuccess: (data) => {
      toast.success(`Đơn ${data.orderCode} — ${data.totalAmount?.toLocaleString('vi-VN')}đ`)
      setCart([])
      setNote('')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi tạo đơn')),
  })

  function addToCart(snack: any) {
    setCart(prev => {
      const existing = prev.find(c => c.snackId === snack.id)
      if (existing) {
        return prev.map(c => c.snackId === snack.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { snackId: snack.id, name: snack.name, price: snack.price, imageUrl: snack.imageUrl, quantity: 1 }]
    })
  }

  function updateQty(snackId: number, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.snackId !== snackId) return c
      const newQty = c.quantity + delta
      return newQty > 0 ? { ...c, quantity: newQty } : c
    }))
  }

  function removeFromCart(snackId: number) {
    setCart(prev => prev.filter(c => c.snackId !== snackId))
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)

  function handleSubmit() {
    if (cart.length === 0) return
    createOrderMut.mutate({
      items: cart.map(c => ({ snackId: c.snackId, quantity: c.quantity })),
      note: note.trim() || null,
    })
  }

  if (isLoading) return <Loading />

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Left: Snack grid */}
      <div className="flex-1 overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Receipt size={20} className="text-[#eab308]" /> POS Bán hàng
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(snacks ?? []).map((s: any) => (
            <button key={s.id} onClick={() => addToCart(s)}
              className="bg-[#0a1929] border border-white/5 rounded-xl p-3 text-left hover:border-[#eab308]/30 transition-colors group">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt={s.name} className="w-full h-24 object-cover rounded-lg mb-2" />
              ) : (
                <div className="w-full h-24 bg-[#0d2137] rounded-lg mb-2 flex items-center justify-center text-gray-600 text-xs">Chưa có ảnh</div>
              )}
              <p className="text-sm font-medium text-white truncate group-hover:text-[#eab308]">{s.name}</p>
              <p className="text-xs text-[#eab308] font-semibold mt-1">{s.price?.toLocaleString('vi-VN')}đ</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 bg-[#0a1929] border border-white/5 rounded-xl p-4 flex flex-col shrink-0">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#eab308]" /> Giỏ hàng ({cart.length})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Chưa chọn món nào</p>
          ) : cart.map(item => (
            <div key={item.snackId} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.name}</p>
                <p className="text-xs text-[#eab308]">{(item.price * item.quantity).toLocaleString('vi-VN')}đ</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.snackId, -1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-gray-300 hover:bg-white/20"><Minus size={12} /></button>
                <span className="text-sm text-white w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.snackId, 1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-gray-300 hover:bg-white/20"><Plus size={12} /></button>
              </div>
              <button onClick={() => removeFromCart(item.snackId)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <Input placeholder="Ghi chú (không bắt buộc)" value={note} onChange={e => setNote(e.target.value)} className="mb-3 h-9 text-sm" />

        <div className="border-t border-white/10 pt-3 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Tổng cộng</span>
            <span className="text-xl font-bold text-[#eab308]">{total.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={cart.length === 0 || createOrderMut.isPending}
          className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold h-11">
          {createOrderMut.isPending ? 'Đang xử lý...' : 'Xác nhận đơn'}
        </Button>
      </div>
    </div>
  )
}
