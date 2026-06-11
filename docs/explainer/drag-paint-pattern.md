# Drag-Paint Pattern — Giữ chuột để vẽ cells

> **Mục đích:** giải thích pattern "click + giữ chuột kéo để paint nhiều ô" mà CineX dùng trong Seat Map Editor + Generate Seats Dialog Custom mode. Sau khi đọc bạn hiểu được cách Photoshop / Excel / Figma làm sao giữ chuột paint nhanh hàng trăm cells.

---

## TL;DR

**Không phải công nghệ riêng — là kết hợp 3 thứ vanilla:**
1. **JavaScript DOM Mouse Events** (chuẩn web 1995)
2. **State machine pattern** — 1 boolean `isDragging`
3. **React hooks** — `useState` + `useCallback`

Không cần lib ngoài. Code thuần ~30 dòng.

---

## 1. Bài toán

CineX có Seat Map Editor 100-500 ghế. Nếu admin click từng ô để đổi loại → chuột bị mỏi sau 100 click. Cần cách **paint nhiều cells nhanh**.

Pattern industry: **giữ chuột kéo qua các ô** → paint hàng loạt. Như brush tool Photoshop.

---

## 2. Ví dụ đời thường

**Sơn tường:**
- Nhúng cọ vào sơn (mouse DOWN — bắt đầu "đang sơn")
- Kéo cọ qua tường (mouse MOVE — sơn từng vị trí)
- Nhấc cọ ra (mouse UP — kết thúc "đang sơn")

→ Cọ chỉ sơn KHI VÀ CHỈ KHI bạn đang giữ + di chuyển. Nhấc cọ ra → không sơn nữa.

Code mirror đời thường:
- `mousedown` = nhúng cọ
- `mouseenter` = cọ chạm cell mới
- `mouseup` = nhấc cọ

---

## 3. Mouse Events nền tảng

3 event quan trọng nhất:

| Event | Khi nào fire? | Tương ứng cọ sơn |
|---|---|---|
| `mousedown` | Bấm chuột XUỐNG (chưa nhả) | Nhúng cọ vào sơn |
| `mouseenter` | Chuột MOVE VÀO element (không cần bấm) | Cọ chạm vị trí mới |
| `mouseup` | NHẢ chuột (kết thúc giữ) | Nhấc cọ ra |

**Plus 2 event phụ:**
- `mouseleave` — chuột ra khỏi element (cleanup edge case)
- `contextmenu` — chuột phải (nếu muốn right-click eraser)

### Khác `click` event như nào?

`click` = mousedown + mouseup TRÊN CÙNG element. Trigger sau khi nhả chuột.
`mousedown` = ngay khi bấm, KHÔNG đợi nhả.

→ Pattern paint cần `mousedown` (immediate feedback) + `mouseenter` (move while held), KHÔNG dùng `click`.

---

## 4. State Machine

Cần 1 boolean state: `isDragging`.

```
              mousedown
   IDLE ─────────────────────▶ DRAGGING
    ▲                              │
    │      mouseup / mouseleave    │
    └──────────────────────────────┘
```

- IDLE: chuột không nhấn → mouseenter KHÔNG paint
- DRAGGING: đang giữ chuột → mouseenter paint cell hover

---

## 5. Code thật trong CineX (giản lược)

```typescript
function CustomPanel() {
  const [isDragging, setIsDragging] = useState(false)
  const [cells, setCells] = useState<Map<string, SeatType>>(new Map())
  const [tool, setTool] = useState<SeatType>('STANDARD')

  // Apply tool hiện tại lên 1 cell
  function applyTool(rowLabel: string, col: number) {
    setCells(prev => {
      const next = new Map(prev)
      next.set(`${rowLabel}:${col}`, tool)
      return next
    })
  }

  return (
    // onMouseUp / onMouseLeave ở PARENT để bắt mọi case "kết thúc kéo"
    <div
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      className="select-none"  // chặn highlight text khi kéo
    >
      {rows.map(row =>
        cols.map(col => (
          <button
            key={`${row}:${col}`}
            // 1. Bấm xuống → bật flag + paint ô đầu tiên
            onMouseDown={() => {
              setIsDragging(true)
              applyTool(row, col)
            }}
            // 2. Move vào ô khác (đang giữ) → paint tiếp
            onMouseEnter={() => {
              if (isDragging) applyTool(row, col)
            }}
            className={SEAT_BG[cells.get(`${row}:${col}`) ?? 'STANDARD']}
          />
        ))
      )}
    </div>
  )
}
```

**4 lưu ý quan trọng** (xem mục 6 cho chi tiết):
1. `onMouseUp` + `onMouseLeave` ở **PARENT div**, không phải button
2. `select-none` chống highlight text
3. State update phải PURE (không side effect như `toast`)
4. `useCallback` cho handler nếu cell nhiều (500+)

---

## 6. Các bẫy gặp phổ biến

### Bẫy 1: `onMouseUp` đặt sai chỗ

```typescript
// SAI: chỉ button bắt mouseup
<button onMouseUp={() => setIsDragging(false)} />
```

**Triệu chứng:** User bấm xuống ô A, kéo ra ngoài grid, nhả chuột ở vùng trống → `mouseup` KHÔNG fire trên button A → `isDragging` kẹt `true` mãi → click tiếp lại paint không cần giữ.

**Fix:** mouseUp ở PARENT bắt mọi nơi:

```typescript
<div onMouseUp={() => setIsDragging(false)}>
  <button ... />
</div>
```

### Bẫy 2: Quên `onMouseLeave` parent

```typescript
// THIẾU mouseLeave
<div onMouseUp={...}>
```

**Triệu chứng:** User kéo chuột ra NGOÀI cửa sổ browser → nhả chuột (browser không gửi event vào page nữa) → `isDragging` kẹt true.

**Fix:**
```typescript
<div onMouseUp={() => setIsDragging(false)}
     onMouseLeave={() => setIsDragging(false)}>
```

### Bẫy 3: Browser highlight text khi kéo

User kéo chuột → browser highlight text ngẫu nhiên trên page → annoying + clipboard nhiễu.

**Fix:** `user-select: none` (Tailwind: `select-none`):

```typescript
<div className="select-none">  // ← chặn text selection
```

### Bẫy 4: HTML5 native drag-and-drop interfere

Button mặc định có thể trigger HTML5 `dragstart` (drag để move element) → conflict với drag-paint.

**Fix:**
```typescript
<button draggable={false} />
```

### Bẫy 5: Side effect trong `setState` updater — TOAST 2 LẦN

```typescript
// SAI: toast bên trong updater
function applyTool(row, col) {
  setCells(prev => {
    if (someValidation) {
      toast.warning('Invalid')  // ← React StrictMode chạy 2 lần → toast 2 lần!
      return prev
    }
    return new Map(prev).set(`${row}:${col}`, tool)
  })
}
```

**Triệu chứng:** Trong dev mode (React StrictMode), toast hiển thị 2 lần khi user click invalid cell.

**Root cause:** React StrictMode chạy updater function 2 LẦN để verify pure/idempotent. Updater có side effect (toast) → side effect chạy 2 lần.

**Fix:** Validate + side effect NGOÀI updater, chỉ state update trong:

```typescript
function applyTool(row, col) {
  // 1. Validate + side effect outside
  if (someValidation) {
    toast.warning('Invalid')
    return  // skip state update
  }
  // 2. Pure state update inside
  setCells(prev => new Map(prev).set(`${row}:${col}`, tool))
}
```

### Bẫy 6: Performance với grid lớn (500+ cells)

Mỗi cell có inline arrow function → re-render mọi cell khi `isDragging` đổi.

```typescript
// SAI: arrow function tạo mới mỗi render
<button onMouseEnter={() => { if (isDragging) applyTool(row, col) }} />
```

**Fix:** `useCallback` + truyền `row/col` qua data attribute:

```typescript
const handleMouseEnter = useCallback((e: MouseEvent) => {
  if (!isDragging) return
  const target = e.currentTarget as HTMLElement
  const row = target.dataset.row!
  const col = Number(target.dataset.col!)
  applyTool(row, col)
}, [isDragging, applyTool])

<button data-row={row} data-col={col} onMouseEnter={handleMouseEnter} />
```

CineX hiện grid tối đa 26×30 = 780 cells — chấp nhận inline arrow ok. Nếu sau này có rạp 1000+ ghế thì optimize.

---

## 7. Code trong CineX — file:line

| File | Chức năng |
|---|---|
| `frontend/src/features/admin/components/GenerateSeatsDialog.tsx` `applyTool()` | Drag-paint trong Custom panel để tạo layout từ trống |
| `frontend/src/features/admin/SeatMapEditorPage.tsx` `applySeatChange()` | Drag-paint trong Editor để chỉnh sửa layout đã tạo |
| `frontend/src/features/admin/components/SeatEditorGrid.tsx` | UI grid render cells với mouse handlers |

Pattern giống nhau ở 2 component. Code duplicate là chấp nhận vì:
- Dialog dùng grid 20×20px cells với data state là `Map<string, SeatTypeKey>` (in-memory)
- Editor dùng grid 36×36px cells với data state là `Map<seatId, SeatTypeKey>` (db ids)
- Khác data structure → tách 2 component dễ maintain hơn share component.

---

## 8. So sánh với pattern khác

| Pattern | Library | Khi nào dùng |
|---|---|---|
| **Drag-paint** (CineX) | Vanilla JS + React state | Paint cells trên grid (seat editor, pixel art, Excel cell select) |
| **HTML5 Drag & Drop API** | Native browser | Drag để MOVE item (file upload, kanban) |
| **react-dnd** | Library | Drag-drop phức tạp với multiple drop zones |
| **react-draggable** | Library | Drag để move element (modal position, sidebar resize) |
| **Pointer Events** | Modern web API | Unified mouse + touch (Figma, Miro mobile) |
| **Lasso select** | Custom + canvas | Vẽ vùng chữ nhật/free-form (Photoshop, Figma) |

### HTML5 Drag-and-Drop khác Drag-paint thế nào?

```typescript
// HTML5 Drag-and-Drop — drag để DI CHUYỂN
<div draggable onDragStart={...} onDragEnd={...} />
<div onDrop={...} onDragOver={...} />  // drop zone
```

- Mục đích: di chuyển 1 item từ A → B (file upload, Trello card)
- Phức tạp: data transfer object, drag image, effectAllowed
- Có animation drag preview

**Drag-paint khác:**
- Mục đích: tô màu nhiều item theo chuỗi
- Đơn giản: chỉ track `isDragging` boolean
- Không có drag preview

---

## 9. Industry use cases — bạn vừa code mini Photoshop

| App | Use case |
|---|---|
| **Photoshop** | Paint brush — giữ chuột paint pixels |
| **Excel / Google Sheets** | Click + drag để select range cells |
| **Figma / Sketch** | Vùng select (lasso) — giữ chuột paint area |
| **Pixel art editors** (Aseprite, Piskel) | Drag-paint pixel theo brush |
| **Minesweeper-style games** | Drag-paint flags |
| **Tile editors** (Tiled, Unity Tilemap) | Drag-paint tilemap |
| **Spreadsheet conditional formatting** | Drag-select cells để apply rule |

→ Bạn vừa implement cùng pattern các tool industry dùng. Nguyên lý đơn giản: 3 mouse events + 1 boolean state.

---

## 10. Nâng cấp tương lai

### 10.1. Touch support (mobile/tablet)

Mouse events KHÔNG fire trên touchscreen. Chuyển sang **Pointer Events** — unified API:

```typescript
// Mouse events
onMouseDown / onMouseEnter / onMouseUp

// Pointer events (mouse + touch + stylus)
onPointerDown / onPointerEnter / onPointerUp
```

Pointer Events: same logic, work cả desktop + iPad/Android.

### 10.2. Right-click eraser (như Photoshop)

```typescript
onMouseDown={(e) => {
  if (e.button === 2) {  // right click
    eraseCell(row, col)
    return
  }
  setIsDragging(true)
  applyTool(row, col)
}}
onContextMenu={(e) => e.preventDefault()}  // chặn menu chuột phải
```

### 10.3. Undo/Redo history

```typescript
const [history, setHistory] = useState<Map<string, Type>[]>([])

function handleMouseUp() {
  setIsDragging(false)
  setHistory(h => [...h, new Map(cells)])  // snapshot mỗi end-of-drag
}

function undo() {
  if (history.length === 0) return
  const last = history[history.length - 1]
  setCells(last)
  setHistory(h => h.slice(0, -1))
}
```

### 10.4. Box select (kéo chữ nhật chọn vùng)

Track `startCell` ở mousedown, `currentCell` ở mouseenter:

```typescript
function handleMouseEnter(row, col) {
  if (!isDragging || !startCell) return
  // Highlight tất cells trong chữ nhật (startCell, currentCell)
  const minRow = Math.min(startCell.row, row)
  const maxRow = Math.max(startCell.row, row)
  const minCol = Math.min(startCell.col, col)
  const maxCol = Math.max(startCell.col, col)
  setHighlighted(rangeOf(minRow, maxRow, minCol, maxCol))
}
```

Apply tool lên vùng khi mouseup.

### 10.5. Shift+click range

```typescript
function handleClick(row, col, e) {
  if (e.shiftKey && lastClicked) {
    // Apply tool từ lastClicked đến (row, col)
    applyToolRange(lastClicked, { row, col })
  } else {
    applyTool(row, col)
    setLastClicked({ row, col })
  }
}
```

---

## 11. Câu hỏi tự kiểm tra

1. **Tại sao `onMouseUp` đặt ở parent, không phải button?**
   → Vì user có thể nhả chuột ngoài grid → button không bắt được event → `isDragging` kẹt true. Parent có scope rộng hơn bắt mọi vị trí.

2. **`mouseenter` khác `mousemove` ở đâu?**
   → `mouseenter` chỉ fire 1 lần khi chuột VÀO element. `mousemove` fire LIÊN TỤC mỗi pixel chuột di chuyển trong element (60+ events/giây). Pattern paint chỉ cần 1 event/cell → `mouseenter` phù hợp + nhẹ performance.

3. **Tại sao `select-none` cần thiết?**
   → Browser mặc định cho user highlight text khi drag → kéo chuột trên text = select text = vẽ ô khó chịu + clipboard có text rác.

4. **`useCallback` cần ở đâu?**
   → Cho mouse handler nếu grid 500+ cells, để không tạo function mới mỗi render. Plus dependencies array đúng (`[isDragging, applyTool]`).

5. **Vì sao React StrictMode chạy updater 2 lần?**
   → Để verify updater là pure (idempotent — same input → same output). Pattern này giúp catch bug side-effect-in-updater trước khi prod.

6. **Sự khác biệt giữa drag-paint và HTML5 Drag-and-Drop?**
   → Drag-paint: paint nhiều cells. HTML5 DnD: move 1 item từ A → B (file upload, Trello). Khác cả mục đích và API.

7. **Khi nào nên chuyển sang Pointer Events?**
   → Khi app cần support mobile/tablet (touch). Pointer Events unified mouse + touch + stylus với cùng API.

8. **Tại sao CineX tách 2 component (Dialog Custom + Editor) cùng pattern?**
   → Data structure khác (`Map<string, type>` in-memory vs `Map<seatId, type>` DB). Share component sẽ generic quá → maintain khó. Code duplicate 30 dòng là acceptable trade-off.

---

## 12. Tham khảo

- [MDN Mouse Events](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [React StrictMode behavior](https://react.dev/reference/react/StrictMode)
- [HTML5 Drag and Drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
