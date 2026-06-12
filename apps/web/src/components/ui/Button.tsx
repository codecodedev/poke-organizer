import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "brand" | "ghost" | "gradient" | "outline" | "add" | "light";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  shake?: boolean;
  classChildren?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
  gradient: "btn-gradient h-12 px-6 rounded-2xl",
  outline: "border border-card-border bg-transparent text-foreground hover:bg-accent/40 transition-colors",
  add: "p-6 rounded-xl flex flex-row gap-2",
  light: "btn-light"
};

export function Button({ variant = "ghost", icon, shake, classChildren, className = "", children, ...props }: ButtonProps) {
  const shakeClass = shake ? "animate-shake ring-2 ring-brand ring-offset-2 dark:ring-offset-slate-900" : "";

  return (
    <button className={`btn ${variants[variant]} ${icon ? 'gap-2' : ''} ${shakeClass} ${className}`} {...props}>
      {icon && (
        <div className="flex shrink-0 items-center justify-center">
          {icon}
        </div>
      )}
      {
        children && (
          <div className={`flex items-center gap-2 ${classChildren}`}>
            {children}
          </div>
        )
      }
    </button>
  );
}
