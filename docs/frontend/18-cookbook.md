# Frontend Cookbook — Recipes thường gặp

> Tập hợp pattern thực dụng cho CineX-style React app: debounce, throttle, infinite scroll, file upload, toast, copy-to-clipboard, ...

## 1. Debounce Hook

### Recipe
```ts
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
```

### Use case — Search input
```tsx
const [query, setQuery] = useState("");
const debouncedQuery = useDebounce(query, 300);

const { data } = useQuery({
  queryKey: ["movies", debouncedQuery],
  queryFn: () => searchMovies(debouncedQuery),
  enabled: debouncedQuery.length >= 2,
});

<input value={query} onChange={(e) => setQuery(e.target.value)} />
```

Gõ "Avengers" → chỉ 1 API call sau khi ngừng gõ 300ms.

## 2. Throttle Hook

### Recipe
```ts
import { useEffect, useRef, useState } from "react";

export function useThrottle<T>(value: T, interval = 100): T {
  const [throttled, setThrottled] = useState(value);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const elapsed = Date.now() - lastRun.current;
    if (elapsed >= interval) {
      lastRun.current = Date.now();
      setThrottled(value);
    } else {
      const id = setTimeout(() => {
        lastRun.current = Date.now();
        setThrottled(value);
      }, interval - elapsed);
      return () => clearTimeout(id);
    }
  }, [value, interval]);

  return throttled;
}
```

### Use case — Scroll position
```tsx
const [scrollY, setScrollY] = useState(0);
const throttledY = useThrottle(scrollY, 100);

useEffect(() => {
  const handler = () => setScrollY(window.scrollY);
  window.addEventListener("scroll", handler);
  return () => window.removeEventListener("scroll", handler);
}, []);

// throttledY update tối đa 10 lần/giây thay vì 60
```

## 3. Infinite Scroll

### Recipe với TanStack Query
```ts
import { useInfiniteQuery } from "@tanstack/react-query";

export const useInfiniteMovies = (filter: MovieFilter) => {
  return useInfiniteQuery({
    queryKey: ["movies", filter],
    queryFn: ({ pageParam = 0 }) =>
      api.get("/api/movies", { params: { ...filter, page: pageParam } }).then(r => r.data.data),
    getNextPageParam: (lastPage) => lastPage.last ? undefined : lastPage.number + 1,
    initialPageParam: 0,
  });
};
```

### Component với IntersectionObserver
```tsx
function MovieListInfinite() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMovies({});
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!observerRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }  // load trước khi user thấy 200px
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const movies = data?.pages.flatMap(p => p.content) ?? [];

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {movies.map(m => <MovieCard key={m.id} movie={m} />)}
      </div>
      <div ref={observerRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && <Spinner />}
      </div>
    </>
  );
}
```

## 4. File Upload với Preview

### Recipe
```tsx
import { useState, ChangeEvent } from "react";

export function FileUpload({ onUpload }: { onUpload: (file: File) => Promise<string> }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận ảnh");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }

    // Preview ngay
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const url = await onUpload(file);
      toast.success("Tải lên thành công");
    } catch (err) {
      toast.error("Tải lên thất bại");
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={uploading}
      />
      {preview && (
        <img src={preview} className="mt-2 max-w-xs rounded" />
      )}
      {uploading && (
        <div className="w-full bg-white/10 rounded mt-2 h-2">
          <div
            className="bg-[#eab308] h-2 rounded transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

### Helper upload với progress
```ts
export async function uploadFile(file: File, onProgress?: (p: number) => void): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/api/uploads", formData, {
    onUploadProgress: (e) => {
      if (e.total) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress?.(percent);
      }
    },
  });
  return data.data.url;
}
```

## 5. Toast Notification

### Recipe với sonner (lightweight)
```bash
npm install sonner
```

```tsx
// main.tsx
import { Toaster } from "sonner";

<App />
<Toaster
  position="top-right"
  toastOptions={{
    style: {
      background: "#0a1929",
      color: "white",
      border: "1px solid rgba(255,255,255,0.1)",
    },
  }}
/>
```

### Use
```ts
import { toast } from "sonner";

toast.success("Đã lưu phim");
toast.error("Có lỗi xảy ra");
toast.info("Đang xử lý...");
toast.warning("Chú ý: ...");

toast.promise(api.post("/movies", data), {
  loading: "Đang lưu...",
  success: "Đã lưu",
  error: (err) => `Lỗi: ${err.message}`,
});

// Custom JSX
toast(<div>...</div>, { duration: 5000 });
```

## 6. Confirm Dialog

### Recipe imperative
```tsx
// useConfirm.ts
import { createContext, useContext, useState, ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = (options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  };

  const handleClose = (result: boolean) => {
    resolver?.(result);
    setOpts(null);
    setResolver(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Dialog open onOpenChange={() => handleClose(false)}>
          <DialogContent>
            <DialogTitle>{opts.title}</DialogTitle>
            {opts.description && <DialogDescription>{opts.description}</DialogDescription>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {opts.cancelText ?? "Hủy"}
              </Button>
              <Button
                variant={opts.variant === "destructive" ? "destructive" : "default"}
                onClick={() => handleClose(true)}
              >
                {opts.confirmText ?? "Xác nhận"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be inside ConfirmProvider");
  return ctx;
}
```

### Use
```tsx
const confirm = useConfirm();

const handleDelete = async () => {
  const ok = await confirm({
    title: "Xóa phim?",
    description: "Hành động này không thể hoàn tác.",
    confirmText: "Xóa",
    variant: "destructive",
  });
  if (!ok) return;
  await deleteMutation.mutateAsync(id);
};
```

## 7. Copy to Clipboard

### Recipe
```ts
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback cho HTTP context (clipboard API yêu cầu HTTPS)
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// Hook
export function useCopy() {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Đã copy");
    }
  };

  return { copy, copied };
}
```

### Use
```tsx
const { copy, copied } = useCopy();

<button onClick={() => copy(booking.bookingCode)}>
  {copied ? <CheckIcon /> : <CopyIcon />}
  {booking.bookingCode}
</button>
```

## 8. Click Outside

### Recipe
```ts
import { useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(handler: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [handler]);

  return ref;
}
```

### Use — Dropdown menu
```tsx
function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref}>
      <button onClick={() => setOpen(o => !o)}>Menu</button>
      {open && (
        <div className="absolute mt-2 ...">
          <a>Profile</a>
          <a>Logout</a>
        </div>
      )}
    </div>
  );
}
```

## 9. LocalStorage State Hook

### Recipe
```ts
import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}
```

### Use
```tsx
const [theme, setTheme] = useLocalStorage<"dark" | "light">("theme", "dark");
const [recent, setRecent] = useLocalStorage<number[]>("recent-movies", []);
```

## 10. Format Currency / Date

### Recipe
```ts
// utils/format.ts

export const formatVND = (amount: number): string => {
  return amount.toLocaleString("vi-VN") + "đ";
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  // → "24/05/2026"
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  // → "20:30 24/05/2026"
};

export const formatRelative = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDate(d);
};
```

## 11. Form Field với React Hook Form + Zod

### Recipe schema
```ts
import { z } from "zod";

export const movieSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được trống").max(200),
  duration: z.coerce.number().int().positive("Thời lượng > 0"),
  releaseDate: z.string().min(1),
  description: z.string().max(2000).optional(),
  genreIds: z.array(z.number()).min(1, "Chọn ít nhất 1 thể loại"),
});

export type MovieForm = z.infer<typeof movieSchema>;
```

### Component
```tsx
function MovieFormDialog({ initial, onSubmit }: Props) {
  const form = useForm<MovieForm>({
    resolver: zodResolver(movieSchema),
    defaultValues: initial ?? { title: "", duration: 90, genreIds: [] },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("title")} />
      {form.formState.errors.title && (
        <p className="text-red-400 text-xs">{form.formState.errors.title.message}</p>
      )}

      <input type="number" {...form.register("duration", { valueAsNumber: true })} />
      ...
      <button type="submit" disabled={form.formState.isSubmitting}>
        Lưu
      </button>
    </form>
  );
}
```

## 12. Câu hỏi tự kiểm tra

**Câu 1**: Debounce vs Throttle khác nhau thế nào?

→ Debounce: đợi user ngừng làm event, mới fire (search input). Throttle: fire tối đa N lần/giây (scroll, resize).

**Câu 2**: IntersectionObserver vs scroll event?

→ Observer hiệu quả hơn, async, không block main thread. Scroll event chạy 60 lần/giây → cần throttle.

**Câu 3**: Sao cần fallback `document.execCommand("copy")`?

→ `navigator.clipboard.writeText` yêu cầu HTTPS hoặc localhost. HTTP context → throw. Fallback hỗ trợ legacy.

**Câu 4**: useLocalStorage có issue gì cần lưu ý?

→ (1) localStorage không sync giữa tab → cần `storage` event. (2) JSON.parse fail nếu data corrupt. (3) Lưu object lớn → chậm + giới hạn ~5MB.

**Câu 5**: ConfirmDialog imperative vs declarative khác nhau?

→ Imperative: `await confirm({...})` returns bool — code linear, dễ đọc. Declarative: `<ConfirmDialog open={x} onConfirm={y} />` — phải manage state mở/đóng. Imperative gọn hơn cho confirm 1 lần.
