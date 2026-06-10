import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, LoaderCircle, X } from "lucide-react";
import { apiFeedback } from "../../lib/api";

type Toast = {
  id: number;
  type: "error" | "success";
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
        { id: event.id, type: event.type, message: event.message },
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
        <div className="fixed bottom-6 right-6 z-[80] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-full border border-card-border bg-card/80 px-4 py-2.5 text-[13px] font-black text-foreground shadow-soft backdrop-blur-xl">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand"></span>
            </span>
            Carregando...
          </div>
        </div>
      )}

      <div className="fixed right-4 top-4 z-[90] grid w-[min(420px,calc(100vw-32px))] gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border bg-card/95 p-4 text-sm font-semibold shadow-card backdrop-blur ${
              toast.type === "error" ? "border-magenta/20 text-foreground" : "border-leaf/20 text-foreground"
            }`}
            role="status"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              toast.type === "error" ? "bg-magenta/10 text-magenta" : "bg-leaf/10 text-leaf"
            }`}>
              {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            </span>
            <p className="min-w-0 flex-1 leading-6 pt-1.5">{toast.message}</p>
            <button
              type="button"
              onClick={() => closeToast(toast.id)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-card-border/40 bg-card transition ${
                toast.type === "error" ? "text-muted-foreground hover:border-magenta/40 hover:text-magenta" : "text-muted-foreground hover:border-leaf/40 hover:text-leaf"
              }`}
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
