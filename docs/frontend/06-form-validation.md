# Form & Validation — react-hook-form + Zod

---

## Tại sao cần thư viện form?

Viết form thủ công bằng useState → mỗi field 1 state + 1 onChange → **rất dài**:

```tsx
// 5 field = 5 useState + 5 onChange → 20 dòng chỉ để quản lý state
const [username, setUsername] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [fullName, setFullName] = useState('');
const [phone, setPhone] = useState('');
```

react-hook-form làm hết trong **3 dòng**.

---

## Zod — Khai báo validation schema

```tsx
import { z } from 'zod';

// Schema = quy tắc validation
const registerSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be at most 50 characters'),
    email: z.string()
        .email('Invalid email format'),
    password: z.string()
        .min(6, 'Password must be at least 6 characters'),
    fullName: z.string().optional(),
});

// TypeScript type tự sinh từ schema
type RegisterForm = z.infer<typeof registerSchema>;
// → { username: string; email: string; password: string; fullName?: string }
```

---

## react-hook-form — Quản lý form

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function RegisterPage() {
    const {
        register,       // gắn vào input
        handleSubmit,   // xử lý submit
        formState: { errors, isSubmitting },  // lỗi + loading
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),  // dùng Zod validate
    });

    const onSubmit = async (data: RegisterForm) => {
        // data đã được validate bởi Zod, chắc chắn đúng format
        await api.post('/api/auth/register', data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

            {/* Username */}
            <div>
                <input
                    {...register('username')}
                    // ↑ react-hook-form tự quản lý value + onChange
                    placeholder="Username"
                    className="border p-2 rounded w-full"
                />
                {errors.username && (
                    <p className="text-red-500 text-sm mt-1">
                        {errors.username.message}
                    </p>
                )}
            </div>

            {/* Email */}
            <div>
                <input
                    {...register('email')}
                    placeholder="Email"
                    className="border p-2 rounded w-full"
                />
                {errors.email && (
                    <p className="text-red-500 text-sm">{errors.email.message}</p>
                )}
            </div>

            {/* Password */}
            <div>
                <input
                    {...register('password')}
                    type="password"
                    placeholder="Password"
                    className="border p-2 rounded w-full"
                />
                {errors.password && (
                    <p className="text-red-500 text-sm">{errors.password.message}</p>
                )}
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-500 text-black font-bold py-2 rounded"
            >
                {isSubmitting ? 'Đang xử lý...' : 'Đăng ký'}
            </button>
        </form>
    );
}
```

---

## Tổng hợp luồng

```
User gõ form → react-hook-form quản lý state (không cần useState)
    ↓
User click Submit → handleSubmit gọi Zod validate
    ↓
Zod kiểm tra: username >= 3 ký tự? email đúng format? password >= 6?
    ↓
Sai → hiện lỗi ngay dưới input (errors.username.message)
Đúng → gọi onSubmit(data) → gọi API
```
