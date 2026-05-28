# Git & GitHub — Quản lý source code

---

## Git là gì?

Hệ thống **quản lý phiên bản** code. Mỗi thay đổi được lưu lại, có thể quay lại bất kỳ lúc nào.

### Ví dụ đời thường
Google Docs có "Lịch sử phiên bản" → xem ai sửa gì, khi nào, quay lại bản cũ. Git = lịch sử phiên bản cho code.

---

## Lệnh cơ bản

### Hàng ngày

```bash
# Xem trạng thái (file nào thay đổi)
git status

# Xem chi tiết thay đổi
git diff

# Thêm file vào staging (chuẩn bị commit)
git add .                    # thêm tất cả
git add backend/             # thêm 1 thư mục
git add src/AuthService.java # thêm 1 file

# Commit (lưu snapshot)
git commit -m "feat: add login API"

# Đẩy lên GitHub
git push

# Kéo code mới từ GitHub
git pull
```

### Branch (nhánh)

```bash
# Tạo branch mới
git checkout -b feature/movie-crud

# Chuyển branch
git checkout main

# Xem tất cả branch
git branch -a

# Merge branch vào main
git checkout main
git merge feature/movie-crud

# Xóa branch đã merge
git branch -d feature/movie-crud
```

---

## Quy ước commit message

```
feat: add login API                  ← tính năng mới
fix: fix duplicate username check    ← sửa bug
refactor: thống nhất Filter DTO      ← cải thiện code, không đổi chức năng
docs: update ERD diagram             ← tài liệu
chore: update dependencies           ← cấu hình, build
style: format code                   ← format, không đổi logic
test: add auth service tests         ← thêm test
```

---

## Workflow nhóm 4 người

```
main ────────────────────────────────────────────
  │
  ├── feature/auth ──── commit ──── commit ──── merge ──►
  │
  ├── feature/movie ──── commit ──── commit ──── merge ──►
  │
  ├── feature/booking ──── commit ──── merge ──►
  │
  └── feature/frontend ──── commit ──── merge ──►
```

1. Mỗi người tạo branch riêng: `feature/auth`, `feature/movie`, ...
2. Code + commit trên branch riêng
3. Xong → push branch → tạo Pull Request trên GitHub
4. Review → merge vào `main`

---

## .gitignore — Không push file rác

```
backend/build/          # File build (tự sinh, không cần lưu)
backend/.gradle/        # Cache Gradle
frontend/node_modules/  # Dependencies FE (npm install lại được)
frontend/dist/          # File build FE
.idea/                  # Config IDE
.DS_Store               # File hệ thống Mac
.env                    # Biến môi trường (có thể chứa secret)
```

---

## Lệnh push CineX lên GitHub

```bash
cd /Users/vutuongan/cinex
git add .
git commit -m "feat: your message"
git push origin main
```
