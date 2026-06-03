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
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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
