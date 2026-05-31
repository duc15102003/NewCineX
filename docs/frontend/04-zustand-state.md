# Zustand -- Quan ly state phia client (Giai thich chi tiet)

---

## 1. Zustand la gi?

### Vi du doi thuong -- Bang thong bao chung

Tuong tuong ban lam viec trong van phong co 5 phong. Moi phong can biet **"Hom nay ai truc?"**.

**Cach 1 (khong co Zustand):** Moi phong tu ghi giay rieng. Khi nguoi truc thay doi → phai chay di **5 phong** de cap nhat giay. Neu 1 phong quen cap nhat → thong tin sai.

**Cach 2 (co Zustand):** Dat **1 bang thong bao CHUNG** o sanh. Moi phong nhin len bang la biet. Khi nguoi truc thay doi → chi can **sua 1 cho tren bang** → tat ca phong deu thay ngay.

Zustand chinh la **bang thong bao chung** do. No luu tru state o **1 cho duy nhat**, va bat ky component nao cung co the doc/ghi state do ma khong can truyen qua nhieu tang.

### Dinh nghia ky thuat

Zustand la thu vien **state management** (quan ly trang thai) cho React. No giup nhieu component chia se data ma khong can truyen props qua nhieu cap.

- **Nhe**: chi ~1KB, khong can setup phuc tap
- **Don gian**: tao store bang 1 ham `create()`
- **Khong can Provider boc ngoai** (khac Redux phai co `<Provider>`)

---

## 2. Tai sao can state management? (Props drilling problem)

### Van de: Props Drilling

Gia su ban co cau truc component nhu nay:

```
App
 └── Layout
      ├── Header          ← can biet user dang login (de hien ten, nut dang xuat)
      │    └── UserMenu   ← can biet user role (de hien menu admin)
      └── MainContent
           └── MoviePage
                └── ReviewForm  ← can biet user da login chua (de cho phep danh gia)
```

**Khong co Zustand**, ban phai truyen `user` tu App xuong qua tung cap:

```tsx
// ❌ Code XAU -- Props Drilling
function App() {
  const [user, setUser] = useState(null)
  return <Layout user={user} setUser={setUser} />
  //              ^^^^  truyen xuong tang 1
}

function Layout({ user, setUser }) {
  return (
    <>
      <Header user={user} setUser={setUser} />
      {/*      ^^^^  truyen xuong tang 2 */}
      <MainContent user={user} />
      {/*           ^^^^  truyen xuong tang 2 */}
    </>
  )
}

function Header({ user, setUser }) {
  return <UserMenu user={user} setUser={setUser} />
  //                ^^^^  truyen xuong tang 3
}

// Layout KHONG dung user, nhung van phai nhan va truyen tiep!
// → Code dai dong, kho bao tri, them 1 field = sua N file
```

**Co Zustand**, moi component tu lay nhung gi can:

```tsx
// ✅ Code TOT -- Zustand
function Header() {
  const user = useAuthStore(s => s.user)     // tu lay, khong can ai truyen
  return <span>Xin chao, {user?.username}</span>
}

function ReviewForm() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)  // tu lay
  if (!isLoggedIn()) return <p>Dang nhap de danh gia</p>
  return <form>...</form>
}

// Khong component nao phai "chuyen tiep" props
// Them field moi → chi sua store + component can dung
```

---

## 3. Server State vs Client State -- Khi nao dung cai nao?

Day la cau hoi quan trong nhat khi lam React: **Data nay dung React Query hay Zustand?**

### Bang phan biet

| Tieu chi | Server State (React Query) | Client State (Zustand) |
|---|---|---|
| **Data den tu dau?** | Tu backend API | Tu hanh dong cua user tren trinh duyet |
| **Ai quan ly chinh?** | Server (database) | Client (browser) |
| **Can cache/refetch?** | Co (data co the thay doi boi nguoi khac) | Khong |
| **Vi du** | Danh sach phim, don hang, user | Token login, ghe dang chon, theme den/sang |
| **Thu vien** | TanStack Query | Zustand |

### Vi du cu the trong CineX

| Data | Loai | Dung gi | Tai sao |
|---|---|---|---|
| Danh sach phim | Server | `useQuery` | Data nam tren database, nhieu nguoi dung cung nhin |
| Thong tin user dang login | Client | `useAuthStore` | Chi trinh duyet nay biet user nay dang login |
| Danh sach review | Server | `useQuery` | Data nam tren database, can fetch tu API |
| Ghe dang chon (dat ve) | Client | `useSeatStore` | User dang click chon, chua gui len server |
| Danh sach the loai | Server | `useQuery` | Data nam tren database |

### Quy tac nhanh

> **Data tu API** → dung **React Query** (useQuery, useMutation)
> **Data chi ton tai tren browser** → dung **Zustand** (create store)
> **Khong chac?** Hoi: "Data nay co trong database khong?" Co → React Query. Khong → Zustand.

---

## 4. Tao store voi Zustand -- create()

### Cu phap

```tsx
import { create } from 'zustand'

// Buoc 1: Dinh nghia KIEU du lieu cua store
interface CounterState {
  count: number                    // state
  increment: () => void            // action (ham thay doi state)
  decrement: () => void            // action
  reset: () => void                // action
}

// Buoc 2: Tao store
const useCounterStore = create<CounterState>((set, get) => ({
  // --- STATE (du lieu) ---
  count: 0,

  // --- ACTIONS (ham thay doi du lieu) ---
  increment: () => set((state) => ({ count: state.count + 1 })),
  //                 ^^^  set() nhan 1 ham, tra ve object moi
  //                      → Zustand tu merge voi state cu

  decrement: () => set((state) => ({ count: state.count - 1 })),

  reset: () => set({ count: 0 }),
  //           ^^^  hoac truyen thang object (khong can state cu)
}))
```

### Giai thich `set` va `get`

**`set`** -- Thay doi state

```tsx
// Cach 1: Truyen object (ghi de cac field trong object)
set({ count: 0 })

// Cach 2: Truyen ham (khi can doc state cu de tinh state moi)
set((state) => ({ count: state.count + 1 }))

// Luu y: set() CHI MERGE (noi), KHONG thay the toan bo store
// Vi du: store co { count: 0, name: 'abc' }
// set({ count: 5 }) → store thanh { count: 5, name: 'abc' }  (name van con)
```

**`get`** -- Doc state hien tai (dung trong action)

```tsx
const useStore = create((set, get) => ({
  count: 0,
  doubleCount: () => {
    const current = get().count  // doc state hien tai
    set({ count: current * 2 })
  },
}))
```

---

## 5. Code thuc te -- authStore cua CineX

File: `frontend/src/store/authStore.ts`

```tsx
import { create } from 'zustand'

// --- KIEU DU LIEU ---
interface User {
  username: string
  role: string
  avatarUrl?: string | null
}

interface AuthState {
  // STATE
  token: string | null
  refreshToken: string | null
  user: User | null

  // ACTIONS
  setAuth: (token: string, refreshToken: string, user: User) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  isLoggedIn: () => boolean
  isAdmin: () => boolean
}
```

### Giai thich tung phan

#### Khoi tao state -- Doc tu localStorage

```tsx
// Ham helper: parse user tu localStorage an toan
function parseUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')  // JSON hong → xoa di
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Khoi tao: doc tu localStorage
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: parseUser(),
  // ↑ Khi user refresh trang (F5), component bi huy va tao lai
  //   Nhung localStorage van con → doc lai → user van dang login
  ...
}))
```

**Tai sao doc tu localStorage?** Vi khi user refresh trang (F5) hoac dong tab roi mo lai:
- React state bi **mat het** (vi component bi huy)
- localStorage **van ton tai** trong browser
- → Doc lai tu localStorage = **giu trang thai login**

#### setAuth -- Luu thong tin dang nhap

```tsx
setAuth: (token, refreshToken, user) => {
  // Luu vao localStorage (de con khi refresh)
  localStorage.setItem('token', token)
  localStorage.setItem('refreshToken', refreshToken)
  localStorage.setItem('user', JSON.stringify(user))

  // Cap nhat state cua Zustand (de component re-render)
  set({ token, refreshToken, user })
},
```

**Luong hoat dong:**
```
User dang nhap → API tra ve token + user
      ↓
Goi setAuth(token, refreshToken, user)
      ↓
┌─────────────────────────────────────┐
│ 1. Luu vao localStorage (ben vung) │
│ 2. set() cap nhat Zustand state    │
│      ↓                              │
│ 3. Component dang "lang nghe" state │
│    tu dong re-render                │
│      ↓                              │
│ 4. Header hien "Xin chao, vanan"   │
│    thay vi "Dang nhap"             │
└─────────────────────────────────────┘
```

#### logout -- Xoa thong tin dang nhap

```tsx
logout: () => {
  // Xoa khoi localStorage
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')

  // Reset state ve null
  set({ token: null, refreshToken: null, user: null })
},
```

Khi user bam "Dang xuat":
1. Xoa localStorage → refresh trang se khong con login
2. set state ve null → component re-render → Header hien "Dang nhap" thay vi ten user

#### updateUser -- Cap nhat 1 phan thong tin user

```tsx
updateUser: (partial) => {
  const current = get().user           // doc user hien tai bang get()
  if (!current) return                 // chua login → khong lam gi
  const updated = { ...current, ...partial }  // merge field moi
  localStorage.setItem('user', JSON.stringify(updated))
  set({ user: updated })
},
```

**Partial<User> la gi?** La kieu TypeScript cho phep truyen **1 phan** cua User:
```tsx
// Truyen day du User
const user: User = { username: 'vanan', role: 'USER', avatarUrl: null }

// Truyen Partial<User> -- chi can 1 vai field
updateUser({ avatarUrl: 'https://...' })  // chi cap nhat avatar
updateUser({ username: 'newname' })       // chi cap nhat ten
```

**Khi nao dung?** Khi user doi avatar hoac doi ten → chi can cap nhat field do, khong can set lai toan bo.

#### isLoggedIn va isAdmin -- Ham tien ich

```tsx
isLoggedIn: () => !!get().token,
// !!null → false
// !!'eyJhbGci...' → true

isAdmin: () => get().user?.role === 'ADMIN',
// user la null → undefined === 'ADMIN' → false
// user.role la 'USER' → false
// user.role la 'ADMIN' → true
```

**Tai sao dung `get()` thay vi doc state truc tiep?**
Vi day la **ham** (function), khong phai computed property. Moi lan goi `isLoggedIn()` no se doc state **moi nhat** tu store.

---

## 6. Persist to localStorage -- Tai sao can?

### Van de: Refresh trang = mat state

```
User dang nhap → token luu trong Zustand state (RAM)
      ↓
User bam F5 (refresh trang)
      ↓
React khoi dong lai tu dau → Zustand store bi tao moi → token = null
      ↓
User bi dang xuat! (UX rat xau)
```

### Giai phap: Luu vao localStorage

```
User dang nhap → token luu trong Zustand state + localStorage
      ↓
User bam F5 (refresh trang)
      ↓
React khoi dong lai → Zustand store tao moi
      ↓
NHUNG: khoi tao doc tu localStorage → token = 'eyJhbGci...'
      ↓
User van dang nhap! (UX tot)
```

### CineX lam nhu the nao?

Trong `authStore.ts`, CineX tu lam persist **thu cong** (khong dung middleware):

```tsx
// KHI TAO STORE: doc tu localStorage
token: localStorage.getItem('token'),
user: parseUser(),

// KHI SET: ghi vao localStorage
setAuth: (token, refreshToken, user) => {
  localStorage.setItem('token', token)        // luu ben vung
  localStorage.setItem('user', JSON.stringify(user))
  set({ token, refreshToken, user })          // cap nhat state
},

// KHI LOGOUT: xoa localStorage
logout: () => {
  localStorage.removeItem('token')            // xoa ben vung
  set({ token: null, user: null })            // reset state
},
```

**Luu y:** Zustand co middleware `persist` de tu dong hoa viec nay, nhung CineX lam thu cong de **kiem soat chinh xac** nhung gi luu/khong luu. Vi du: khong nen luu password vao localStorage.

### localStorage vs sessionStorage

| Dac diem | localStorage | sessionStorage |
|---|---|---|
| Ton tai khi dong tab | Co | Khong |
| Ton tai khi dong browser | Co | Khong |
| Ton tai khi refresh (F5) | Co | Co |
| Dung cho | Token, user info | Data tam (1 phien) |

CineX dung `localStorage` → dong browser roi mo lai → van dang nhap.

---

## 7. Selector -- Lay DUNG nhung gi can

### Van de: Lay het store → re-render khong can thiet

```tsx
// ❌ Code XAU -- lay ca store
function Header() {
  const store = useAuthStore()
  // store = { token, refreshToken, user, setAuth, logout, ... }

  return <span>{store.user?.username}</span>
}
```

**Van de gi?** Component `Header` chi can `user.username`, nhung no "dang ky lang nghe" **TOAN BO** store. Khi **bat ky field nao** thay doi (vi du: `refreshToken` duoc cap nhat), Header se **re-render** du no khong hien refreshToken.

### Giai phap: Selector -- chi lay nhung gi can

```tsx
// ✅ Code TOT -- chi lay user
function Header() {
  const user = useAuthStore(s => s.user)
  //                        ^^^^^^^^^
  //  Selector: "Toi chi can field user thoi"
  //  Chi re-render khi user thay doi
  //  refreshToken thay doi → Header KHONG re-render

  return <span>{user?.username}</span>
}
```

### Selector la gi?

Selector la 1 ham nhan vao **toan bo state** va tra ve **phan can dung**:

```tsx
// Selector lay 1 field
const user = useAuthStore(s => s.user)
const token = useAuthStore(s => s.token)

// Selector lay 1 action
const logout = useAuthStore(s => s.logout)
const setAuth = useAuthStore(s => s.setAuth)

// Selector lay nhieu thu (viet nhieu dong)
function LoginPage() {
  const setAuth = useAuthStore(s => s.setAuth)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  // Moi selector la 1 dong rieng → ro rang, de doc
}
```

### Vi sao selector giam re-render?

```
KHONG selector (lay ca store):
┌─────────────────────────────────────┐
│ token thay doi     → re-render ✗   │
│ refreshToken doi   → re-render ✗   │
│ user thay doi      → re-render ✗   │
│ → 3 lan re-render cho 3 thay doi   │
└─────────────────────────────────────┘

CO selector (chi lay user):
┌─────────────────────────────────────┐
│ token thay doi     → KHONG render  │
│ refreshToken doi   → KHONG render  │
│ user thay doi      → re-render ✓   │
│ → Chi 1 lan re-render khi can      │
└─────────────────────────────────────┘
```

**Re-render it hon = app nhanh hon = UX tot hon.**

---

## 8. So sanh Redux vs Zustand

### Redux -- "Qua phuc tap cho project nho"

```tsx
// Redux can NHIEU file va khai niem:

// 1. Action types
const SET_USER = 'SET_USER'
const LOGOUT = 'LOGOUT'

// 2. Action creators
const setUser = (user) => ({ type: SET_USER, payload: user })
const logout = () => ({ type: LOGOUT })

// 3. Reducer
function authReducer(state = initialState, action) {
  switch (action.type) {
    case SET_USER:
      return { ...state, user: action.payload }
    case LOGOUT:
      return { ...state, user: null, token: null }
    default:
      return state
  }
}

// 4. Store
const store = createStore(authReducer)

// 5. Provider (BAT BUOC boc ngoai App)
<Provider store={store}>
  <App />
</Provider>

// 6. Su dung trong component
const user = useSelector(state => state.user)
const dispatch = useDispatch()
dispatch(setUser({ name: 'vanan' }))
```

**Redux can:** action types + action creators + reducer + store + Provider + useSelector + useDispatch
= **7 khai niem** de lam 1 viec don gian.

### Zustand -- "Don gian, du manh"

```tsx
// Zustand chi can 1 file:

const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, token: null }),
}))

// Su dung:
const user = useAuthStore(s => s.user)
const logout = useAuthStore(s => s.logout)
```

**Zustand can:** create() + set() + selector
= **3 khai niem**, XONG.

### Bang so sanh

| Tieu chi | Redux | Zustand |
|---|---|---|
| Setup | Phuc tap (action, reducer, store, provider) | 1 ham `create()` |
| Boilerplate | Rat nhieu | Gan nhu khong |
| Provider | Bat buoc `<Provider>` | Khong can |
| DevTools | Co (Redux DevTools) | Co (addon) |
| Middleware | Co (redux-thunk, redux-saga) | Co (built-in) |
| Kich thuoc | ~7KB | ~1KB |
| Learning curve | Cao (nhieu khai niem) | Thap (3 khai niem) |
| Phu hop | App lon, team lon, state phuc tap | App nho-vua, state don gian |

### Khi nao dung Redux?

- App KHONG LO (Facebook, Shopee) voi hang tram state
- Team 10+ nguoi can quy trinh chuan (action → reducer)
- Can time-travel debugging (quay lai state truoc do)

### Khi nao dung Zustand? (Nhu CineX)

- App nho-vua (do an, startup, side project)
- State client don gian (auth, theme, UI flags)
- Muon code nhanh, it boilerplate

---

## 9. Tong ket -- Khi nao dung gi?

```
Ban can luu tru data?
      ↓
Data tu API backend?
  ├── CO  → dung React Query (useQuery / useMutation)
  │         Vi du: danh sach phim, review, don hang
  │
  └── KHONG → Data chi ton tai tren browser
              ↓
        Nhieu component can dung?
          ├── CO  → dung Zustand (create store)
          │         Vi du: user login, ghe dang chon, theme
          │
          └── KHONG → dung useState
                      Vi du: mo/dong dialog, gia tri input
```

---

## 10. Cau hoi tu kiem tra

**Cau 1:** Neu khong luu token vao localStorage, dieu gi xay ra khi user refresh trang (F5)?

> Tra loi: User se bi **dang xuat**. Vi khi refresh, React khoi dong lai, Zustand store bi tao moi voi `token: null`. Khong co localStorage de doc lai → user phai dang nhap lai.

**Cau 2:** Tai sao `useAuthStore(s => s.user)` tot hon `useAuthStore()` (lay ca store)?

> Tra loi: Vi selector chi **re-render component khi `user` thay doi**. Neu lay ca store, bat ky field nao thay doi (token, refreshToken) deu lam component re-render → lang phi hieu nang.

**Cau 3:** `updateUser({ avatarUrl: 'https://...' })` co lam mat cac field khac (username, role) khong?

> Tra loi: **Khong**. Vi code dung spread operator `{ ...current, ...partial }` de **merge** field moi vao user cu. Chi field duoc truyen moi bi ghi de, cac field con lai giu nguyen.

**Cau 4:** Danh sach phim (movies) nen luu trong Zustand hay React Query? Tai sao?

> Tra loi: **React Query**. Vi danh sach phim la **server state** -- data nam trong database, nhieu nguoi dung cung nhin. React Query cung cap cache, refetch, loading state tu dong. Zustand khong co cac tinh nang nay.

**Cau 5:** Neu trong `setAuth`, ban chi goi `set({ token, user })` ma KHONG goi `localStorage.setItem(...)`, ung dung van hoat dong binh thuong khong?

> Tra loi: **Hoat dong binh thuong** trong phien hien tai (component re-render dung). NHUNG khi user **refresh trang** hoac **dong browser roi mo lai**, token se bi mat vi Zustand store bi tao moi voi `token: localStorage.getItem('token')` → tra ve `null`. Ket qua: user bi dang xuat moi khi refresh.
