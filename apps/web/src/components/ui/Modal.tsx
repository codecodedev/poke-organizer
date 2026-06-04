import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
};

export function Modal({ title, subtitle, children, onClose, maxWidthClass = "max-w-3xl" }: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className={`animate-soft-pop max-h-[80vh] w-full overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card ${maxWidthClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="holo-strip animate-shimmer h-2" />
        <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-2xl font-black text-ink">
              {title}
            </h2>
            {subtitle && <p className="section-copy mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
