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

---

## Pull Request Workflow

### Tạo branch + PR
```bash
# 1. Sync main mới nhất
git checkout main
git pull --rebase origin main

# 2. Tạo feature branch
git checkout -b feature/add-voucher-system

# 3. Code + commit
git add .
git commit -m "feat(voucher): add voucher entity and CRUD"
git commit -m "feat(voucher): integrate voucher with booking flow"

# 4. Push
git push -u origin feature/add-voucher-system

# 5. Mở PR trên GitHub UI hoặc:
gh pr create --title "feat: voucher system" --body "..."
```

### PR Review checklist (cho reviewer)
- [ ] Code compile + test pass
- [ ] Theo SOLID + design pattern dự án
- [ ] Có docs giải thích (theo template CLAUDE.md)
- [ ] Có test cho logic chính
- [ ] Liquibase changelog nếu thay đổi DB
- [ ] Không có TODO/FIXME chưa giải quyết
- [ ] Không có secret/credential trong code

### Merge strategy

| Strategy | Khi nào dùng | Lệnh |
|---|---|---|
| **Squash and merge** | Mặc định — gộp tất cả commit của branch thành 1 commit clean | GitHub UI |
| **Rebase and merge** | Khi commit history có giá trị (refactor lớn nhiều bước rõ ràng) | UI hoặc `git rebase` |
| **Merge commit** | Tránh dùng — tạo merge commit lằng nhằng | UI |

CineX khuyến nghị **squash** — main branch luôn linear, dễ revert.

---

## Conventional Commits

### Format chuẩn
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types phổ biến
- `feat`: tính năng mới
- `fix`: sửa bug
- `docs`: tài liệu
- `refactor`: refactor không đổi behavior
- `test`: thêm/sửa test
- `chore`: build, deps, config (không ảnh hưởng code)
- `perf`: cải thiện performance
- `style`: format code (không đổi logic)

### Ví dụ
```
feat(booking): add hold seat 10-minute timeout
fix(payment): handle MoMo callback duplicate
docs(api): add Swagger annotations to MovieController
refactor(security): extract JwtUtil from filter
chore(deps): upgrade Spring Boot 3.3.5 -> 3.4.0
```

### Breaking change
```
feat(api): change /movies response format

BREAKING CHANGE: response now wraps in ApiResponse<T>. 
Old clients must update to read data.data instead of data.
```

### Tại sao quan trọng
- Auto-generate CHANGELOG
- Semver bump tự động (feat = minor, fix = patch, BREAKING = major)
- Lọc commit theo type (`git log --grep="^feat"`)

---

## Resolve Conflict

### Xảy ra khi nào
2 người cùng sửa 1 file, cùng 1 vùng → khi merge/rebase → conflict.

### Quy trình
```bash
# 1. Sync main vào branch của bạn
git checkout feature/my-branch
git fetch origin
git rebase origin/main   # hoặc: git merge origin/main

# 2. Conflict xuất hiện:
# CONFLICT (content): Merge conflict in src/MovieService.java

# 3. Mở file, tìm conflict markers:
# <<<<<<< HEAD
# code của main
# =======
# code của bạn
# >>>>>>> feature/my-branch

# 4. Sửa thủ công, giữ phần đúng (hoặc gộp cả 2)

# 5. Mark resolved
git add src/MovieService.java
git rebase --continue   # hoặc: git commit (cho merge)

# 6. Push
git push --force-with-lease origin feature/my-branch
```

`--force-with-lease` an toàn hơn `--force` — chỉ push nếu remote chưa có commit mới.

### Tools
- VS Code: built-in conflict resolver
- IntelliJ: tab "Resolve" với UI 3-way merge
- CLI: `git mergetool` mở merge tool đã config

---

## Liquibase Conflict Resolution

### Vấn đề
Dev A tạo `015-create-vouchers.xml`. Dev B cùng lúc tạo `015-create-reviews.xml`. Cả 2 merge vào main → conflict ở `db.changelog-master.xml` + 2 file cùng số 015.

### Quy ước CineX
- Số changelog liên tiếp, không trùng
- Mỗi PR chỉ 1 changelog mới (nếu cần thêm DB)
- Conflict: người sau rebase → đổi số 015 → 016 + cập nhật `db.changelog-master.xml`

```bash
# Dev B rebase từ main đã có 015 (vouchers):
git rebase origin/main
# Conflict ở db.changelog-master.xml

# Đổi tên file:
mv 015-create-reviews.xml 016-create-reviews.xml

# Cập nhật master:
# <include file="changes/015-create-vouchers.xml"/>  ← của A
# <include file="changes/016-create-reviews.xml"/>  ← của B

git add . && git rebase --continue
```

---

## Hot-fix Workflow

### Khi nào
Bug critical đang chạy production (vd cổng thanh toán lỗi, ai cũng không đặt được vé).

### Quy trình
```bash
# 1. Branch từ main hoặc tag production
git checkout main
git pull
git checkout -b hotfix/payment-callback-fail

# 2. Sửa nhanh, commit gọn
git add .
git commit -m "fix(payment): handle null signature in MoMo callback"

# 3. Push + PR ngay
git push -u origin hotfix/payment-callback-fail
gh pr create --label "hotfix" --reviewer "tech-lead"

# 4. Merge vào main + production
# Backport vào branch khác nếu có (vd develop)
git checkout develop
git cherry-pick <commit-hash>
git push
```

Hot-fix PR có quy trình review nhanh (1 senior approve thay vì 2).

---

## Useful Git Commands

### Tạm cất thay đổi
```bash
git stash                    # cất
git stash pop                # lấy lại
git stash list               # xem stash
git stash drop stash@{0}     # xóa
```

### Sửa commit cuối
```bash
git commit --amend           # đổi message hoặc thêm file
git commit --amend --no-edit # chỉ thêm file
```

⚠️ Chỉ amend commit CHƯA push. Đã push rồi → tạo commit mới.

### Cherry-pick
```bash
git cherry-pick <commit-hash>  # áp dụng 1 commit từ branch khác
```

### Revert (an toàn cho commit đã push)
```bash
git revert <commit-hash>     # tạo commit mới đảo ngược
# Khác git reset (xóa commit) → tránh trên branch chia sẻ
```

### Search history
```bash
git log --grep="payment"     # search commit message
git log -p src/MovieService.java  # xem mọi thay đổi của file
git blame src/MovieService.java   # ai sửa dòng nào
```

---

## Team Workflow đầy đủ

```
1. Pull main mới nhất
   └─ git checkout main && git pull

2. Tạo feature branch
   └─ git checkout -b feature/voucher

3. Code, commit theo Conventional Commits
   └─ git add . && git commit -m "feat(voucher): ..."

4. Push + tạo PR
   └─ git push -u origin feature/voucher
   └─ gh pr create

5. CI chạy: build + test + lint
   ├─ Pass → có thể review
   └─ Fail → fix → push lại

6. Reviewer comment / approve
   └─ Author trả lời / sửa code → push

7. Approve đủ (2 reviewer cho main) → Squash merge

8. Branch tự xóa, CI/CD deploy

9. Tag release (nếu có)
   └─ git tag v1.2.0 && git push --tags
```

---

## Protected Branch Rules (GitHub)

Khuyến nghị cấu hình cho `main`:
- ✅ Require PR before merging
- ✅ Require 2 reviewers
- ✅ Require status check pass (CI)
- ✅ Require branches up to date before merge
- ✅ Restrict force push
- ❌ KHÔNG cho push trực tiếp main (kể cả admin)

---

## SSH Key cho GitHub

```bash
# 1. Generate
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 3. Copy public key
cat ~/.ssh/id_ed25519.pub

# 4. Paste vào GitHub Settings → SSH Keys

# 5. Test
ssh -T git@github.com
# → "Hi <username>! You've successfully authenticated"
```

Sau đó clone với SSH thay vì HTTPS:
```bash
git clone git@github.com:user/cinex.git
```

---

## Signed Commits (cho team production)

```bash
# 1. Generate GPG key
gpg --full-generate-key

# 2. List + lấy key ID
gpg --list-secret-keys --keyid-format=long

# 3. Config git
git config --global user.signingkey <KEY_ID>
git config --global commit.gpgsign true

# 4. Commit sẽ tự sign
git commit -m "feat: ..."

# 5. GitHub hiển thị badge "Verified"
```

---

## .gitignore CineX

```
# IDE
.idea/
.vscode/
*.iml

# Build
backend/build/
backend/.gradle/
frontend/dist/
frontend/node_modules/

# Env
.env
.env.local
.env.development.local
.env.production.local
*.env

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# Secrets
**/credentials.json
**/serviceAccount*.json
**/*.pem
**/*.key

# Cache
.cache/
*.cache
```

**KHÔNG commit**:
- `.env` (credentials)
- `node_modules/` (cài lại được)
- `build/`, `dist/` (sinh lại được)
- IDE config cá nhân

