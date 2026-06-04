import { Keyboard, Mic } from "lucide-react";
import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, description, action, children, className = "" }: PanelProps) {
  return (
    <section className={`glass-panel panel-padding ${className}`}>
      {(title || description || action) && (
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-aqua/20 text-cyan-700">
            <Keyboard size={22} />
          </div>
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="section-copy mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
