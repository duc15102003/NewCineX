# Spec: Audit toàn bộ docs CineX — phát hiện gap kiến thức cho người mới

**Ngày:** 2026-06-08
**Người yêu cầu:** VuTuongAn (sinh viên năm 4 CNTT, đồ án tốt nghiệp)
**Phạm vi:** 70+ files docs trong `/Users/vutuongan/cinex/docs/`

---

## 1. Bối cảnh

CineX docs đã expand lên ~54k dòng qua 5 lần nâng cấp trước. Tuy nhiên, mục tiêu của user là docs phải **dạy được người chưa biết gì** (sinh viên mới học) và đủ sâu như giáo trình đại học. Cần kiểm tra xem mục tiêu đó đã đạt chưa.

## 2. Vấn đề

Hiện không có cái nhìn tổng quan "file nào còn yếu, file nào ổn". Việc expand bừa sẽ:
- Lặp lại nội dung đã có
- Bỏ sót khái niệm nền tảng quan trọng (vì cảm thấy "ai cũng biết")
- Code citations `file:line` có thể đã lệch so với code hiện tại

## 3. Mục tiêu

Tạo **1 báo cáo audit** (`/docs/00-audit-knowledge-gaps.md`) liệt kê chi tiết:
- Mỗi trong 70+ files: priority P1/P2/P3, thiếu kiến thức gì, đề xuất expand gì
- Bảng tổng kết: nhóm nào cần ưu tiên expand trước
- Thứ tự đề xuất cho các session sau

## 4. Tiêu chí Priority

| Priority | Tiêu chí |
|---|---|
| **P1 — Thiếu nặng** | Người mới đọc không hiểu vì thiếu nền tảng. VD: nói "dùng AOP" mà chưa giải thích AOP là gì, "Optimistic Lock" mà không nói race condition là gì. |
| **P2 — Thiếu vừa** | Code OK, lý thuyết OK, nhưng thiếu: ví dụ đời thường / code before-after / câu hỏi tự test / SQL sinh ra / anti-patterns. |
| **P3 — Ổn rồi** | Đầy đủ, có thể chỉ review nhẹ về typo/format. |

## 5. Template entry mỗi file

```markdown
### {path} — Priority: P1/P2/P3
- **Quy mô:** ~N dòng | **Phù hợp người mới?** Có/Không/Một phần
- **Thiếu (cho người chưa biết gì):**
  - {khái niệm nền tảng}
  - {ví dụ đời thường}
  - {anti-pattern}
- **Code/citation nghi sai:** file:line (nếu phát hiện)
- **Câu hỏi tự test thiếu:** Có/Không
- **Đề xuất expand:** {bullet ngắn}
```

## 6. Phân nhóm

- Backend (16 files): `docs/backend/`
- Frontend (22 files): `docs/frontend/`
- Module Guides (15 files): `docs/module-guides/`
- Database (3 files): `docs/database/`
- Design Patterns (4 files): `docs/design-patterns/`
- Project (7 files): `docs/project/`
- Lẻ (5 files): `docs/glossary.md`, `docs/common-mistakes.md`, `docs/features-completed.md`, `docs/README.md`, `docs/test-cases.md`

## 7. Cách audit (process)

1. **Đọc lướt** từng file (không deep read toàn bộ — đọc tiêu đề, intro, vài đoạn giữa, kết thúc).
2. **Cross-check** vài citation `file:line` nghi ngờ với code thực (chỉ làm nếu thấy dấu hiệu lệch).
3. **Ghi chú** theo template ở mục 5.
4. **Phân loại** P1/P2/P3 dựa trên tiêu chí mục 4.

## 8. Output kỳ vọng

**File chính:** `/docs/00-audit-knowledge-gaps.md` gồm:
1. Tóm tắt: tổng số file, phân bố P1/P2/P3
2. Bảng tổng kết priority theo nhóm
3. Chi tiết từng file (theo template)
4. Thứ tự đề xuất expand cho session sau

**Không trong phạm vi giai đoạn này:**
- KHÔNG sửa nội dung 70 files docs (chỉ audit, không edit)
- KHÔNG tạo các file expand mới
- KHÔNG verify chi tiết từng dòng code (chỉ spot-check)

## 9. Giai đoạn sau

Sau khi user xem báo cáo audit, sẽ quyết định:
- Session sau expand nhóm nào trước (P1 trước, P2 sau...)
- Có gộp file nào / tách file nào không
- Có cần thêm file mới (vd JWT internals, Hibernate dirty checking...) không
