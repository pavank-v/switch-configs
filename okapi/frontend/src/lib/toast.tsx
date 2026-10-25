import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { CloseIcon } from '@/components/icons';
import { cx } from '@/components/ui';

type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setToasts(current => [...current, { id, tone, message }]);
      setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cx(
              'animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-lg backdrop-blur',
              toast.tone === 'error'
                ? 'border-red-500/30 bg-red-50/95 text-red-800 dark:bg-red-950/90 dark:text-red-200'
                : 'border-emerald-500/30 bg-emerald-50/95 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200',
            )}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded opacity-60 transition-opacity hover:opacity-100"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}
