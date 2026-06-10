import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "brand" | "ghost" | "gradient" | "outline" | "add";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
  gradient: "btn-gradient h-12 px-6 rounded-2xl",
  outline: "border border-line bg-transparent hover:bg-field transition-colors",
  add: "p-6 rounded-xl flex flex-row gap-2",
};

export function Button({ variant = "ghost", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${variants[variant]} ${className}`} {...props}>
      <div className="">
      {icon}
      </div>
      <div className="overflow-hidden truncate">
      {children}
      </div>
    </button>
  );
}
