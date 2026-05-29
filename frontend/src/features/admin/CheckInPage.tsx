import { useState, useEffect, useRef } from 'react'
import { useCheckIn } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, ScanLine, Keyboard, Camera } from 'lucide-react'
import { fmtDateTime } from '@/utils/labels'
import { Html5Qrcode } from 'html5-qrcode'

interface SeatInfo {
  seatNumber?: string
  seatCode?: string
  [key: string]: unknown
}

interface BookingCheckInResult {
  bookingCode?: string
  movieTitle?: string
  startTime?: string
  roomName?: string
  seats?: SeatInfo[]
  totalAmount?: number
  showtime?: {
    movie?: { title?: string }
    room?: { name?: string }
  }
}

export default function CheckInPage() {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ success: boolean; data?: BookingCheckInResult; error?: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processingRef = useRef(false) // Chặn quét trùng

  const checkInMut = useCheckIn()

  function doCheckIn(bookingCode: string) {
    if (!bookingCode.trim()) return
    setResult(null)
    checkInMut.mutate(bookingCode.trim(), {
      onSuccess: (data) => {
        setResult({ success: true, data })
        setCode('')
        stopScanner()
      },
      onError: (e) => {
        setResult({ success: false, error: getErrorMessage(e, 'Check-in thất bại') })
      },
    })
  }

  function handleManualCheckIn() {
    doCheckIn(code)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleManualCheckIn()
  }

  async function startScanner() {
    setResult(null)
    processingRef.current = false // Reset cho lần quét mới
    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Chặn quét trùng: chỉ xử lý lần đầu, dừng scanner ngay
          if (processingRef.current) return
          processingRef.current = true
          scanner.stop().then(() => setScanning(false)).catch(() => {})
          doCheckIn(decodedText)
        },
        () => {},
      )
      setScanning(true)
    } catch (err) {
      setResult({ success: false, error: 'Không thể mở camera. Vui lòng kiểm tra quyền truy cập.' })
    }
  }

  async function stopScanner() {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  function switchMode(newMode: 'scan' | 'manual') {
    stopScanner()
    setMode(newMode)
    setResult(null)
  }

  const booking = result?.data

  return (
    <div className="max-w-lg mx-auto space-y-6 mt-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-3">
          <div className="p-4 rounded-full bg-[#eab308]/10">
            <ScanLine size={32} className="text-[#eab308]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Check-in vé</h1>
        <p className="text-gray-400 text-sm">Quét mã QR hoặc nhập mã booking</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-[#0a1929] rounded-xl p-1 w-fit mx-auto">
        <button
          onClick={() => switchMode('scan')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'scan' ? 'bg-[#eab308] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Camera size={16} /> Quét QR
        </button>
        <button
          onClick={() => switchMode('manual')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'manual' ? 'bg-[#eab308] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Keyboard size={16} /> Nhập mã
        </button>
      </div>

      {/* QR Scanner Mode */}
      {mode === 'scan' && (
        <div className="space-y-3">
          <div className="bg-[#0a1929] border border-white/5 rounded-xl overflow-hidden">
            <div id="qr-reader" className="w-full" />
            {!scanning && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Camera size={48} className="mb-3 text-gray-600" />
                <p className="text-sm">Nhấn nút bên dưới để mở camera</p>
              </div>
            )}
          </div>
          <Button
            onClick={scanning ? stopScanner : startScanner}
            className={`w-full h-12 font-bold text-base ${
              scanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#eab308] hover:bg-[#ca8a04] text-black'
            }`}
          >
            {scanning ? 'Dừng quét' : 'Bắt đầu quét'}
          </Button>
        </div>
      )}

      {/* Manual Input Mode */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Nhập mã booking (VD: CX-VTA-001)"
            className="bg-[#0a1929] border-white/10 text-white text-center text-2xl font-mono tracking-widest h-14"
            autoFocus
          />
          <Button
            onClick={handleManualCheckIn}
            disabled={!code.trim() || checkInMut.isPending}
            className="w-full h-12 bg-[#eab308] hover:bg-[#ca8a04] text-black font-bold text-base"
          >
            {checkInMut.isPending ? 'Đang xử lý...' : 'Check-in'}
          </Button>
        </div>
      )}

      {/* Success Result */}
      {result?.success && booking && (
        <Card className="bg-green-900/20 border-green-500/40">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={20} />
              <span className="font-semibold">Check-in thành công!</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Mã booking</span>
                <span className="text-white font-mono">{booking.bookingCode ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phim</span>
                <span className="text-white">{booking.movieTitle ?? booking.showtime?.movie?.title ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Suất chiếu</span>
                <span className="text-white">{fmtDateTime(booking.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phòng</span>
                <span className="text-white">{booking.roomName ?? booking.showtime?.room?.name ?? '—'}</span>
              </div>
              {(booking.seats?.length ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Ghế</span>
                  <span className="text-white font-medium">
                    {booking.seats?.map((s) => s.seatNumber ?? s.seatCode ?? '').join(', ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Tổng tiền</span>
                <span className="text-[#eab308] font-semibold">
                  {(booking.totalAmount ?? 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Result */}
      {result?.success === false && (
        <Card className="bg-red-900/20 border-red-500/40">
          <CardContent className="p-5 flex items-center gap-3 text-red-400">
            <XCircle size={20} />
            <span>{result.error}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
