import jsPDF from 'jspdf'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './roboto-font'
import { fmtVnd, fmtDateTime, fmtTime, fmtDate } from './labels'
import type { ReceiptData } from '@/features/admin/components/ReceiptDialog'

interface Options {
  theaterName?: string | null
  cashierName?: string | null
  /**
   * Số phút khuyến nghị đến sớm trước giờ chiếu — đọc từ system_config
   * `ticket.arrive_early_minutes`. Default 15 nếu không truyền (fallback an
   * toàn khi caller quên hoặc config chưa fetch xong).
   */
  arriveEarlyMinutes?: number
}

const W = 80                 // mm — khổ thermal 80mm chuẩn rạp
const MARGIN = 5
const CONTENT_W = W - MARGIN * 2

// Color palette — match UI design system, nhưng softer cho giấy in
const COLOR_GOLD: [number, number, number] = [197, 136, 0]      // #c58800 — gold đậm hơn cho đọc trên giấy
const COLOR_BLACK: [number, number, number] = [20, 20, 20]
const COLOR_GRAY: [number, number, number] = [115, 115, 115]
const COLOR_LIGHT_GRAY: [number, number, number] = [220, 220, 220]
const COLOR_BG_HIGHLIGHT: [number, number, number] = [253, 247, 226]  // amber-50 cho box tổng

/**
 * Xuất PDF hoá đơn / vé thermal 80mm — chiều cao tự động theo nội dung.
 *
 * <p>Kỹ thuật: render 2 lần.
 *   1. Lần 1 vào doc tạm để đo finalY thực tế.
 *   2. Lần 2 vào doc thật với page size [80, finalY + padding] → không bị trắng cuối.
 *
 * <p>Hỗ trợ tiếng Việt qua font Roboto đã embed.
 */
export function downloadReceiptPDF(data: ReceiptData, opts: Options = {}): void {
  // Lần 1: đo
  const measureDoc = createDoc(200)
  const finalY = renderReceipt(measureDoc, data, opts)

  // Lần 2: render thật, page size khít với nội dung
  const realDoc = createDoc(Math.ceil(finalY + 4))
  renderReceipt(realDoc, data, opts)

  const fileName = data.kind === 'TICKET'
    ? `ve-${data.bookingCode}.pdf`
    : `hd-${data.orderCode}.pdf`
  realDoc.save(fileName)
}

function createDoc(heightMm: number): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: [W, heightMm] })
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
  return doc
}

/**
 * Render toàn bộ receipt — return finalY (mm). Dùng chung cho cả measure pass
 * và real pass. Giữ pure (không global state).
 */
function renderReceipt(doc: jsPDF, data: ReceiptData, opts: Options): number {
  let y = 7
  const isTicket = data.kind === 'TICKET'

  // ============ HEADER ============
  setColor(doc, COLOR_GOLD)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(22)
  doc.text('CINEX', W / 2, y, { align: 'center' })
  y += 6

  if (opts.theaterName) {
    setColor(doc, COLOR_BLACK)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.text(opts.theaterName, W / 2, y, { align: 'center' })
    y += 3.5
  }

  setColor(doc, COLOR_GRAY)
  doc.setFontSize(7.5)
  doc.text(isTicket ? '— VÉ XEM PHIM —' : '— HOÁ ĐƠN BÁN HÀNG —', W / 2, y, { align: 'center' })
  y += 4

  y = dashedDivider(doc, y)

  // ============ META INFO ============
  setColor(doc, COLOR_BLACK)
  y = labelValueRow(doc, y, `Mã ${isTicket ? 'vé' : 'đơn'}`, isTicket ? data.bookingCode : data.orderCode, { valueBold: true, valueMono: true })
  y = labelValueRow(doc, y, 'Thời gian', fmtDateTime(data.paidAt))
  if (!isTicket && opts.cashierName) {
    y = labelValueRow(doc, y, 'NV phục vụ', opts.cashierName)
  }
  y += 1
  y = dashedDivider(doc, y)

  // ============ BODY ============
  if (isTicket) {
    y = renderTicketBody(doc, y, data)
  } else {
    y = renderSnackBody(doc, y, data)
  }

  // ============ TOTAL HIGHLIGHT ============
  y += 2
  y = renderTotalBox(doc, y, data.total)

  // ============ FOOTER ============
  y += 3
  y = dashedDivider(doc, y, COLOR_LIGHT_GRAY)
  setColor(doc, COLOR_GRAY)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(7.5)
  const arrive = opts.arriveEarlyMinutes ?? 15
  const footerLine1 = isTicket ? `Đến sớm ${arrive} phút trước giờ chiếu` : 'Cảm ơn quý khách'
  const footerLine2 = isTicket ? 'Trình mã vé này tại cổng soát vé' : 'Hẹn gặp lại'
  doc.text(footerLine1, W / 2, y, { align: 'center' })
  y += 3
  doc.setFont('Roboto', 'normal')
  doc.text(footerLine2, W / 2, y, { align: 'center' })
  y += 2

  return y
}

function renderTicketBody(doc: jsPDF, y0: number, data: Extract<ReceiptData, { kind: 'TICKET' }>): number {
  let y = y0
  setColor(doc, COLOR_BLACK)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  const titleLines = doc.splitTextToSize(data.movieTitle.toUpperCase(), CONTENT_W)
  titleLines.forEach((line: string) => {
    doc.text(line, W / 2, y, { align: 'center' })
    y += 4.5
  })
  y += 1

  setColor(doc, COLOR_BLACK)
  y = labelValueRow(doc, y, 'Suất', `${fmtTime(data.startTime)} · ${fmtDate(data.startTime)}`)
  y = labelValueRow(doc, y, 'Phòng', data.roomName)
  y += 1
  y = dashedDivider(doc, y)

  // Header "Ghế (N):"
  setColor(doc, COLOR_BLACK)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(9)
  doc.text(`Ghế (${data.seats.length}):`, MARGIN, y)
  y += 4

  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  data.seats.forEach(s => {
    // Cột trái: seat code + type. Cột phải: giá.
    const left = `${s.seatNumber}`
    const typeShort = s.seatType.toLowerCase()
    doc.text(left, MARGIN + 1, y)
    setColor(doc, COLOR_GRAY)
    doc.setFontSize(7.5)
    doc.text(`(${typeShort})`, MARGIN + 1 + doc.getTextWidth(left) + 1.5, y)
    setColor(doc, COLOR_BLACK)
    doc.setFontSize(8.5)
    doc.text(fmtVnd(s.price), W - MARGIN, y, { align: 'right' })
    y += 4
  })
  y += 1

  y = labelValueRow(doc, y, 'Phương thức', paymentLabel(data.paymentMethod).toUpperCase(), { valueBold: true })
  return y
}

function renderSnackBody(doc: jsPDF, y0: number, data: Extract<ReceiptData, { kind: 'SNACK' }>): number {
  let y = y0
  setColor(doc, COLOR_BLACK)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  data.items.forEach(it => {
    // Line: [tag CB] tên × số → giá
    const isCombo = it.kind === 'COMBO'
    const tag = isCombo ? '[CB] ' : ''
    const fullText = `${tag}${it.name}`
    // Wrap tên (cột trái 65% rộng, dành cột phải cho giá)
    const nameLines = doc.splitTextToSize(fullText, CONTENT_W * 0.7)
    const priceText = fmtVnd(it.price * it.quantity)
    const qtyText = `× ${it.quantity}`

    // Render dòng đầu: tên + qty + price
    if (isCombo) {
      // Tag [CB] màu tím nhạt — but PDF mono nên dùng bold đen
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(7)
      doc.text('CB', MARGIN, y - 0.3)
      doc.rect(MARGIN - 0.5, y - 3, 4, 3.5)
      doc.setFontSize(8.5)
    }
    doc.setFont('Roboto', 'normal')
    const namePrefix = isCombo ? '     ' : ''
    doc.text(`${namePrefix}${nameLines[0]}`, MARGIN, y)

    setColor(doc, COLOR_GRAY)
    doc.setFontSize(7.5)
    const qtyX = MARGIN + doc.getTextWidth(`${namePrefix}${nameLines[0]}`) + 1
    doc.text(qtyText, qtyX, y)

    setColor(doc, COLOR_BLACK)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.text(priceText, W - MARGIN, y, { align: 'right' })
    y += 4

    // Các dòng tiếp theo nếu tên quá dài
    for (let i = 1; i < nameLines.length; i++) {
      doc.text(`     ${nameLines[i]}`, MARGIN, y)
      y += 4
    }
  })

  if (data.note) {
    y += 1
    setColor(doc, COLOR_BLACK)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8)
    doc.text('Ghi chú:', MARGIN, y)
    y += 3.5
    doc.setFont('Roboto', 'normal')
    const noteLines = doc.splitTextToSize(data.note, CONTENT_W)
    noteLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 3.5
    })
  }
  return y
}

/**
 * Tổng tiền — render trong box vàng nhạt để nổi bật. Match style "highlight"
 * trên UI dialog (bg-[#ffc107]/10 border).
 */
function renderTotalBox(doc: jsPDF, y0: number, total: number): number {
  const boxH = 9
  // Background fill
  setFill(doc, COLOR_BG_HIGHLIGHT)
  doc.rect(MARGIN - 0.5, y0 - 1, CONTENT_W + 1, boxH, 'F')

  // Top + bottom border vàng đậm
  setColor(doc, COLOR_GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGIN - 0.5, y0 - 1, W - MARGIN + 0.5, y0 - 1)
  doc.line(MARGIN - 0.5, y0 - 1 + boxH, W - MARGIN + 0.5, y0 - 1 + boxH)

  // Text
  setColor(doc, COLOR_BLACK)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(10)
  doc.text('TỔNG TIỀN', MARGIN + 1, y0 + 4.5)

  setColor(doc, COLOR_GOLD)
  doc.setFontSize(12)
  doc.text(fmtVnd(total), W - MARGIN - 1, y0 + 4.8, { align: 'right' })

  setColor(doc, COLOR_BLACK)
  doc.setLineWidth(0.2)
  return y0 + boxH + 1
}

function labelValueRow(
  doc: jsPDF, y: number, label: string, value: string,
  opts: { valueBold?: boolean; valueMono?: boolean } = {},
): number {
  setColor(doc, COLOR_GRAY)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.text(label, MARGIN, y)

  setColor(doc, COLOR_BLACK)
  doc.setFont(opts.valueMono ? 'Courier' : 'Roboto', opts.valueBold ? 'bold' : 'normal')
  doc.setFontSize(opts.valueMono ? 9 : 8.5)
  doc.text(value, W - MARGIN, y, { align: 'right' })

  doc.setFont('Roboto', 'normal')
  return y + 4
}

/**
 * Dashed divider — màu mặc định gray nhạt. Pattern dash 1.2mm + gap 0.8mm.
 */
function dashedDivider(doc: jsPDF, y: number, color: [number, number, number] = COLOR_GRAY): number {
  setColor(doc, color)
  doc.setLineWidth(0.2)
  const dash = 1.2
  const gap = 0.8
  let x = MARGIN
  while (x < W - MARGIN) {
    doc.line(x, y, Math.min(x + dash, W - MARGIN), y)
    x += dash + gap
  }
  return y + 2.5
}

function setColor(doc: jsPDF, c: [number, number, number]): void {
  doc.setTextColor(c[0], c[1], c[2])
  doc.setDrawColor(c[0], c[1], c[2])
}

function setFill(doc: jsPDF, c: [number, number, number]): void {
  doc.setFillColor(c[0], c[1], c[2])
}

function paymentLabel(method: string): string {
  switch (method) {
    case 'CASH': return 'Tiền mặt'
    case 'MOMO': return 'MoMo'
    case 'CARD': return 'Thẻ'
    default: return method
  }
}
