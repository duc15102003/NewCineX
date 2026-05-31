# Form & Validation -- React Hook Form + Zod

---

## 1. React Hook Form la gi?

### Vi du doi thuong: Form dang ky truong hoc

Tuong tuong ban dang dien **don dang ky nhap hoc**. Tren don co 10 o (ho ten, email, SDT, dia chi...).

- **Cach thu cong (useState):** Ban tu cam 10 cay but, moi but ghi 1 o. Moi khi ghi xong 1 o, ban phai tu kiem tra "co dung chua?". Rat met!
- **Cach dung React Hook Form:** Ban co 1 **nguoi tro ly** -- ban chi can noi "day la 10 o can dien", tro ly tu theo doi gia tri moi o, tu kiem tra loi, va khi submit thi tra ve du lieu sach se.

React Hook Form chinh la "nguoi tro ly" do -- no **quan ly toan bo form** (gia tri cac field, trang thai loi, loading, submit) ma ban khong can viet hang chuc dong useState.

---

## 2. Tai sao can React Hook Form?

### KHONG dung React Hook Form (code XAU)

```tsx
function RegisterPage() {
  // Moi field = 1 useState + 1 onChange → 5 field = 10 dong chi de khai bao
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Validation thu cong -- moi field 1 state loi rieng
  const [usernameError, setUsernameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Kiem tra tung field thu cong -- dai va de thieu
    if (username.length < 3) {
      setUsernameError('Username toi thieu 3 ky tu')
      return
    }
    if (!email.includes('@')) {
      setEmailError('Email khong hop le')
      return
    }
    if (password.length < 6) {
      setPasswordError('Mat khau toi thieu 6 ky tu')
      return
    }
    // ... con nhieu field nua

    // Goi API
    api.post('/api/auth/register', { username, email, password, fullName, phone })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={username} onChange={e => setUsername(e.target.value)} />
      {usernameError && <p className="text-red-500">{usernameError}</p>}

      <input value={email} onChange={e => setEmail(e.target.value)} />
      {emailError && <p className="text-red-500">{emailError}</p>}

      {/* ... con rat nhieu input nua */}
    </form>
  )
}
// Tong cong: ~50-60 dong chi de quan ly form 5 field
// Van de:
// - Moi lan go 1 ky tu → re-render TOAN BO component
// - Validation logic nam lien tien trong handleSubmit → kho bao tri
// - De bi thieu case (VD: quên kiem tra email format)
```

### CO dung React Hook Form + Zod (code TOT)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Buoc 1: Khai bao schema -- tat ca validation o 1 cho
const registerSchema = z.object({
  username: z.string().min(3, 'Username toi thieu 3 ky tu'),
  email: z.string().email('Email khong hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  fullName: z.string().optional(),
  phone: z.string().optional(),
})

type RegisterForm = z.infer<typeof registerSchema>

function RegisterPage() {
  // Buoc 2: useForm -- 1 dong thay 10 useState
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  // Buoc 3: onSubmit -- data da duoc validate, chac chan dung
  const onSubmit = (data: RegisterForm) => {
    api.post('/api/auth/register', data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('username')} />
      {errors.username && <p>{errors.username.message}</p>}
      {/* ... tuong tu cho cac field khac */}
    </form>
  )
}
// Tong cong: ~20 dong -- gon gap 3 lan
// Uu diem:
// - KHONG re-render toan bo khi go (React Hook Form dung ref, khong dung state)
// - Validation tap trung trong schema -- de doc, de sua
// - TypeScript tu suy ra kieu du lieu tu schema
```

### So sanh tom tat

| Tieu chi | useState thu cong | React Hook Form + Zod |
|---|---|---|
| So dong code (5 field) | ~50-60 dong | ~20 dong |
| Re-render khi go | Toan bo component | Chi input dang go |
| Validation | Nam rai rac trong handleSubmit | Tap trung 1 cho (schema) |
| TypeScript support | Tu khai bao type rieng | Tu sinh type tu schema |
| Hien thi loi | Tu quan ly state loi | Tu dong qua `errors` |

---

## 3. useForm -- Ham chinh cua React Hook Form

`useForm` tra ve nhieu thu, nhung quan trong nhat la 5 cai sau:

### 3.1. `register` -- "Dang ky" input vao form

```tsx
const { register } = useForm<LoginForm>()

// Cach dung: spread vao input
<input {...register('username')} />

// Dong tren tuong duong voi:
<input
  name="username"
  ref={/* ref de React Hook Form truy cap DOM */}
  onChange={/* tu dong cap nhat gia tri */}
  onBlur={/* tu dong validate khi roi khoi field */}
/>
```

**Giai thich:** `register('username')` tra ve 1 object chua `name`, `ref`, `onChange`, `onBlur`. Khi ban viet `{...register('username')}`, tat ca nhung prop nay duoc "trai" (spread) vao `<input>`, nen React Hook Form tu dong biet input nay chua gia tri gi.

### 3.2. `handleSubmit` -- Xu ly khi bam nut Submit

```tsx
const { handleSubmit } = useForm<LoginForm>()

const onSubmit = (data: LoginForm) => {
  // data o day DA DUOC VALIDATE boi Zod
  // Neu khong hop le, ham nay KHONG BAO GIO duoc goi
  console.log(data) // { username: "vanan", password: "123456" }
}

<form onSubmit={handleSubmit(onSubmit)}>
```

**Giai thich:**
1. User bam Submit
2. `handleSubmit` chay Zod validation
3. Neu **co loi** → cap nhat `errors`, KHONG goi `onSubmit`
4. Neu **khong loi** → goi `onSubmit(data)` voi data sach

### 3.3. `formState` -- Trang thai cua form

```tsx
const { formState: { errors, isSubmitting, isDirty, isValid } } = useForm<LoginForm>()

// errors: object chua loi cua tung field
// errors.username?.message → "Vui long nhap ten dang nhap"

// isSubmitting: true khi dang goi API (onSubmit la async)
// isDirty: true khi user da thay doi bat ky field nao
// isValid: true khi tat ca field deu hop le
```

### 3.4. `reset` -- Dat lai form ve gia tri ban dau

```tsx
const { reset } = useForm<MovieFormData>()

// Truong hop 1: Mo dialog TAO MOI → reset form rong
function openCreate() {
  reset({})  // Xoa het gia tri
  setDialogOpen(true)
}

// Truong hop 2: Mo dialog CHINH SUA → reset form voi data cu
function openEdit(movie) {
  reset({
    title: movie.title,
    description: movie.description,
    duration: movie.duration,
  })
  setDialogOpen(true)
}
```

**Giai thich:** Trong CineX, 1 dialog dung chung cho ca Tao moi va Chinh sua. Khi mo dialog:
- **Tao moi:** `reset({})` de form rong
- **Chinh sua:** `reset({ ... })` de form co san du lieu cu

### 3.5. `control` -- Dieu khien input dac biet (xem muc 6)

```tsx
const { control } = useForm<ShowtimeFormData>()
// Dung voi <Controller> cho input khong phai HTML native
// Chi tiet o muc 6 ben duoi
```

---

## 4. Zod Schema Validation

### Zod la gi?

Zod la thu vien **khai bao quy tac validation** bang code. Thay vi viet `if/else` kiem tra tung field, ban khai bao 1 "schema" (ban thiet ke) mo ta du lieu hop le thi tro nhu the nao.

### Cac method thuong dung

```tsx
import { z } from 'zod'

const schema = z.object({
  // --- STRING ---
  username: z.string()
    .min(1, 'Bat buoc')           // Khong de trong (min 1 ky tu)
    .min(3, 'Toi thieu 3 ky tu')  // Toi thieu 3 ky tu
    .max(50, 'Toi da 50 ky tu'),  // Toi da 50 ky tu

  email: z.string()
    .email('Email khong hop le'),  // Kiem tra format email (co @, co domain)

  password: z.string()
    .min(6, 'Mat khau toi thieu 6 ky tu'),

  // --- OPTIONAL ---
  fullName: z.string().optional(), // Co the bo trong (khong bat buoc)

  // --- NUMBER ---
  duration: z.number()
    .min(1, 'Thoi luong phai > 0')    // Toi thieu 1
    .max(300, 'Toi da 300 phut'),     // Toi da 300

  basePrice: z.number()
    .min(0, 'Gia khong duoc am'),     // Khong cho so am

  // --- ENUM ---
  status: z.enum(['COMING_SOON', 'NOW_SHOWING', 'ENDED']),

  // --- ARRAY ---
  genreIds: z.array(z.number()).min(1, 'Chon it nhat 1 the loai'),
})
```

### Tu sinh TypeScript type tu schema

```tsx
type MovieForm = z.infer<typeof schema>
// TypeScript tu hieu:
// type MovieForm = {
//   username: string
//   email: string
//   password: string
//   fullName?: string | undefined
//   duration: number
//   basePrice: number
//   status: 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED'
//   genreIds: number[]
// }
```

**Loi ich:** Ban chi viet schema 1 lan, TypeScript type duoc tu dong suy ra. Khong can khai bao rieng `interface MovieForm` nua → dam bao validation va type luon dong bo.

---

## 5. zodResolver -- Ket noi Zod voi React Hook Form

### Van de: 2 thu vien khac nhau

- **React Hook Form** biet cach quan ly form (state, submit, loi)
- **Zod** biet cach validate du lieu (kiem tra dung/sai)

Nhung chung KHONG biet nhau! Can mot "cau noi" de ket noi chung lai.

### Giai phap: zodResolver

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'  // ← Cau noi
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
})

type LoginForm = z.infer<typeof loginSchema>

const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
  resolver: zodResolver(loginSchema),  // ← Noi: "Dung Zod de validate"
})
```

### Luong hoat dong

```
User bam Submit
    ↓
handleSubmit() goi zodResolver
    ↓
zodResolver goi loginSchema.parse(formData)
    ↓
Zod kiem tra: username >= 1 ky tu? password >= 1 ky tu?
    ↓
├── Hop le → tra ve { values: { username, password }, errors: {} }
│       ↓
│   handleSubmit goi onSubmit(data)
│
└── KHONG hop le → tra ve { values: {}, errors: { username: { message: "..." } } }
        ↓
    handleSubmit cap nhat formState.errors → UI hien loi
```

---

## 6. Controller Component -- Cho input dac biet

### Van de: register() chi hoat dong voi input HTML thong thuong

`register()` hoat dong bang cach gan `ref` vao DOM element (`<input>`, `<select>`, `<textarea>`). Nhung nhieu component UI **khong phai** input HTML thong thuong:

- `<PriceInput>` -- input tien te co format (75.000d)
- `<MultiSelect>` -- chon nhieu gia tri
- `<DatePicker>` -- chon ngay
- Component tu shadcn/ui co API rieng (nhan `value` + `onChange`)

Cac component nay KHONG co `ref` de React Hook Form "nam" lay → `register()` KHONG hoat dong.

### Giai phap: Controller

`Controller` la mot component boc (wrapper) giup React Hook Form dieu khien cac input dac biet.

```tsx
import { useForm, Controller } from 'react-hook-form'

const { control } = useForm<ShowtimeFormData>()

// Thay vi:
// <PriceInput {...register('basePrice')} />  ← LOI! PriceInput khong nhan ref

// Dung Controller:
<Controller
  name="basePrice"                    // Ten field trong form
  control={control}                   // Truyen control tu useForm
  rules={{                            // Validation (thay cho Zod neu can)
    required: 'Gia ve la bat buoc',
    min: { value: 1, message: 'Gia phai > 0' }
  }}
  render={({ field }) => (            // field = { value, onChange, onBlur, name, ref }
    <PriceInput
      value={field.value}             // Gia tri hien tai
      onChange={field.onChange}        // Ham cap nhat gia tri
      placeholder="VD: 75.000"
    />
  )}
/>
```

### Giai thich bang vi du doi thuong

Tuong tuong `register()` la ban **tu tay ghi giay** -- chi hoat dong voi but va giay (input HTML).

Nhung `PriceInput` giong nhu **may tinh bo tui** -- ban khong the viet truc tiep len no. Ban can mot **nguoi trung gian** (`Controller`) de:
1. Doc ket qua tren may tinh (`field.value`)
2. Bam nut tren may tinh (`field.onChange`)
3. Bao lai cho form biet gia tri moi

### Code thuc te trong CineX: AdminShowtimePage

```tsx
// File: frontend/src/features/admin/AdminShowtimePage.tsx (dong 76, 303-310)

import { useForm, Controller } from 'react-hook-form'
import { PriceInput } from '@/components/ui/price-input'

const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ShowtimeFormData>()

// Trong form:
<div className="col-span-4">
  <label className="text-sm text-gray-400 mb-1.5 block">
    Gia thuong (d) <span className="text-red-400">*</span>
  </label>

  {/* Controller boc PriceInput -- vi PriceInput la component dac biet */}
  <Controller
    name="basePrice"
    control={control}
    rules={{ required: 'Gia ve la bat buoc', min: { value: 1, message: 'Gia phai > 0' } }}
    render={({ field }) => (
      <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 75.000" />
    )}
  />

  {/* Hien loi validation */}
  {errors.basePrice && (
    <p className="text-red-400 text-xs mt-1">{String(errors.basePrice.message)}</p>
  )}
</div>
```

### Khi nao dung register() vs Controller?

| Input | Dung cai nao | Ly do |
|---|---|---|
| `<input>`, `<textarea>` | `register()` | La HTML native, co ref |
| `<select>` HTML thuong | `register()` | La HTML native, co ref |
| `<PriceInput>` | `Controller` | Component custom, khong co ref |
| `<MultiSelect>` | `Controller` | Component custom |
| `<DatePicker>` | `Controller` | Component custom |
| shadcn `<Select>` | `Controller` | Component custom (Radix UI) |

---

## 7. Error Display -- Hien thi loi validation

### Pattern co ban

```tsx
{errors.fieldName && (
  <p className="text-red-400 text-xs mt-1">
    {errors.fieldName.message}
  </p>
)}
```

**Giai thich:**
- `errors` la object. Neu field `username` bi loi, `errors.username` se ton tai.
- `errors.username.message` la chuoi loi ban khai bao trong Zod schema (VD: "Vui long nhap ten dang nhap").
- `&&` la **short-circuit**: neu `errors.username` la `undefined` (khong loi), React khong render gi ca.

### Vi du thuc te tu LoginPage

```tsx
// File: frontend/src/features/auth/LoginPage.tsx (dong 50-53)

<Input
  id="username"
  placeholder="Ten dang nhap"
  className="mt-1.5 bg-[#0d2137] border-white/10"
  {...register('username')}
/>
{errors.username && (
  <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
  //                                         ↑ "Vui long nhap ten dang nhap"
  //                                           (tu loginSchema: z.string().min(1, '...'))
)}
```

### Meo: Dung `String()` khi TypeScript phan nan

```tsx
// Doi khi TypeScript bao loi vi message co the la undefined
// Dung String() de ep kieu an toan:
{errors.movieId && (
  <p className="text-red-400 text-xs mt-1">{String(errors.movieId.message)}</p>
)}
```

---

## 8. Code thuc te tu CineX

### 8.1. LoginPage -- Form don gian

```tsx
// File: frontend/src/features/auth/LoginPage.tsx

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// BUOC 1: Khai bao schema
const loginSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
})

// BUOC 2: Sinh TypeScript type tu schema
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  // BUOC 3: Goi useForm voi zodResolver
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  // BUOC 4: Goi API khi form hop le (useLogin la custom hook chua useMutation)
  const login = useLogin()

  const onSubmit = (data: LoginForm) => {
    login.mutate(data)  // data = { username: "...", password: "..." }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Field 1: Username */}
      <div>
        <Label htmlFor="username">Ten dang nhap <span className="text-red-400">*</span></Label>
        <Input
          id="username"
          placeholder="Ten dang nhap"
          className="mt-1.5 bg-[#0d2137] border-white/10"
          {...register('username')}
        />
        {errors.username && (
          <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
        )}
      </div>

      {/* Field 2: Password */}
      <div>
        <Label htmlFor="password">Mat khau <span className="text-red-400">*</span></Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••"
          className="mt-1.5 bg-[#0d2137] border-white/10"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>

      {/* Nut submit -- disable khi dang goi API */}
      <Button
        type="submit"
        className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
        disabled={login.isPending}
      >
        {login.isPending ? 'Dang dang nhap...' : 'Dang nhap'}
      </Button>
    </form>
  )
}
```

**Diem dang chu y:**
- `login.isPending` la tu React Query (TanStack Query) -- true khi dang goi API
- Button bi `disabled` khi dang goi API → tranh user bam nhieu lan
- Text nut doi tu "Dang nhap" → "Dang dang nhap..." de user biet dang xu ly

### 8.2. RegisterPage -- Form co refine()

```tsx
// File: frontend/src/features/auth/RegisterPage.tsx

const registerSchema = z.object({
  fullName: z.string().optional(),
  username: z.string().min(3, 'Ten dang nhap toi thieu 3 ky tu'),
  email: z.string().email('Email khong hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  confirmPassword: z.string().min(1, 'Vui long xac nhan mat khau'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mat khau xac nhan khong khop',
  path: ['confirmPassword'],  // ← Loi hien o field confirmPassword
})
```

Chi tiet ve `refine()` xem muc 9.

### 8.3. AdminMoviePage -- Form trong Dialog (Tao/Sua chung)

```tsx
// File: frontend/src/features/admin/AdminMoviePage.tsx (dong 91-128)

// useForm KHONG dung zodResolver -- dung validation inline cua register()
const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<MovieFormData>()

// Mo dialog TAO MOI → reset form rong
function openCreate() {
  setEditingItem(null)
  reset({ genreIds: [], status: 'COMING_SOON' })  // Gia tri mac dinh
  setDialogOpen(true)
}

// Mo dialog CHINH SUA → reset form voi du lieu cu
async function openEdit(movieId: number) {
  const res = await api.get(`/api/movies/${movieId}`)
  const m = res.data.data
  setEditingItem(m)
  reset({
    title: m.title,
    description: m.description,
    duration: m.duration,
    releaseDate: m.releaseDate?.slice(0, 10),
    // ... cac field khac
  })
  setDialogOpen(true)
}

// Submit -- cung ham cho ca Tao va Sua
function onSubmit(data: MovieFormData) {
  if (editingItem) {
    updateMut.mutate({ id: editingItem.id, data: payload })  // PUT /api/movies/:id
  } else {
    createMut.mutate(payload)  // POST /api/movies
  }
}
```

**Pattern quan trong:** 1 Dialog dung chung cho Tao moi va Chinh sua. Phan biet bang bien `editingItem`:
- `editingItem = null` → dang tao moi → goi `createMut`
- `editingItem = {...}` → dang chinh sua → goi `updateMut`

### 8.4. AdminShowtimePage -- Form co Controller (PriceInput)

```tsx
// File: frontend/src/features/admin/AdminShowtimePage.tsx (dong 76, 275-311)

import { useForm, Controller } from 'react-hook-form'
import { PriceInput } from '@/components/ui/price-input'

const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ShowtimeFormData>()

// Trong form dialog:
<form onSubmit={handleSubmit(onSubmit)}>
  <div className="grid grid-cols-12 gap-4">

    {/* Select HTML native → dung register() binh thuong */}
    <div className="col-span-6">
      <select {...register('movieId', { required: 'Vui long chon phim' })}
        className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] ...">
        <option value="">-- Chon phim --</option>
        {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </div>

    {/* PriceInput (custom component) → PHAI dung Controller */}
    <div className="col-span-4">
      <Controller
        name="basePrice"
        control={control}
        rules={{ required: 'Gia ve la bat buoc', min: { value: 1, message: 'Gia phai > 0' } }}
        render={({ field }) => (
          <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 75.000" />
        )}
      />
    </div>
  </div>
</form>
```

---

## 9. Refine -- Validation phuc tap (cross-field)

### Van de

Cac method nhu `.min()`, `.email()` chi kiem tra **1 field duy nhat**. Nhung co truong hop can so sanh **2 field voi nhau**:

- Mat khau va Xac nhan mat khau phai giong nhau
- Ngay ket thuc phai sau Ngay bat dau
- Gia VIP phai >= Gia thuong

Cac truong hop nay KHONG THE dung `.min()` hay `.max()` vi can so sanh voi field khac.

### Giai phap: z.refine()

```tsx
const registerSchema = z.object({
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  confirmPassword: z.string().min(1, 'Vui long xac nhan mat khau'),
}).refine(
  (data) => data.password === data.confirmPassword,
  // ↑ Ham kiem tra: nhan TOAN BO form data, tra ve true/false
  {
    message: 'Mat khau xac nhan khong khop',
    // ↑ Thong bao loi khi tra ve false
    path: ['confirmPassword'],
    // ↑ Loi se hien o field nao? → confirmPassword
  }
)
```

### Luong hoat dong

```
User nhap: password = "abc123", confirmPassword = "abc456"
    ↓
Zod validate tung field rieng le:
  - password: "abc123" → min(6) → OK ✓
  - confirmPassword: "abc456" → min(1) → OK ✓
    ↓
Zod chay refine():
  - data.password === data.confirmPassword?
  - "abc123" === "abc456"? → false!
    ↓
Tra ve loi: { path: ['confirmPassword'], message: 'Mat khau xac nhan khong khop' }
    ↓
errors.confirmPassword.message = 'Mat khau xac nhan khong khop'
    ↓
UI hien loi duoi field Xac nhan mat khau
```

### Code thuc te tu RegisterPage

```tsx
// File: frontend/src/features/auth/RegisterPage.tsx (dong 11-20)

const registerSchema = z.object({
  fullName: z.string().optional(),
  username: z.string().min(3, 'Ten dang nhap toi thieu 3 ky tu'),
  email: z.string().email('Email khong hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  confirmPassword: z.string().min(1, 'Vui long xac nhan mat khau'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mat khau xac nhan khong khop',
  path: ['confirmPassword'],
})
```

### Vi du khac: Ngay ket thuc phai sau ngay bat dau

```tsx
const showtimeSchema = z.object({
  startDate: z.string().min(1, 'Bat buoc'),
  endDate: z.string().min(1, 'Bat buoc'),
}).refine((data) => data.endDate > data.startDate, {
  message: 'Ngay ket thuc phai sau ngay bat dau',
  path: ['endDate'],
})
```

---

## 10. Tong hop luong xu ly form trong CineX

```
+-------------------------------------------------------------------+
|  BUOC 1: Khai bao Schema (Zod)                                   |
|  const schema = z.object({ ... })                                 |
|  type FormType = z.infer<typeof schema>                           |
+-------------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------------+
|  BUOC 2: Goi useForm                                              |
|  const { register, handleSubmit, reset, control, errors }         |
|    = useForm<FormType>({ resolver: zodResolver(schema) })         |
+-------------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------------+
|  BUOC 3: Gan vao Input                                            |
|  - Input HTML: {...register('fieldName')}                         |
|  - Input custom: <Controller name="fieldName" control={control} />|
+-------------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------------+
|  BUOC 4: Hien thi loi                                             |
|  {errors.fieldName && <p>{errors.fieldName.message}</p>}          |
+-------------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------------+
|  BUOC 5: Submit                                                   |
|  <form onSubmit={handleSubmit(onSubmit)}>                         |
|  → Zod validate → OK → onSubmit(data) → goi API                  |
|  → Zod validate → FAIL → cap nhat errors → UI hien loi           |
+-------------------------------------------------------------------+
```

---

## 11. Cau hoi tu kiem tra

**Cau 1:** Neu ban bo `resolver: zodResolver(loginSchema)` khoi `useForm()`, dieu gi xay ra khi user bam Submit ma de trong username?

> Goi y: Khong co zodResolver → khong co ai validate → `onSubmit` duoc goi voi `data = { username: "", password: "" }` → API nhan du lieu rong → loi phia server.

**Cau 2:** Tai sao AdminShowtimePage dung `Controller` cho `PriceInput` ma khong dung `register('basePrice')`?

> Goi y: `PriceInput` la component React custom (khong phai `<input>` HTML). No nhan props `value` va `onChange`, khong co `ref` de React Hook Form "nam" lay.

**Cau 3:** Trong RegisterPage, neu ban doi `path: ['confirmPassword']` thanh `path: ['password']` trong refine(), thi loi "Mat khau xac nhan khong khop" se hien o dau?

> Goi y: Loi se hien duoi field **password** thay vi duoi field **confirmPassword**. `path` quyet dinh loi duoc gan vao `errors.password` hay `errors.confirmPassword`.

**Cau 4:** Tai sao AdminMoviePage co `reset({ genreIds: [], status: 'COMING_SOON' })` khi mo dialog Tao moi? Sao khong chi `reset({})`?

> Goi y: Neu `reset({})`, `genreIds` se la `undefined` (khong phai mang rong) → code xu ly mang se loi. `status` mac dinh la `COMING_SOON` vi phim moi tao thuong o trang thai "Sap chieu".

**Cau 5:** So sanh 2 cach dung validation trong CineX: LoginPage dung `zodResolver` con AdminShowtimePage dung `rules` trong `register()` va `Controller`. Cach nao tot hon? Tai sao?

> Goi y: `zodResolver` tot hon vi validation tap trung 1 cho (schema), de doc va bao tri. `rules` inline tot cho form don gian it field. CineX dung ca 2 -- schema cho form auth (quan trong, can chac chan), rules inline cho form admin (nhanh, it field).
