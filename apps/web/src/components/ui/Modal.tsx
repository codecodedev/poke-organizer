import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
  zIndexClass?: string;
};

export function Modal({ 
  title, 
  subtitle, 
  icon,
  children, 
  footer,
  onClose, 
  maxWidthClass = "max-w-3xl", 
  zIndexClass = "z-[100]" 
}: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-start justify-center bg-night/65 px-4 py-6 backdrop-blur-md`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className={`animate-soft-pop flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-card ${maxWidthClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="holo-strip animate-shimmer h-2 shrink-0" />
        
        {/* Fixed Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line/70 px-6 py-5">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
                {icon}
              </div>
            )}
            <div>
              <h2 id="modal-title" className="text-xl font-black text-ink">
                {title}
              </h2>
              {subtitle && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-slate-700 shadow-sm transition hover:bg-field"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="shrink-0 border-t border-line/70 bg-field/30 px-6 py-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
