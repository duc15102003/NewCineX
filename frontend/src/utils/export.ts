import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './roboto-font'

export interface ExportColumn {
  header: string
  key: string
  format?: (value: unknown) => string
}

export interface ExportSection {
  label: string
  rows: Record<string, unknown>[]
}

export interface ExportData {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  fileName: string
  sections?: ExportSection[]
}

function createPDF(): jsPDF {
  const doc = new jsPDF()
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto')
  return doc
}

/**
 * Xuất PDF — hỗ trợ nhiều bảng (sections) trong 1 file.
 * Nếu có sections → mỗi section = 1 bảng riêng có tiêu đề phụ.
 * Nếu không có sections → dùng rows trực tiếp (1 bảng duy nhất).
 */
export function exportPDF({ title, subtitle, columns, rows, fileName, sections }: ExportData) {
  const doc = createPDF()

  // Title
  doc.setFontSize(16)
  doc.setTextColor(33, 33, 33)
  doc.text(title, 14, 18)

  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle || `CineX — Xuất ngày ${new Date().toLocaleDateString('vi-VN')}`, 14, 26)

  const tableConfig = {
    styles: { fontSize: 9, cellPadding: 4, font: 'Roboto', textColor: [33, 33, 33] as [number, number, number] },
    headStyles: {
      fillColor: [234, 179, 8] as [number, number, number],
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold' as const,
      halign: 'center' as const,
    },
    columnStyles: { 0: { halign: 'center' as const, cellWidth: 15 } },
    alternateRowStyles: { fillColor: [248, 248, 248] as [number, number, number] },
    margin: { left: 14, right: 14 },
  }

  function renderTable(data: Record<string, any>[], startY: number) {
    autoTable(doc, {
      ...tableConfig,
      startY,
      head: [columns.map(c => c.header)],
      body: data.map(row =>
        columns.map(c => {
          const val = row[c.key]
          return c.format ? c.format(val) : String(val ?? '')
        })
      ),
    })
  }

  if (sections && sections.length > 0) {
    let cursorY = 34
    sections.forEach((section) => {
      if (section.rows.length === 0) return

      // Section label
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(33, 33, 33)

      // Nếu không đủ chỗ cho label + header bảng → sang trang mới
      if (cursorY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage()
        cursorY = 20
      }

      doc.text(section.label, 14, cursorY)
      doc.setFont('Roboto', 'normal')
      cursorY += 6

      renderTable(section.rows, cursorY)

      // Lấy vị trí Y sau bảng vừa vẽ
      const finalY = (doc as any).lastAutoTable?.finalY ?? cursorY + 30
      cursorY = finalY + 12 // Khoảng cách giữa 2 bảng
    })
  } else {
    renderTable(rows, 34)
  }

  // Footer mỗi trang
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160)
    doc.text(
      `CineX — Trang ${i}/${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  doc.save(`${fileName}.pdf`)
}

/**
 * Xuất Excel — nhiều bảng gộp trong 1 sheet, có tiêu đề và subtitle
 */
export function exportExcel({ title, subtitle, columns, rows, fileName, sections }: ExportData) {
  const allRows: any[][] = [
    [title],
    [subtitle || `Xuất ngày ${new Date().toLocaleDateString('vi-VN')}`],
    [],
  ]
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
  ]

  const colHeaders = columns.map(c => c.header)

  function addSection(label: string, data: Record<string, any>[]) {
    // Section label (merged row)
    const labelRowIdx = allRows.length
    allRows.push([label])
    merges.push({ s: { r: labelRowIdx, c: 0 }, e: { r: labelRowIdx, c: columns.length - 1 } })

    // Column headers
    allRows.push(colHeaders)

    // Data rows
    data.forEach(row => {
      allRows.push(columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : (val ?? '')
      }))
    })

    allRows.push([]) // Dòng trống giữa sections
  }

  if (sections && sections.length > 0) {
    sections.forEach(s => {
      if (s.rows.length > 0) addSection(s.label, s.rows)
    })
  } else {
    allRows.push(colHeaders)
    rows.forEach(row => {
      allRows.push(columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : (val ?? '')
      }))
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!merges'] = merges

  // Auto column width
  const colWidths = columns.map((c, idx) => {
    const maxLen = Math.max(
      c.header.length * 2,
      ...rows.map(r => String(r[c.key] ?? '').length),
      ...(sections ?? []).flatMap(s => s.rows.map(r => String(r[c.key] ?? '').length)),
      0,
    )
    return { wch: Math.max(maxLen, idx === 0 ? 5 : 12) + 4 }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${fileName}.xlsx`)
}
