import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";
import { apiFeedback } from "../../lib/api";

type Toast = {
  id: number;
  message: string;
};

const LOADING_DELAY_MS = 350;
const TOAST_TTL_MS = 5200;

export function RequestFeedback() {
  const [pending, setPending] = useState(() => apiFeedback.getPendingCount());
  const [showLoading, setShowLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return apiFeedback.subscribe((event) => {
      if (event.type === "pending") {
        setPending(event.pending);
        return;
      }

      setToasts((current) => [
        ...current.filter((toast) => toast.message !== event.message).slice(-2),
        { id: event.id, message: event.message },
      ]);
    });
  }, []);

  useEffect(() => {
    if (pending <= 0) {
      setShowLoading(false);
      return;
    }

    const timer = window.setTimeout(
      () => setShowLoading(true),
      LOADING_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, TOAST_TTL_MS),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  function closeToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return (
    <>
      {showLoading && (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-2xl border border-line/80 bg-white/95 px-4 py-3 text-sm font-black text-slate-700 shadow-card backdrop-blur">
          <span className="inline-flex items-center gap-2">
            <LoaderCircle size={18} className="animate-spin text-brand" />
            Carregando dados...
          </span>
        </div>
      )}

      <div className="fixed right-4 top-4 z-[90] grid w-[min(420px,calc(100vw-32px))] gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-white/95 p-4 text-sm font-semibold text-slate-700 shadow-card backdrop-blur"
            role="status"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle size={18} />
            </span>
            <p className="min-w-0 flex-1 leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={() => closeToast(toast.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600"
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
