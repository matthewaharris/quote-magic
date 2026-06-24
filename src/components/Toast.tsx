"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Universal toast system. Mount <ToastProvider> once near the root; call the
// function from useToast() anywhere in a client component:
//   const toast = useToast();
//   toast("Email sent!");            // success (default)
//   toast("Send failed", "error");
// Toasts fade in fast, hang ~2.6s, fade out slowly, bottom-right, and clean
// up after themselves. Click one to dismiss it early.

type Variant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
}

type ToastFn = (message: string, variant?: Variant) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

const VISIBLE_MS = 2600;
const EXIT_MS = 550;
const ENTER_MS = 150;

const VARIANT: Record<Variant, string> = {
  success: "bg-emerald-600",
  error: "bg-red-600",
  info: "bg-zinc-900",
};

function ToastView({
  toast,
  onDone,
}: {
  toast: ToastItem;
  onDone: (id: number) => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true)); // fade in
    const hide = setTimeout(() => setShown(false), VISIBLE_MS); // begin fade out
    const done = setTimeout(() => onDone(toast.id), VISIBLE_MS + EXIT_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hide);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setShown(false)}
      style={{ transitionDuration: `${shown ? ENTER_MS : EXIT_MS}ms` }}
      className={`pointer-events-auto cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-black/5 transition-all ease-out ${
        VARIANT[toast.variant]
      } ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
    >
      {toast.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>((message, variant = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 sm:w-auto">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
