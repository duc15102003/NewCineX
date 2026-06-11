import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingCart, Plus, Minus, Trash2, Receipt, Package, Popcorn, PiggyBank } from 'lucide-react'
import Loading from '@/components/common/Loading'
import { useSnacksForPOS, useCreateSnackOrder } from '@/hooks/useSnackPOS'
import { usePublicCombos } from '@/hooks/useAdminCombos'
import type { AdminSnack } from '@/hooks/useAdminSnacks'
import type { Combo } from '@/hooks/useAdminCombos'
import { fmtVnd } from '@/utils/labels'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import POSTheaterRequired from './components/POSTheaterRequired'

interface SnackCartItem {
  kind: 'SNACK'
  snackId: number
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

interface ComboCartItem {
  kind: 'COMBO'
  comboId: number
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

type CartItem = SnackCartItem | ComboCartItem

function cartKey(item: CartItem): string {
  return item.kind === 'SNACK' ? `S-${item.snackId}` : `C-${item.comboId}`
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')

  // POS chuẩn industry (Vista/Veezi): BẮT BUỘC bind 1 theater context cụ thể.
  // BRANCH_ADMIN có theater từ JWT (set vào store khi login); SUPER_ADMIN chọn "Tất cả CN" → null → chặn.
  const { currentTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const theaterId = currentTheater?.id ?? (isBranchAdmin() ? user?.theaterId : null)

  const { data: snacks = [], isLoading: loadingSnacks } = useSnacksForPOS(theaterId)
  const { data: combos = [], isLoading: loadingCombos } = usePublicCombos(theaterId)
  const createOrderMut = useCreateSnackOrder()

  if (!theaterId) return <POSTheaterRequired mode="SNACK" />

  function addSnack(snack: AdminSnack) {
    setCart(prev => {
      const k = `S-${snack.id}`
      const existing = prev.find(c => cartKey(c) === k)
      if (existing) return prev.map(c => cartKey(c) === k ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, {
        kind: 'SNACK', snackId: snack.id, name: snack.name,
        price: snack.price, imageUrl: snack.imageUrl, quantity: 1,
      }]
    })
  }

  function addCombo(combo: Combo) {
    setCart(prev => {
      const k = `C-${combo.id}`
      const existing = prev.find(c => cartKey(c) === k)
      if (existing) return prev.map(c => cartKey(c) === k ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, {
        kind: 'COMBO', comboId: combo.id, name: combo.name,
        price: combo.price, imageUrl: combo.imageUrl, quantity: 1,
      }]
    })
  }

  function updateQty(key: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (cartKey(c) !== key) return c
      const newQty = c.quantity + delta
      return newQty > 0 ? { ...c, quantity: newQty } : c
    }))
  }

  function removeItem(key: string) {
    setCart(prev => prev.filter(c => cartKey(c) !== key))
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)

  function handleSubmit() {
    if (cart.length === 0) return
    createOrderMut.mutate(
      {
        items: cart.map(c => c.kind === 'SNACK'
          ? { snackId: c.snackId, quantity: c.quantity }
          : { comboId: c.comboId, quantity: c.quantity },
        ),
        note: note.trim() || null,
      },
      {
        onSuccess: () => { setCart([]); setNote('') },
      },
    )
  }

  if (loadingSnacks || loadingCombos) return <Loading />

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Left: Combo + Snack grids */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Receipt size={20} className="text-[#ffc107]" /> POS Bán hàng
        </h2>

        {/* Combo section — hiển thị trước để khuyến khích bán combo (margin cao hơn) */}
        {combos.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Package size={16} className="text-purple-400" /> Combo
              <span className="text-xs text-gray-500 font-normal">({combos.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {combos.map(c => {
                const hasSavings = (c.savingsAmount ?? 0) > 0
                // Tooltip breakdown — nhân viên hover xem chi tiết tư vấn khách
                const tooltipLines = [
                  `${c.name}`,
                  '— Mua lẻ —',
                  ...c.items.map(it => `· ${it.quantity}× ${it.snackName}: ${fmtVnd(it.snackPrice * it.quantity)}`),
                  `Tổng lẻ: ${fmtVnd(c.regularPrice)}`,
                  '— Mua combo —',
                  `Combo: ${fmtVnd(c.price)}`,
                  hasSavings ? `→ Tiết kiệm: ${fmtVnd(c.savingsAmount ?? 0)} (${c.savingsPercent}%)` : '',
                ].filter(Boolean).join('\n')
                return (
                  <button key={c.id} onClick={() => addCombo(c)}
                    title={tooltipLines}
                    className="bg-[#201b11] border border-purple-400/20 rounded-2xl p-3 text-left hover:border-purple-400/60 transition-colors group relative">
                    <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30">COMBO</span>
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-24 bg-[#2a2317] rounded-lg mb-2 flex items-center justify-center">
                        <Package size={24} className="text-purple-400/40" />
                      </div>
                    )}
                    <p className="text-sm font-medium text-white truncate group-hover:text-purple-300">{c.name}</p>
                    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-[#ffc107] font-semibold">{fmtVnd(c.price)}</p>
                      {hasSavings && (
                        <p className="text-[10px] text-gray-500 line-through">{fmtVnd(c.regularPrice)}</p>
                      )}
                    </div>
                    {hasSavings && (
                      <div className="mt-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 w-fit">
                        <PiggyBank size={11} />
                        <span className="text-[10px] font-semibold">
                          Tiết kiệm {fmtVnd(c.savingsAmount ?? 0)}
                          {c.savingsPercent != null && <span className="opacity-70 ml-0.5">(-{c.savingsPercent}%)</span>}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Snack section — chỉ render khi có món */}
        {snacks.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Popcorn size={16} className="text-[#ffc107]" /> Đồ ăn lẻ
              <span className="text-xs text-gray-500 font-normal">({snacks.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {snacks.map(s => (
                <button key={s.id} onClick={() => addSnack(s)}
                  className="bg-[#201b11] border border-white/5 rounded-2xl p-3 text-left hover:border-[#ffc107]/30 transition-colors group">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-24 bg-[#2a2317] rounded-lg mb-2 flex items-center justify-center text-gray-600 text-xs">Chưa có ảnh</div>
                  )}
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#ffc107]">{s.name}</p>
                  <p className="text-xs text-[#ffc107] font-semibold mt-1">{fmtVnd(s.price)}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state: chi nhánh hiện chưa setup món nào */}
        {combos.length === 0 && snacks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Popcorn size={48} className="text-[#ffc107]/30 mb-4" />
            <p className="text-amber-50 font-medium mb-1">Chi nhánh chưa có món nào</p>
            <p className="text-gray-500 text-sm max-w-sm">
              Vào "Quản lý đồ ăn" hoặc "Quản lý combo" để thêm món cho chi nhánh này trước khi bán.
            </p>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-80 bg-[#201b11] border border-white/5 rounded-2xl p-4 flex flex-col shrink-0">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#ffc107]" /> Giỏ hàng ({cart.length})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Chưa chọn món nào</p>
          ) : cart.map(item => {
            const key = cartKey(item)
            return (
              <div key={key} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate flex items-center gap-1.5">
                    {item.kind === 'COMBO' && (
                      <Package size={11} className="text-purple-400 shrink-0" />
                    )}
                    {item.name}
                  </p>
                  <p className="text-xs text-[#ffc107]">{fmtVnd(item.price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(key, -1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-gray-300 hover:bg-white/20"><Minus size={12} /></button>
                  <span className="text-sm text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(key, 1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-gray-300 hover:bg-white/20"><Plus size={12} /></button>
                </div>
                <button onClick={() => removeItem(key)} className="text-red-400 hover:text-red-300" title="Xóa khỏi giỏ">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <Input placeholder="Ghi chú (không bắt buộc)" value={note} onChange={e => setNote(e.target.value)} className="mb-3 h-9 text-sm" />

        <div className="border-t border-white/10 pt-3 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Tổng cộng</span>
            <span className="text-xl font-bold text-[#ffc107]">{fmtVnd(total)}</span>
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={cart.length === 0 || createOrderMut.isPending}
          className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold h-11 rounded-lg">
          {createOrderMut.isPending ? 'Đang xử lý...' : 'Xác nhận đơn'}
        </Button>
      </div>
    </div>
  )
}
