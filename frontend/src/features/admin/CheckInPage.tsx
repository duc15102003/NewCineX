import { useState, useEffect, useRef } from 'react'
import { useCheckIn, usePreviewCheckIn, useRejectCheckIn, type AdminBooking } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle2, XCircle, ScanLine, Keyboard, Camera, AlertTriangle, IdCard, X,
} from 'lucide-react'
import {
  fmtDateTime, fmtVnd, needsAgeConfirm, AGE_RATING_LABELS, AGE_RATING_MIN_AGE,
} from '@/utils/labels'
import { getErrorMessage } from '@/api/axios'
import { Html5Qrcode } from 'html5-qrcode'

type Result =
  | { kind: 'IDLE' }
  | { kind: 'PREVIEW'; booking: AdminBooking }         // chờ admit/reject
  | { kind: 'ADMITTED'; booking: AdminBooking }
  | { kind: 'REJECTED'; booking: AdminBooking }
  | { kind: 'ERROR'; message: string }

export default function CheckInPage() {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [code, setCode] = useState('')
  const [result, setResult] = useState<Result>({ kind: 'IDLE' })
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processingRef = useRef(false)

  const previewMut = usePreviewCheckIn()
  const checkInMut = useCheckIn()
  const rejectMut = useRejectCheckIn()

  /**
   * Chuẩn industry Vista/Veezi: scan/nhập code → preview info → staff verify CCCD vật lý
   * → click Admit (cho vào) hoặc Reject (từ chối, vd không đủ tuổi). Phim P/K → auto-admit
   * để giữ tốc độ check-in. T13+ → bắt buộc qua preview để staff kiểm tra CCCD trước.
   */
  function doScan(scannedCode: string) {
    if (!scannedCode.trim()) return
    setResult({ kind: 'IDLE' })
    previewMut.mutate(scannedCode.trim(), {
      onSuccess: (booking) => {
        if (booking.status === 'CHECKED_IN') {
          setResult({ kind: 'ERROR', message: 'Vé đã được sử dụng' })
          return
        }
        if (booking.status === 'REJECTED') {
          setResult({ kind: 'ERROR', message: 'Vé đã bị từ chối tại cổng trước đó' })
          return
        }
        if (booking.status !== 'CONFIRMED') {
          setResult({ kind: 'ERROR', message: `Vé chưa thể check-in, trạng thái: ${booking.status}` })
          return
        }
        // P/K → auto-admit; T13+ → bắt staff verify CCCD trước
        if (!needsAgeConfirm(booking.movieAgeRating)) {
          doAdmit(scannedCode.trim())
          return
        }
        setResult({ kind: 'PREVIEW', booking })
      },
      onError: (e) => setResult({ kind: 'ERROR', message: getErrorMessage(e, 'Không tìm thấy vé') }),
    })
  }

  function doAdmit(bookingCode: string) {
    checkInMut.mutate(bookingCode, {
      onSuccess: (booking) => {
        setResult({ kind: 'ADMITTED', booking })
        setCode('')
        stopScanner()
      },
      onError: (e) => setResult({ kind: 'ERROR', message: getErrorMessage(e, 'Check-in thất bại') }),
    })
  }

  function doReject(bookingCode: string) {
    rejectMut.mutate({ code: bookingCode, reason: 'UNDER_AGE' }, {
      onSuccess: (booking) => {
        setResult({ kind: 'REJECTED', booking })
        setCode('')
        stopScanner()
      },
      onError: (e) => setResult({ kind: 'ERROR', message: getErrorMessage(e, 'Từ chối thất bại') }),
    })
  }

  function handleManualSubmit() {
    doScan(code)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleManualSubmit()
  }

  async function startScanner() {
    setResult({ kind: 'IDLE' })
    processingRef.current = false
    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (processingRef.current) return
          processingRef.current = true
          scanner.stop().then(() => setScanning(false)).catch(() => {})
          doScan(decodedText)
        },
        () => {},
      )
      setScanning(true)
    } catch {
      setResult({ kind: 'ERROR', message: 'Không thể mở camera. Vui lòng kiểm tra quyền truy cập.' })
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
    setResult({ kind: 'IDLE' })
  }

  function resetResult() {
    setResult({ kind: 'IDLE' })
    setCode('')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 mt-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-3">
          <div className="p-4 rounded-full bg-[#ffc107]/10">
            <ScanLine size={32} className="text-[#ffc107]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Check-in vé</h1>
        <p className="text-gray-400 text-sm">Quét mã QR hoặc nhập mã booking</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-[#201b11] rounded-2xl p-1 w-fit mx-auto">
        <button
          onClick={() => switchMode('scan')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'scan' ? 'bg-[#ffc107] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Camera size={16} /> Quét QR
        </button>
        <button
          onClick={() => switchMode('manual')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'manual' ? 'bg-[#ffc107] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Keyboard size={16} /> Nhập mã
        </button>
      </div>

      {/* QR Scanner Mode */}
      {mode === 'scan' && (
        <div className="space-y-3">
          <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl overflow-hidden">
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
            className={`w-full h-11 font-semibold text-sm rounded-lg ${
              scanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#ffc107] hover:bg-[#e6ac06] text-black'
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
            className="bg-[#2a2317] border-white/10 text-white text-center text-2xl font-mono tracking-widest h-14 focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107]"
            autoFocus
          />
          <Button
            onClick={handleManualSubmit}
            disabled={!code.trim() || previewMut.isPending || checkInMut.isPending}
            className="w-full h-11 bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
          >
            {previewMut.isPending ? 'Đang tra cứu...' : 'Tra cứu vé'}
          </Button>
        </div>
      )}

      {/* PREVIEW — phim T13+ cần staff verify CCCD trước khi admit */}
      {result.kind === 'PREVIEW' && (
        <Card className="bg-orange-900/20 border-orange-500/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle size={20} />
                <span className="font-semibold">Yêu cầu xác minh độ tuổi</span>
              </div>
              <button onClick={resetResult} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Big age badge */}
            <div className="flex items-center gap-3 bg-[#2a2317] border border-orange-500/30 rounded-lg p-3">
              <div className="w-14 h-14 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                <span className="text-orange-300 font-bold text-xl">{result.booking.movieAgeRating}</span>
              </div>
              <div className="flex-1">
                <p className="text-amber-50 font-medium">{result.booking.movieTitle}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {AGE_RATING_LABELS[result.booking.movieAgeRating ?? ''] ?? ''}
                  {' · '}Yêu cầu từ <span className="text-orange-300 font-medium">
                    {AGE_RATING_MIN_AGE[result.booking.movieAgeRating ?? ''] ?? 18}
                  </span> tuổi
                </p>
              </div>
            </div>

            {/* Booking info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Mã booking</span>
                <span className="text-white font-mono">{result.booking.bookingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Suất chiếu</span>
                <span className="text-white">{fmtDateTime(result.booking.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phòng</span>
                <span className="text-white">{result.booking.roomName}</span>
              </div>
            </div>

            <div className="flex gap-2 bg-[#201b11] border border-[#3f382d] rounded-lg p-3">
              <IdCard size={18} className="text-[#ffc107] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300 leading-relaxed">
                Yêu cầu khách xuất trình <span className="text-amber-50 font-medium">CCCD/CMND</span>{' '}
                để xác minh đủ tuổi trước khi cho vào.
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                onClick={() => doReject(result.booking.bookingCode)}
                disabled={rejectMut.isPending || checkInMut.isPending}
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg h-11 font-semibold"
              >
                {rejectMut.isPending ? 'Đang từ chối...' : 'Từ chối — không đủ tuổi'}
              </Button>
              <Button
                onClick={() => doAdmit(result.booking.bookingCode)}
                disabled={rejectMut.isPending || checkInMut.isPending}
                className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg h-11"
              >
                {checkInMut.isPending ? 'Đang xử lý...' : 'Đủ tuổi — Cho vào'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADMITTED — success */}
      {result.kind === 'ADMITTED' && (
        <Card className="bg-green-900/20 border-green-500/40">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={20} />
                <span className="font-semibold">Check-in thành công!</span>
              </div>
              <button onClick={resetResult} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Mã booking</span>
                <span className="text-white font-mono">{result.booking.bookingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phim</span>
                <span className="text-white">{result.booking.movieTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Suất chiếu</span>
                <span className="text-white">{fmtDateTime(result.booking.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phòng</span>
                <span className="text-white">{result.booking.roomName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tổng tiền</span>
                <span className="text-[#ffc107] font-semibold">{fmtVnd(result.booking.totalAmount ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REJECTED — staff đã từ chối */}
      {result.kind === 'REJECTED' && (
        <Card className="bg-red-900/20 border-red-500/40">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle size={20} />
                <span className="font-semibold">Đã từ chối — không đủ tuổi</span>
              </div>
              <button onClick={resetResult} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="text-xs text-red-200/70 bg-red-500/5 border border-red-500/20 rounded-lg p-3 leading-relaxed">
              Đơn <span className="font-mono">{result.booking.bookingCode}</span> đã chuyển sang trạng thái
              "Từ chối tại cổng". Theo quy định không hoàn tiền.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ERROR */}
      {result.kind === 'ERROR' && (
        <Card className="bg-red-900/20 border-red-500/40">
          <CardContent className="p-5 flex items-center gap-3 text-red-400">
            <XCircle size={20} />
            <span className="flex-1">{result.message}</span>
            <button onClick={resetResult} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
