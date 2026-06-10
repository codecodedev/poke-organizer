import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "brand" | "ghost" | "gradient" | "outline" | "add" | "light";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  shake?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
  gradient: "btn-gradient h-12 px-6 rounded-2xl",
  outline: "border border-line bg-transparent hover:bg-field transition-colors",
  add: "p-6 rounded-xl flex flex-row gap-2",
  light: "btn-light"
};

export function Button({ variant = "ghost", icon, shake, className = "", children, ...props }: ButtonProps) {
  const shakeClass = shake ? "animate-shake ring-2 ring-brand ring-offset-2 dark:ring-offset-slate-900" : "";

  return (
    <button className={`gap-2 ${variants[variant]} ${shakeClass} ${className}`} {...props}>
      <div className="">
      {icon}
      </div>
      <div className="overflow-hidden truncate">
      {children}
      </div>
    </button>
  );
}
